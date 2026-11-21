import {
  doc, getDoc, onSnapshot, runTransaction, serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../../firebase/client'
export { waitForUser } from '../../firebase/session'
import { createGame, resolveRound, resolveDuel, normalizeAction, normalizeTargetScore, DEFAULT_TARGET_SCORE, type DuelAttempt, type Action, type GameState, type PlayerId } from './engine'

export type RoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED'
export type Room = {
  code: string
  creator: string
  players: { p1: string; p2: string | null }
  status: RoomStatus
  game: GameState | null
  confirmations: Record<PlayerId, boolean>
  version: number
  revenge: Record<PlayerId, boolean>
  targetScore?: number
  duelConfirmations?: Record<PlayerId, boolean>
  createdAt?: { toMillis?: () => number }
  updatedAt?: { toMillis?: () => number }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const roundId = (seed: number, round: number) => `${seed}_${round}`
const actionRef = (code: string, seed: number, round: number, uid: string) => doc(db!, 'rooms', code, 'rounds', roundId(seed, round), 'actions', uid)
const roundRef = (code: string, seed: number, round: number) => doc(db!, 'rooms', code, 'rounds', roundId(seed, round))
const roomRef = (code: string) => doc(db!, 'rooms', code)
const duelAttemptRef = (code: string, id: string, stage: number, uid: string) => doc(db!, 'rooms', code, 'duels', `${id}_${stage}`, 'attempts', uid)
function randomCode(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}
function randomSeed(): number {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  return bytes[0] || 1
}
function slotFor(room: Room, uid: string): PlayerId | null {
  return room.players.p1 === uid ? 'p1' : room.players.p2 === uid ? 'p2' : null
}
function ensureActive(room: Room) {
  const lastActive = room.updatedAt?.toMillis?.() ?? room.createdAt?.toMillis?.()
  if (lastActive && Date.now() - lastActive > 30 * 24 * 60 * 60 * 1000) throw new Error('Esta sala expirou. Crie uma nova partida.')
}

export async function createRoom(uid: string): Promise<string> {
  if (!db) throw new Error('Firebase não está configurado.')
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode()
    const ref = roomRef(code)
    try {
      await runTransaction(db, async (tx) => {
        if ((await tx.get(ref)).exists()) throw new Error('CODE_TAKEN')
        tx.set(ref, {
          code, creator: uid, players: { p1: uid, p2: null }, status: 'WAITING', game: null,
          confirmations: { p1: false, p2: false }, version: 0, revenge: { p1: false, p2: false },
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          targetScore: DEFAULT_TARGET_SCORE, duelConfirmations: { p1: false, p2: false },
        })
      })
      return code
    } catch (error) {
      if (error instanceof Error && error.message === 'CODE_TAKEN') continue
      throw error
    }
  }
  throw new Error('Não foi possível gerar um código de sala. Tente novamente.')
}

export async function joinRoom(codeInput: string, uid: string): Promise<PlayerId> {
  if (!db) throw new Error('Firebase não está configurado.')
  const code = codeInput.trim().toUpperCase()
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new Error('Digite um código válido de seis caracteres.')
  const ref = roomRef(code)
  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw new Error('Sala não encontrada.')
    const room = snapshot.data() as Room
    ensureActive(room)
    const existing = slotFor(room, uid)
    if (existing) return existing
    if (room.status !== 'WAITING') throw new Error('Esta partida já começou.')
    if (room.players.p2) throw new Error('Esta sala já está completa.')
    tx.update(ref, { 'players.p2': uid, updatedAt: serverTimestamp() })
    return 'p2'
  })
}

export async function updateTargetScore(code: string, uid: string, targetScore: number): Promise<void> {
  if (!db) throw new Error('Firebase não está configurado.')
  await runTransaction(db, async (tx) => {
    const ref = roomRef(code), snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw new Error('Sala não encontrada.')
    const room = snapshot.data() as Room
    if (room.creator !== uid || room.status !== 'WAITING') throw new Error('A meta só pode ser alterada pelo anfitrião antes da partida.')
    tx.update(ref, { targetScore: normalizeTargetScore(targetScore), updatedAt: serverTimestamp() })
  })
}

