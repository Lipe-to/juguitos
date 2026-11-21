import {
  doc, getDocFromServer, onSnapshot, runTransaction, serverTimestamp, setDoc, type Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/client'
export { waitForUser } from '../../firebase/session'
import {
  CURRENT_FLOCK, flockCount, flockDuration, GUESS_MS, judgeRound, MAX_GUESS, otherSide, READY_MS, REVEAL_MS,
  SHEEP_CODE, START_LIVES, type FlockVersion, type Guesses, type Pair, type Side,
} from './engine'

export type SheepRoom = {
  host: string
  guest: string | null
  phase: 'waiting' | 'run' | 'result' | 'finished'
  match: number
  round: number
  seed: number
  flockVersion?: FlockVersion
  lives: Pair<number>
  sent: Pair<boolean>
  replay: Pair<boolean>
  last: Guesses | null
  anchor: Timestamp
}
type Turn = Pick<SheepRoom, 'match' | 'round'>
export type Clock = { now: () => number; latency: number }
const empty = () => ({ p1: false, p2: false })
const lives = () => ({ p1: START_LIVES, p2: START_LIVES })
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const codeForInvite = () => 'O' + Array.from(crypto.getRandomValues(new Uint8Array(5)), (n) => alphabet[n % 32]).join('')
const roomRef = (code: string) => {
  if (!SHEEP_CODE.test(code)) throw new Error('Confira o código da sala de Conta, Ovelha!')
  return doc(db!, 'sheepRooms', code)
}
const guessRef = (code: string, turn: Turn, uid: string) =>
  doc(db!, 'sheepRooms', code, 'rounds', `${turn.match}_${turn.round}`, 'guesses', uid)
const sameTurn = (a: Turn, b: Turn) => a.match === b.match && a.round === b.round
const slot = (room: SheepRoom, uid: string): Side | null => room.host === uid ? 'p1' : room.guest === uid ? 'p2' : null

export async function syncClock(uid: string): Promise<Clock> {
  const ref = doc(db!, 'sheepClocks', uid)
  async function sample(): Promise<Clock> {
    const t0 = performance.now()
    await setDoc(ref, { at: serverTimestamp() })
    const t1 = performance.now()
    const timestamp = (await getDocFromServer(ref)).data()?.at as Timestamp | undefined
    if (!timestamp) throw new Error('Não foi possível sincronizar o relógio da partida.')
    const time = timestamp.toMillis(), midpoint = (t0 + t1) / 2
    return { now: () => time + performance.now() - midpoint, latency: t1 - t0 }
  }
  const first = await sample()
  if (first.latency <= 320) return first
  // The initial connection can inflate the first round trip.
  const second = await sample().catch(() => first)
  return second.latency < first.latency ? second : first
}

export async function createSheepRoom(uid: string) {
  for (let i = 0; i < 6; i++) {
    const code = codeForInvite(), ref = roomRef(code), seed = randomSeed()
    try {
      const created = await runTransaction(db!, async (tx) => {
        if ((await tx.get(ref)).exists()) return false
        tx.set(ref, { host: uid, guest: null, phase: 'waiting', match: 1, round: 0, seed, flockVersion: CURRENT_FLOCK, lives: lives(), sent: empty(), replay: empty(), last: null, anchor: serverTimestamp() })
        return true
      })
      if (created) return code
    } catch (error) {
      if ((error as { code?: string }).code !== 'permission-denied') throw error
    }
  }
  throw new Error('Não foi possível criar uma sala agora. Tente de novo.')
}

export async function joinSheepRoom(code: string, uid: string): Promise<Side> {
  const ref = roomRef(code)
  return runTransaction(db!, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Sala não encontrada. Confira o código.')
    const room = snap.data() as SheepRoom
    const side = slot(room, uid)
    if (side) return side
    if (room.phase !== 'waiting' || room.guest) throw new Error('A sala já tem duas pessoas.')
    tx.update(ref, { guest: uid })
    return 'p2'
  })
}

