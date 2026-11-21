// Independent guest for a room created explicitly by the production UI check.
// Run: node scripts/qte-production-check.mjs <test-room-code>
import { readFile, writeFile } from 'node:fs/promises'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, inMemoryPersistence, setPersistence, signInAnonymously } from 'firebase/auth'
import { doc, getDoc, initializeFirestore, onSnapshot, runTransaction, serverTimestamp, terminate } from 'firebase/firestore'

const code = process.argv[2]
if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code ?? '')) throw new Error('Use only an explicitly created test room code.')
const values = Object.fromEntries((await readFile('.env.local', 'utf8')).split(/\r?\n/).filter((line) => line.startsWith('VITE_')).map((line) => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')] }))
const app = initializeApp({ apiKey: values.VITE_FIREBASE_API_KEY, authDomain: values.VITE_FIREBASE_AUTH_DOMAIN, projectId: values.VITE_FIREBASE_PROJECT_ID, appId: values.VITE_FIREBASE_APP_ID }, `qte-guest-${Date.now()}`)
const auth = getAuth(app)
await setPersistence(auth, inMemoryPersistence)
const { user } = await signInAnonymously(auth)
const db = initializeFirestore(app, { experimentalForceLongPolling: true })
const ref = doc(db, 'rooms', code)
await runTransaction(db, async (tx) => {
  const snapshot = await tx.get(ref), room = snapshot.data()
  if (!room || room.status !== 'WAITING' || room.players.p2) throw new Error('The test room must be waiting and have an empty guest slot.')
  tx.update(ref, { 'players.p2': user.uid, updatedAt: serverTimestamp() })
})
console.log('Independent test guest joined', code)
const actions = ['up', 'up', 'up', 'left', 'left', 'left', 'stay']
const sent = new Set()
let processing = false, queued = null
const stop = onSnapshot(ref, (snapshot) => {
  if (snapshot.metadata.hasPendingWrites) return
  queued = snapshot.data()
  void processQueue()
}, (error) => console.error(error.code, error.message))
async function processQueue() {
  if (processing) return
  processing = true
  try {
    while (queued) {
      const room = queued; queued = null
      const game = room.game
      await writeFile('docs/qte-production-state.json', JSON.stringify({ code, status: room.status, version: room.version, game: game ? { round: game.round, targetScore: game.targetScore, scores: game.scores, positions: game.positions, jumps: game.jumps, crystalCount: game.crystals.length, specials: game.crystals.filter((c) => c.value === 2).length, duel: game.duel, lastDuel: game.lastDuel } : null }, null, 2))
      if (room.status !== 'PLAYING' || !game) continue
      if (game.duel) {
        const duel = game.duel, key = `duel:${duel.id}:${duel.stage}`
        if (sent.has(key) || room.duelConfirmations?.p2) continue
        sent.add(key)
        await runTransaction(db, async (tx) => {
          const latest = (await tx.get(ref)).data()
          if (latest?.game?.duel?.id !== duel.id || latest.game.duel.stage !== duel.stage || latest.duelConfirmations?.p2) return
          const attemptRef = doc(db, 'rooms', code, 'duels', `${duel.id}_${duel.stage}`, 'attempts', user.uid)
          if ((await tx.get(attemptRef)).exists()) return
          tx.set(attemptRef, { uid: user.uid, duelId: duel.id, stage: duel.stage, position: duel.stage === 0 ? duel.center : null })
          tx.update(ref, { duelConfirmations: { ...latest.duelConfirmations, p2: true }, updatedAt: serverTimestamp() })
        })
        console.log('Guest QTE attempt', duel.stage, 'period', duel.periodMs)
      } else if (game.round <= actions.length) {
        const key = `${game.seed}:${game.round}`
        if (sent.has(key) || room.confirmations.p2) continue
        sent.add(key)
        await runTransaction(db, async (tx) => {
          const latest = (await tx.get(ref)).data()
          if (latest?.game?.round !== game.round || latest.game.duel || latest.confirmations.p2) return
          const roundRef = doc(db, 'rooms', code, 'rounds', `${game.seed}_${game.round}`)
          const actionRef = doc(db, 'rooms', code, 'rounds', `${game.seed}_${game.round}`, 'actions', user.uid)
          const [roundSnapshot, actionSnapshot] = await Promise.all([tx.get(roundRef), tx.get(actionRef)])
          if (actionSnapshot.exists()) return
          const confirmations = { ...(roundSnapshot.data()?.confirmations ?? { p1: false, p2: false }), p2: true }
          tx.set(actionRef, { uid: user.uid, round: game.round, action: actions[game.round - 1] === 'stay' ? { kind: 'stay' } : { kind: 'move', direction: actions[game.round - 1] } })
          tx.set(roundRef, { seed: game.seed, round: game.round, confirmations, resolved: false })
          tx.update(ref, { 'confirmations.p2': true, updatedAt: serverTimestamp() })
        })
        console.log('Guest movement', game.round, actions[game.round - 1])
      }
    }
  } catch (error) { console.error(error.code, error.message) }
  finally { processing = false }
}
async function shutdown() { stop(); await terminate(db); await deleteApp(app); process.exit(0) }
process.on('SIGINT', () => void shutdown())
setTimeout(() => void shutdown(), 10 * 60 * 1000)