export async function startRoom(code: string, uid: string): Promise<void> {
  if (!db) throw new Error('Firebase não está configurado.')
  const ref = roomRef(code)
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw new Error('Sala não encontrada.')
    const room = snapshot.data() as Room
    if (room.creator !== uid) throw new Error('Somente quem criou a sala pode iniciar.')
    if (room.status !== 'WAITING' || !room.players.p2) throw new Error('Aguarde a outra pessoa entrar.')
    const game = createGame(randomSeed(), undefined, room.targetScore ?? DEFAULT_TARGET_SCORE)
    tx.update(ref, { status: 'PLAYING', game, confirmations: { p1: false, p2: false }, revenge: { p1: false, p2: false }, version: room.version + 1, updatedAt: serverTimestamp() })
    tx.set(roundRef(code, game.seed, 1), { seed: game.seed, round: 1, confirmations: { p1: false, p2: false }, resolved: false })
  })
}

export async function submitAction(code: string, uid: string, action: Action): Promise<void> {
  if (!db) throw new Error('Firebase não está configurado.')
  const ref = roomRef(code)
  await runTransaction(db, async (tx) => {
    const roomSnapshot = await tx.get(ref)
    if (!roomSnapshot.exists()) throw new Error('Sala não encontrada.')
    const room = roomSnapshot.data() as Room
    const slot = slotFor(room, uid)
    if (!slot || room.status !== 'PLAYING' || !room.game || room.game.duel) throw new Error('Esta sala não está aceitando jogadas.')
    ensureActive(room)
    const round = room.game.round
    if (room.confirmations[slot]) throw new Error('Sua jogada já foi confirmada nesta rodada.')
    const rRef = roundRef(code, room.game.seed, round)
    const privateRef = actionRef(code, room.game.seed, round, uid)
    const [roundSnapshot, privateSnapshot] = await Promise.all([tx.get(rRef), tx.get(privateRef)])
    const confirmations = roundSnapshot.exists() ? roundSnapshot.data().confirmations as Record<PlayerId, boolean> : { p1: false, p2: false }
    if (confirmations[slot] || privateSnapshot.exists()) throw new Error('Sua jogada já foi confirmada nesta rodada.')
    const nextConfirmations = { ...confirmations, [slot]: true }
    tx.set(privateRef, { uid, action: normalizeAction(action, room.game.jumps[slot]), round })
    tx.set(rRef, { seed: room.game.seed, round, confirmations: nextConfirmations, resolved: false })
    tx.update(ref, { [`confirmations.${slot}`]: true, updatedAt: serverTimestamp() })
  })
}

export async function resolveIfReady(code: string): Promise<void> {
  if (!db) return
  const ref = roomRef(code)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await runTransaction(db, async (tx) => {
    const roomSnapshot = await tx.get(ref)
    if (!roomSnapshot.exists()) return
    const room = roomSnapshot.data() as Room
    if (room.status !== 'PLAYING' || !room.game || room.game.duel || !room.confirmations.p1 || !room.confirmations.p2) return
    const round = room.game.round
    const rRef = roundRef(code, room.game.seed, round)
    const p1Ref = actionRef(code, room.game.seed, round, room.players.p1)
    const p2Ref = actionRef(code, room.game.seed, round, room.players.p2!)
    const [roundSnapshot, p1Snapshot, p2Snapshot] = await Promise.all([tx.get(rRef), tx.get(p1Ref), tx.get(p2Ref)])
    if (!roundSnapshot.exists() || roundSnapshot.data().resolved || !p1Snapshot.exists() || !p2Snapshot.exists()) return
    const confirmations = roundSnapshot.data().confirmations as Record<PlayerId, boolean>
    if (!confirmations.p1 || !confirmations.p2) return
    const { state: game } = resolveRound(room.game, { p1: p1Snapshot.data().action as Action, p2: p2Snapshot.data().action as Action })
    tx.update(rRef, { resolved: true })
    tx.update(ref, {
      game, status: game.finished ? 'FINISHED' : 'PLAYING', confirmations: { p1: false, p2: false },
      duelConfirmations: { p1: false, p2: false },
      version: room.version + 1, updatedAt: serverTimestamp(),
    })
      })
      return
    } catch (error) {
      const latest = await getDoc(ref)
      const room = latest.exists() ? latest.data() as Room : null
      if (!room || room.status !== 'PLAYING' || !room.game || !room.confirmations.p1 || !room.confirmations.p2) return
      if (attempt === 2) throw error
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
    }
  }
}

