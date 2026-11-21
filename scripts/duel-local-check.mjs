// Disposable browser fixture. Restricted to the demo project and local emulators.
// node scripts/duel-local-check.mjs <room-created-in-local-UI> empty|crystal|finish
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getDoc, initializeFirestore, onSnapshot, runTransaction, serverTimestamp, terminate } from 'firebase/firestore'
import { createGame } from '../src/games/rastro/engine.ts'

const [code, mode] = process.argv.slice(2)
if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code ?? '') || !['empty', 'crystal', 'finish'].includes(mode)) throw new Error('Local test room and fixture mode required.')
const projectId = 'demo-juguitos'
const env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8085 } })
const app = initializeApp({ projectId, apiKey: 'demo-key', appId: 'demo-app' }, `local-duel-${mode}`)
const auth = getAuth(app)
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
const { user } = await signInAnonymously(auth)
const db = initializeFirestore(app, { experimentalForceLongPolling: true })
connectFirestoreEmulator(db, '127.0.0.1', 8085)
const ref = doc(db, 'rooms', code)
await env.withSecurityRulesDisabled(async (context) => {
  const fixtureDb = context.firestore(), fixtureRef = doc(fixtureDb, 'rooms', code)
  const room = (await getDoc(fixtureRef)).data()
  if (!room?.creator) throw new Error('Create this room in the local browser first.')
  const game = { ...createGame(mode === 'empty' ? 100 : mode === 'finish' ? 102 : 101), mapId: 0, positions: { p1: { x: 2, y: 3 }, p2: { x: 4, y: 3 } }, scores: { p1: mode === 'finish' ? 13 : 0, p2: 0 }, crystals: mode === 'empty' ? [] : [{ x: 3, y: 3, id: 'contested-fixture', value: 1 }] }
  await runTransaction(fixtureDb, async (tx) => tx.update(fixtureRef, { status: 'PLAYING', game, 'players.p2': user.uid, confirmations: { p1: false, p2: false }, duelConfirmations: { p1: false, p2: false }, revenge: { p1: false, p2: false }, version: room.version + 1, updatedAt: serverTimestamp() }))
})
await runTransaction(db, async (tx) => {
  const room = (await tx.get(ref)).data(), game = room.game
  const roundRef = doc(db, 'rooms', code, 'rounds', `${game.seed}_${game.round}`)
  tx.set(doc(roundRef, 'actions', user.uid), { uid: user.uid, round: game.round, action: { kind: 'move', direction: 'left' } })
  tx.set(roundRef, { seed: game.seed, round: game.round, confirmations: { p1: false, p2: true }, resolved: false })
  tx.update(ref, { 'confirmations.p2': true, updatedAt: serverTimestamp() })
})
console.log('Local fixture ready:', code, mode)
const sent = new Set()
const stop = onSnapshot(ref, (snapshot) => {
  if (snapshot.metadata.hasPendingWrites) return
  const room = snapshot.data(), duel = room?.game?.duel
  if (!duel) { console.log('Local state:', room?.status, JSON.stringify(room?.game?.scores), 'turn', room?.game?.round); return }
  const key = `${duel.id}_${duel.stage}`
  if (sent.has(key) || room.duelConfirmations.p2) return
  sent.add(key)
  void runTransaction(db, async (tx) => {
    const latest = (await tx.get(ref)).data()
    if (latest?.game?.duel?.id !== duel.id || latest.game.duel.stage !== duel.stage || latest.duelConfirmations.p2) return
    tx.set(doc(db, 'rooms', code, 'duels', key, 'attempts', user.uid), { uid: user.uid, duelId: duel.id, stage: duel.stage, position: null })
    tx.update(ref, { duelConfirmations: { ...latest.duelConfirmations, p2: true }, updatedAt: serverTimestamp() })
  }).catch((error) => console.error(error.code, error.message))
}, (error) => console.error(error.code, error.message))
async function shutdown() { stop(); await terminate(db); await deleteApp(app); await env.cleanup(); process.exit(0) }
process.on('SIGINT', () => void shutdown())
setTimeout(() => void shutdown(), 5 * 60 * 1000)