export function watchSheepRoom(code: string, onRoom: (room: SheepRoom, cached: boolean) => void, onError: (error: Error) => void) {
  return onSnapshot(roomRef(code), { includeMetadataChanges: true }, (snap) => {
    if (snap.metadata.hasPendingWrites) return
    if (snap.exists()) onRoom(snap.data() as SheepRoom, snap.metadata.fromCache)
    else if (!snap.metadata.fromCache) onError(new Error('Sala não encontrada.'))
  }, onError)
}

export async function startSheepMatch(code: string, uid: string) {
  const ref = roomRef(code)
  await runTransaction(db!, async (tx) => {
    const room = (await tx.get(ref)).data() as SheepRoom | undefined
    if (room?.phase !== 'waiting' || room.host !== uid || !room.guest) return
    tx.update(ref, { phase: 'run', round: 1, anchor: serverTimestamp() })
  })
}

export async function sendGuess(code: string, uid: string, turn: Turn, value: number) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_GUESS) throw new Error('Digite um número de 0 a 99.')
  const ref = roomRef(code)
  await runTransaction(db!, async (tx) => {
    const room = (await tx.get(ref)).data() as SheepRoom | undefined
    if (!room || room.phase !== 'run' || !sameTurn(room, turn)) throw new Error('Essa rodada já terminou.')
    const side = slot(room, uid)
    if (!side) throw new Error('Você não faz parte desta sala.')
    if (room.sent[side]) return
    tx.set(guessRef(code, room, uid), { value })
    tx.update(ref, { [`sent.${side}`]: true })
  })
}

export async function settleSheepRound(code: string, turn: Turn, clock: Clock) {
  const ref = roomRef(code)
  await runTransaction(db!, async (tx) => {
    const room = (await tx.get(ref)).data() as SheepRoom | undefined
    if (!room?.guest || room.phase !== 'run' || !sameTurn(room, turn)) return
    const version = room.flockVersion ?? 1
    if (!(room.sent.p1 && room.sent.p2) && clock.now() < room.anchor.toMillis() + READY_MS + flockDuration(room.round, version) + GUESS_MS) return
    const readGuess = async (side: Side, uid: string) => room.sent[side] ? (await tx.get(guessRef(code, room, uid))).get('value') as number : null
    const [p1, p2] = await Promise.all([readGuess('p1', room.host), readGuess('p2', room.guest)])
    const result = judgeRound(flockCount(room.seed, room.round, version), { p1, p2 }, room.lives)
    tx.update(ref, {
      lives: result.lives, last: { p1, p2 },
      phase: result.lives.p1 === 0 || result.lives.p2 === 0 ? 'finished' : 'result', anchor: serverTimestamp(),
    })
  })
}

export async function nextSheepRound(code: string, turn: Turn, clock: Clock) {
  const ref = roomRef(code)
  await runTransaction(db!, async (tx) => {
    const room = (await tx.get(ref)).data() as SheepRoom | undefined
    if (room?.phase !== 'result' || !sameTurn(room, turn) || clock.now() < room.anchor.toMillis() + REVEAL_MS) return
    tx.update(ref, { phase: 'run', round: room.round + 1, sent: empty(), last: null, anchor: serverTimestamp() })
  })
}

export async function sheepRematch(code: string, uid: string, match: number) {
  const ref = roomRef(code), seed = randomSeed()
  await runTransaction(db!, async (tx) => {
    const room = (await tx.get(ref)).data() as SheepRoom | undefined
    if (room?.phase !== 'finished' || room.match !== match) return
    const side = slot(room, uid)
    if (!side || room.replay[side]) return
    if (room.replay[otherSide(side)]) {
      tx.update(ref, { phase: 'run', match: match + 1, round: 1, seed, lives: lives(), replay: empty(), sent: empty(), last: null, anchor: serverTimestamp() })
    } else tx.update(ref, { [`replay.${side}`]: true })
  })
}