export async function requestRevenge(code: string, uid: string): Promise<void> {
  if (!db) throw new Error('Firebase não está configurado.')
  const ref = roomRef(code)
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw new Error('Sala não encontrada.')
    const room = snapshot.data() as Room
    const slot = slotFor(room, uid)
    if (!slot || room.status !== 'FINISHED' || !room.game) throw new Error('A revanche ainda não está disponível.')
    const revenge = { ...room.revenge, [slot]: true }
    tx.update(ref, { revenge, updatedAt: serverTimestamp() })
  })
}

export async function beginRevengeIfReady(code: string): Promise<void> {
  if (!db) return
  const ref = roomRef(code)
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) return
    const room = snapshot.data() as Room
    if (room.status !== 'FINISHED' || !room.game || !room.revenge.p1 || !room.revenge.p2) return
    const game = createGame(randomSeed(), room.game.mapId, room.game.targetScore ?? room.targetScore ?? DEFAULT_TARGET_SCORE)
    tx.update(ref, { game, status: 'PLAYING', confirmations: { p1: false, p2: false }, revenge: { p1: false, p2: false }, version: room.version + 1, updatedAt: serverTimestamp() })
    tx.set(roundRef(code, game.seed, 1), { seed: game.seed, round: 1, confirmations: { p1: false, p2: false }, resolved: false })
  })
}

export async function submitDuelAttempt(code: string, uid: string, id: string, stage: number, position: number | null): Promise<void> {
  if (!db) throw new Error('Firebase não está configurado.')
  if (position !== null && (!Number.isFinite(position) || position < 0 || position > 1)) throw new Error('Tentativa inválida.')
  await runTransaction(db, async (tx) => {
    const ref = roomRef(code), snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw new Error('Sala não encontrada.')
    const room = snapshot.data() as Room, slot = slotFor(room, uid), duel = room.game?.duel
    if (!slot || room.status !== 'PLAYING' || !duel || duel.id !== id || duel.stage !== stage) throw new Error('Este duelo já mudou. Tente na etapa atual.')
    ensureActive(room)
    const attemptRef = duelAttemptRef(code, id, stage, uid), existing = await tx.get(attemptRef)
    if (existing.exists() || room.duelConfirmations?.[slot]) return
    tx.set(attemptRef, { uid, duelId: id, stage, position })
    tx.update(ref, { duelConfirmations: { p1: false, p2: false, ...room.duelConfirmations, [slot]: true }, updatedAt: serverTimestamp() })
  })
}

export async function resolveDuelIfReady(code: string): Promise<void> {
  if (!db) return
  const ref = roomRef(code)
  try {
    await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(ref)
      if (!snapshot.exists()) return
      const room = snapshot.data() as Room, duel = room.game?.duel
      if (room.status !== 'PLAYING' || !room.game || !duel || !room.duelConfirmations?.p1 || !room.duelConfirmations.p2) return
      const [p1, p2] = await Promise.all([tx.get(duelAttemptRef(code, duel.id, duel.stage, room.players.p1)), tx.get(duelAttemptRef(code, duel.id, duel.stage, room.players.p2!))])
      if (!p1.exists() || !p2.exists()) return
      const { state: game } = resolveDuel(room.game, { p1: p1.data() as DuelAttempt, p2: p2.data() as DuelAttempt })
      tx.update(ref, { game, status: game.finished ? 'FINISHED' : 'PLAYING', duelConfirmations: { p1: false, p2: false }, version: room.version + 1, updatedAt: serverTimestamp() })
    })
  } catch (error) {
    const latest = await getDoc(ref), room = latest.exists() ? latest.data() as Room : null
    if (!room?.game?.duel || !room.duelConfirmations?.p1 || !room.duelConfirmations.p2) return
    throw error
  }
}

export function subscribeRoom(code: string, callback: (room: Room | null) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db) throw new Error('Firebase não está configurado.')
  return onSnapshot(roomRef(code), (snapshot) => callback(snapshot.exists() ? snapshot.data() as Room : null), onError)
}

export async function readRoom(code: string): Promise<Room | null> {
  if (!db) return null
  const snapshot = await getDoc(roomRef(code))
  return snapshot.exists() ? snapshot.data() as Room : null
}
