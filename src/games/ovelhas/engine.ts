export const READY_MS = 3500
export const GUESS_MS = 12000
export const REVEAL_MS = 4700
export const START_LIVES = 3
export const MAX_GUESS = 99
export const SHEEP_CODE = /^O[A-HJ-NP-Z2-9]{5}$/
export const CURRENT_FLOCK = 4
export type FlockVersion = 1 | 2 | 3 | typeof CURRENT_FLOCK

export type Side = 'p1' | 'p2'
export type Pair<T> = Record<Side, T>
export type Guesses = Pair<number | null>
export const otherSide = (side: Side): Side => side === 'p1' ? 'p2' : 'p1'
export const difficulty = (round: number) => Math.max(0, Math.min(12, round - 1))
export const flockDuration = (round: number, version: FlockVersion = CURRENT_FLOCK) => version === 1
  ? 9000 - 300 * difficulty(round)
  : 10500 + 600 * Math.min(6, difficulty(round))
// The Firestore rules use the same formula to validate the loss of a life.
export const flockCount = (seed: number, round: number, version: FlockVersion = CURRENT_FLOCK) => 8
  + (version === 1 ? difficulty(round) * 2
    : version === 2 ? Math.floor(Math.min(8, difficulty(round)) / 2)
      : version === 3
        ? (round >= 2 ? 1 : 0) + (round >= 4 ? 1 : 0) + (round >= 6 ? 1 : 0) + (round >= 8 ? 1 : 0) + (round >= 10 ? 1 : 0)
        : Math.min(82, 2 * round))
  + (version === 3 ? ((seed % 127 + round * 31 + (round % 7) * 13 + (round % 5) * 17) % 7)
    : version === 4 ? ((seed % 251 + round * 37 + (round % 11) * 23 + (round % 7) * 17) % 10)
      : (seed + round * 13) % 5)
export const tempo = (round: number, version: FlockVersion = CURRENT_FLOCK) => 106
  + (version === 1 ? difficulty(round) * 9
    : version === 4 ? Math.max(0, round - 1) * 9
      : Math.min(6, difficulty(round)) * 6)

export function judgeRound(total: number, guesses: Guesses, lives: Pair<number>) {
  const error = { p1: guesses.p1 === null ? 100 : Math.abs(total - guesses.p1), p2: guesses.p2 === null ? 100 : Math.abs(total - guesses.p2) }
  const loser: Side | null = error.p1 === error.p2 ? null : error.p1 > error.p2 ? 'p1' : 'p2'
  return { loser, lives: { p1: lives.p1 - Number(loser === 'p1'), p2: lives.p2 - Number(loser === 'p2') } }
}

export type SheepPass = {
  at: number; travel: number; lane: number; direction: 1 | -1
  size: number; bounce: number; fleece: number; hops: number
  motion?: { mark: number; pauseMs: number; returnToStart: boolean; crossingMs: number }
  fall?: { landing: number; descendMs: number; impactMs: number; exitMs: number; exitDirection: 1 | -1 }
}

export function sheepPose(pass: SheepPass, progress: number) {
  let distance = progress, facing = pass.direction, hopProgress = progress, still = false
  let drop = 0, impact = 0
  if (pass.fall) {
    const { landing, descendMs, impactMs, exitMs, exitDirection } = pass.fall
    const elapsed = progress * pass.travel
    if (elapsed < descendMs) {
      const t = elapsed / descendMs
      distance = landing
      drop = 154 * (1 - t) * (1 - t)
      facing = exitDirection
      hopProgress = 0
    } else if (elapsed < descendMs + impactMs) {
      distance = landing
      impact = (elapsed - descendMs) / impactMs
      facing = exitDirection
      hopProgress = 0
      still = true
    } else {
      const t = Math.min(1, (elapsed - descendMs - impactMs) / exitMs)
      distance = landing + (exitDirection === 1 ? 1 - landing : -landing) * t
      facing = exitDirection
      hopProgress = t
    }
  } else if (pass.motion) {
    const { mark, pauseMs, returnToStart, crossingMs } = pass.motion
    const elapsed = progress * pass.travel, arrival = mark * crossingMs
    if (elapsed < arrival) {
      distance = elapsed / crossingMs
      hopProgress = elapsed / arrival
    } else if (elapsed < arrival + pauseMs) {
      distance = mark
      hopProgress = 0
      still = true
    } else {
      const beyond = (elapsed - arrival - pauseMs) / crossingMs
      distance = returnToStart ? mark - beyond : mark + beyond
      hopProgress = beyond / (returnToStart ? mark : 1 - mark)
      if (returnToStart) facing = pass.direction === 1 ? -1 : 1
    }
  }
  const run = Math.max(0, Math.min(1, distance))
  return { run: pass.fall || pass.direction === 1 ? run : 1 - run, facing, hopProgress, still, drop, impact }
}

