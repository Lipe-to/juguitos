import { PRACTICE_BOT, PRACTICE_USER, practiceSeed } from '../practice'
import { CURRENT_FLOCK, flockCount, flockDuration, GUESS_MS, judgeRound, MAX_GUESS, READY_MS, REVEAL_MS, START_LIVES, type Guesses } from './engine'
import type { Clock, SheepRoom } from './online'

const clear = () => ({ p1: false, p2: false })
const lives = () => ({ p1: START_LIVES, p2: START_LIVES })
const timestamp = (now = Date.now()) => ({ toMillis: () => now })
type Turn = Pick<SheepRoom, 'match' | 'round'>

export function createSheepPractice() {
  let room: SheepRoom = {
    host: PRACTICE_USER, guest: PRACTICE_BOT, phase: 'waiting', match: 1, round: 0,
    seed: practiceSeed(), flockVersion: CURRENT_FLOCK,
    lives: lives(), sent: clear(), replay: clear(), last: null, anchor: timestamp(),
  }
  let guesses: Guesses = { p1: null, p2: null }
  let listener: ((room: SheepRoom, cached: boolean) => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const guessStart = () => room.anchor.toMillis() + READY_MS + flockDuration(room.round, CURRENT_FLOCK)
  const sameTurn = (turn: Turn) => room.match === turn.match && room.round === turn.round

  function publish(changes: Partial<SheepRoom>) {
    room = { ...room, ...changes }
    listener?.(room, false)
    scheduleBot()
  }
  function scheduleBot() {
    clearTimeout(timer)
    if (!listener || room.phase !== 'run' || room.sent.p2) return
    timer = setTimeout(() => {
      const total = flockCount(room.seed, room.round, CURRENT_FLOCK)
      const sign = room.round % 2 ? 1 : -1
      guesses.p2 = Math.max(0, Math.min(MAX_GUESS, total + sign * (1 + (room.seed + room.round) % 3)))
      publish({ sent: { ...room.sent, p2: true } })
    }, Math.max(0, guessStart() + 1200 - Date.now()))
  }
  function startRound(round: number, changes: Partial<SheepRoom> = {}) {
    guesses = { p1: null, p2: null }
    publish({ ...changes, phase: 'run', round, sent: clear(), last: null, anchor: timestamp() })
  }
  return {
    waitForUser: async () => ({ uid: PRACTICE_USER }),
    joinSheepRoom: async (_code: string, _uid: string) => 'p1' as const,
    syncClock: async (_uid: string): Promise<Clock> => ({ now: Date.now, latency: 0 }),
    watchSheepRoom(_code: string, onRoom: (room: SheepRoom, cached: boolean) => void) {
      listener = onRoom
      listener(room, false)
      scheduleBot()
      return () => { listener = undefined; clearTimeout(timer) }
    },
    async startSheepMatch(_code: string, _uid: string) {
      if (room.phase === 'waiting') startRound(1)
    },
    async sendGuess(_code: string, _uid: string, turn: Turn, value: number) {
      const now = Date.now()
      if (room.phase !== 'run' || !sameTurn(turn) || room.sent.p1 || now < guessStart() || now >= guessStart() + GUESS_MS) return
      if (!Number.isInteger(value) || value < 0 || value > MAX_GUESS) return
      guesses.p1 = value
      publish({ sent: { ...room.sent, p1: true } })
    },
    async settleSheepRound(_code: string, turn: Turn, clock: Clock) {
      if (room.phase !== 'run' || !sameTurn(turn)) return
      if (!(room.sent.p1 && room.sent.p2) && clock.now() < guessStart() + GUESS_MS) return
      const result = judgeRound(flockCount(room.seed, room.round, CURRENT_FLOCK), guesses, room.lives)
      const phase = result.lives.p1 === 0 || result.lives.p2 === 0 ? 'finished' : 'result'
      publish({ lives: result.lives, last: { ...guesses }, phase, anchor: timestamp() })
    },
    async nextSheepRound(_code: string, turn: Turn, clock: Clock) {
      if (room.phase === 'result' && sameTurn(turn) && clock.now() >= room.anchor.toMillis() + REVEAL_MS) startRound(room.round + 1)
    },
    async sheepRematch(_code: string, _uid: string, match: number) {
      if (room.phase === 'finished' && room.match === match) startRound(1, { match: match + 1, seed: practiceSeed(), lives: lives() })
    },
  }
}