function randomGenerator(initial: number) {
  let state = initial >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ state >>> 15, state | 1)
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61)
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296
  }
}

export function makeFlock(seed: number, round: number, version: FlockVersion = CURRENT_FLOCK): SheepPass[] {
  const level = difficulty(round), count = flockCount(seed, round, version)
  const random = randomGenerator(seed ^ Math.imul(round, 0x9e3779b9))
  const duration = flockDuration(round, version)
  const firstDirection = random() < .5 ? -1 : 1
  if (version === 1) {
    const gap = (duration - 1920) / (count - 1)
    return Array.from({ length: count }, (_, i) => ({
      at: 240 + gap * (i + (i > 0 && i < count - 1 ? random() * (level > 3 ? .68 : .26) : 0)),
      travel: 1260 - level * 40 + random() * 240,
      lane: (i + Math.floor(i / 3)) % 3,
      direction: (i % 2 ? -firstDirection : firstDirection) as 1 | -1,
      size: .87 + random() * .24,
      bounce: 24 + random() * 24 + level * 1.4,
      fleece: Math.floor(random() * 4),
      hops: random() < .38 ? 2 : 1,
    }))
  }

  const offset = Math.floor(random() * 7)
  const speedFactor = version === 4 ? 1 + Math.max(0, round - 1) * .3 : 1
  const flock = Array.from({ length: count }, (_, i): SheepPass => {
    const pattern = (i + offset) % 7
    const falling = version >= 3 && level >= 2 && (i + offset) % 5 === 0
    const earlyChallenge = level >= (version >= 3 ? 1 : 2)
    const linger = earlyChallenge && (pattern === 2 || pattern === 5)
    const returnToStart = earlyChallenge && pattern === 4 || level >= 7 && pattern === 6
    const slow = pattern === 0 || earlyChallenge && pattern === 3
    const crossingMs = (slow ? 2580 + random() * 620 : 1790 + random() * 420) / speedFactor
    const mark = .39 + random() * .24
    const pauseMs = (linger ? 650 + random() * 660 : returnToStart ? 210 + random() * 260 : 0) / speedFactor
    const fall = falling ? {
      landing: .07 + random() * .86,
      descendMs: (460 + random() * 230) / speedFactor,
      impactMs: (340 + random() * 280) / speedFactor,
      exitMs: (2050 + random() * 620) / speedFactor,
      exitDirection: (random() < .5 ? -1 : 1) as 1 | -1,
    } : undefined
    return {
      at: 0,
      travel: fall ? fall.descendMs + fall.impactMs + fall.exitMs : crossingMs * (returnToStart ? mark * 2 : 1) + pauseMs,
      fall,
      motion: !fall && pauseMs ? { crossingMs, mark, pauseMs, returnToStart } : undefined,
      lane: fall ? Math.floor(random() * 3) : (i + Math.floor(i / 3)) % 3,
      direction: (i % 2 ? -firstDirection : firstDirection) as 1 | -1,
      size: .9 + random() * .2,
      bounce: 19 + random() * 24,
      fleece: i % 4,
      hops: random() < .38 ? 2 : 1,
    }
  })
  // Space the entrances and leave enough room for the longest route to finish.
  const gap = (duration - 640 - Math.max(...flock.map(pass => pass.travel))) / (count - 1)
  flock.forEach((pass, i) => {
    pass.at = 320 + gap * (i + (i > 0 && i < count - 1 ? random() * .28 : 0))
  })
  return flock
}
