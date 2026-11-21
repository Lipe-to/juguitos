export const BOARD_SIZE = 7
export const DEFAULT_TARGET_SCORE = 15
export const COMMON_CRYSTALS = 6
export const SPECIAL_CRYSTALS = 2

export type PlayerId = 'p1' | 'p2'
export type Direction = 'up' | 'down' | 'left' | 'right'
export type Action = { kind: 'stay' } | { kind: 'move'; direction: Direction; jump?: boolean }
export type Position = { x: number; y: number }
export type Wall = Position
export type Trail = Position & { expiresBeforeRound: number; owner: PlayerId }
export type Crystal = Position & { id: string; value: 1 | 2 }
export type Duel = {
  id: string
  stage: number
  center: number
  width: number
  periodMs: number
  actions: Record<PlayerId, Action>
}
export type DuelAttempt = { position: number | null }
export type GameState = {
  seed: number
  rngState: number
  refillCount: number
  mapId: number
  round: number
  positions: Record<PlayerId, Position>
  scores: Record<PlayerId, number>
  jumps: Record<PlayerId, boolean>
  trails: Trail[]
  crystals: Crystal[]
  finished: boolean
  targetScore: number
  duel: Duel | null
  lastDuel: { winner: PlayerId; turn: number } | null
}
export type GameEvent =
  | { type: 'moved'; player: PlayerId; from: Position; to: Position; jumped: boolean }
  | { type: 'blocked'; player: PlayerId }
  | { type: 'collision' }
  | { type: 'duel-won'; player: PlayerId }
  | { type: 'collected'; player: PlayerId; crystalId: string; value: number }
  | { type: 'round-finished'; round: number }
  | { type: 'game-finished'; winner: PlayerId | 'draw'; scores: Record<PlayerId, number> }

export const MAP_WALLS: Wall[][] = [
  [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 4 }, { x: 4, y: 4 }],
  [{ x: 2, y: 1 }, { x: 4, y: 1 }, { x: 2, y: 5 }, { x: 4, y: 5 }],
  [{ x: 1, y: 2 }, { x: 5, y: 2 }, { x: 1, y: 4 }, { x: 5, y: 4 }, { x: 3, y: 3 }],
  [{ x: 2, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 1 }, { x: 3, y: 5 }],
  [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 4 }, { x: 4, y: 4 }, { x: 3, y: 3 }],
]

const DIRECTIONS: Record<Direction, Position> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
}

export function nextRandom(state: number): { value: number; state: number } {
  let next = (state + 0x6d2b79f5) >>> 0
  let value = next
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return { value: ((value ^ (value >>> 14)) >>> 0) / 4294967296, state: next }
}

function pick<T>(items: T[], state: number): { item: T; state: number } {
  const random = nextRandom(state)
  return { item: items[Math.floor(random.value * items.length)], state: random.state }
}

const same = (a: Position, b: Position) => a.x === b.x && a.y === b.y
const key = (p: Position) => `${p.x},${p.y}`
const inside = (p: Position) => p.x >= 0 && p.x < BOARD_SIZE && p.y >= 0 && p.y < BOARD_SIZE

export function validateMaps(): string[] {
  const errors: string[] = []
  MAP_WALLS.forEach((walls, mapId) => {
    const wallKeys = new Set(walls.map(key))
    for (const wall of walls) {
      if (!walls.some((other) => other.x === BOARD_SIZE - 1 - wall.x && other.y === wall.y)) errors.push(`Mapa ${mapId + 1}: assimetria em ${key(wall)}`)
    }
    if (wallKeys.has('0,3') || wallKeys.has('6,3')) errors.push(`Mapa ${mapId + 1}: posição inicial bloqueada`)
    const free = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => ({ x: i % BOARD_SIZE, y: Math.floor(i / BOARD_SIZE) })).filter((p) => !wallKeys.has(key(p)))
    if (free.length < 5) errors.push(`Mapa ${mapId + 1}: poucas casas livres`)
    const seen = new Set<string>(['0,3'])
    const queue = [{ x: 0, y: 3 }]
    for (const p of queue) for (const delta of Object.values(DIRECTIONS)) {
      const n = { x: p.x + delta.x, y: p.y + delta.y }
      if (inside(n) && !wallKeys.has(key(n)) && !seen.has(key(n))) { seen.add(key(n)); queue.push(n) }
    }
    if (seen.size !== free.length || !seen.has('6,3')) errors.push(`Mapa ${mapId + 1}: região isolada`)
    const crystalPairExists = free.some((p) => p.x < 3 && free.some((q) => q.x === 6 - p.x && q.y === p.y))
    const centralCrystalExists = free.some((p) => p.x === 3 && !same(p, { x: 0, y: 3 }) && !same(p, { x: 6, y: 3 }))
    if (!crystalPairExists || !centralCrystalExists) errors.push(`Mapa ${mapId + 1}: sem posições iniciais válidas para cristais`)
  })
  return errors
}

function freeCells(state: GameState, includeTrails = true): Position[] {
  const walls = new Set(MAP_WALLS[state.mapId].map(key))
  const trails = new Set(includeTrails ? state.trails.map(key) : [])
  const occupied = new Set([key(state.positions.p1), key(state.positions.p2)])
  const crystals = new Set(state.crystals.map(key))
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => ({ x: i % BOARD_SIZE, y: Math.floor(i / BOARD_SIZE) }))
    .filter((p) => !walls.has(key(p)) && !trails.has(key(p)) && !occupied.has(key(p)) && !crystals.has(key(p)))
}

function createCrystals(seed: number, mapId: number, positions: Record<PlayerId, Position>): { crystals: Crystal[]; rngState: number } {
  const walls = new Set(MAP_WALLS[mapId].map(key))
  let rngState = seed || 1
  const pairs: Position[][] = []
  for (let y = 0; y < BOARD_SIZE; y++) for (let x = 0; x < 3; x++) {
    const left = { x, y }, right = { x: 6 - x, y }
    if (!walls.has(key(left)) && !walls.has(key(right)) && !same(left, positions.p1) && !same(right, positions.p2)) pairs.push([left, right])
  }
  const crystals: Crystal[] = []
  for (let pair = 0; pair < 4; pair++) {
    const chosen = pick(pairs, rngState); rngState = chosen.state
    pairs.splice(pairs.indexOf(chosen.item), 1)
    chosen.item.forEach((position, index) => crystals.push({ ...position, id: `c${pair * 2 + index}`, value: pair === 3 ? 2 : 1 }))
  }
  return { crystals, rngState }
}

export function createGame(seed: number, previousMapId?: number, targetScore = DEFAULT_TARGET_SCORE): GameState {
  const normalizedSeed = seed >>> 0 || 1
  const availableMaps = MAP_WALLS.map((_, index) => index).filter((id) => id !== previousMapId)
  const mapPick = pick(availableMaps.length ? availableMaps : MAP_WALLS.map((_, index) => index), normalizedSeed)
  const positions: Record<PlayerId, Position> = { p1: { x: 0, y: 3 }, p2: { x: 6, y: 3 } }
  const generated = createCrystals(normalizedSeed, mapPick.item, positions)
  return { seed: normalizedSeed, rngState: generated.rngState, refillCount: 0, mapId: mapPick.item, round: 1, positions, scores: { p1: 0, p2: 0 }, jumps: { p1: true, p2: true }, trails: [], crystals: generated.crystals, finished: false, targetScore: normalizeTargetScore(targetScore), duel: null, lastDuel: null }
}

export function normalizeTargetScore(value: number): number {
  return Number.isFinite(value) ? Math.max(5, Math.min(100, Math.round(value))) : DEFAULT_TARGET_SCORE
}

export function duelParameters(seed: number, turn: number, stage: number) {
  const initialSide = nextRandom(seed ^ turn).value < .5 ? 0 : 1
  const side = (initialSide + stage) % 2
  const random = nextRandom((seed ^ Math.imul(turn, 7919) ^ Math.imul(stage + 1, 104729)) >>> 0).value
  return { center: (side ? .58 : .18) + random * .24, width: Math.max(.07, .28 * .8 ** stage), periodMs: Math.max(300, Math.round(2600 * .65 ** stage)) }
}

export function duelCursor(elapsedMs: number, periodMs: number): number {
  const progress = Math.max(0, elapsedMs) % periodMs / periodMs
  return progress < .5 ? progress * 2 : 2 - progress * 2
}

export function normalizeAction(action: Action, jumpAvailable: boolean): Action {
  return action.kind === 'move' ? { ...action, jump: jumpAvailable && !!action.jump } : action
}

type PlannedMove = { from: Position; to: Position; action: Action; valid: boolean }

function plan(state: GameState, player: PlayerId, action: Action): PlannedMove {
  action = normalizeAction(action, state.jumps[player])
  const from = state.positions[player]
  if (action.kind === 'stay') return { from, to: from, action, valid: true }
  const delta = DIRECTIONS[action.direction]
  const distance = action.jump ? 2 : 1
  const to = { x: from.x + delta.x * distance, y: from.y + delta.y * distance }
  const walls = new Set(MAP_WALLS[state.mapId].map(key))
  const trails = new Set(state.trails.map(key))
  const valid = inside(to)
    && !walls.has(key(to))
    && !trails.has(key(to))
  return { from, to, action, valid }
}

export function resolveRound(current: GameState, actions: Record<PlayerId, Action>, duelWinner?: PlayerId): { state: GameState; events: GameEvent[] } {
  if (current.finished || (current.duel && !duelWinner)) return { state: current, events: [] }
  const round = current.round
  const state: GameState = { ...current, targetScore: current.targetScore ?? DEFAULT_TARGET_SCORE, duel: null, lastDuel: current.lastDuel ?? null, positions: { ...current.positions }, scores: { ...current.scores }, jumps: { ...current.jumps }, trails: current.trails.filter((t) => t.expiresBeforeRound > round).map((t) => ({ ...t })), crystals: current.crystals.map((c) => ({ ...c })) }
  const events: GameEvent[] = []
  const moves = { p1: plan(state, 'p1', actions.p1), p2: plan(state, 'p2', actions.p2) }
  if (!moves.p1.valid) events.push({ type: 'blocked', player: 'p1' })
  if (!moves.p2.valid) events.push({ type: 'blocked', player: 'p2' })
  const collision = (moves.p1.valid && moves.p2.valid && same(moves.p1.to, moves.p2.to))
    || (moves.p1.valid && !same(moves.p1.from, moves.p1.to) && same(moves.p1.to, moves.p2.from))
    || (moves.p2.valid && !same(moves.p2.from, moves.p2.to) && same(moves.p2.to, moves.p1.from))
  const success: Record<PlayerId, boolean> = { p1: moves.p1.valid, p2: moves.p2.valid }
  const contestedCrystal = moves.p1.valid && moves.p2.valid
    && !same(moves.p1.from, moves.p1.to) && !same(moves.p2.from, moves.p2.to)
    && same(moves.p1.to, moves.p2.to)
    && state.crystals.some((crystal) => same(crystal, moves.p1.to))
  if (collision) {
    events.push({ type: 'collision' })
    if (contestedCrystal && !duelWinner) {
      state.duel = { id: `${state.seed}_${round}`, stage: 0, actions, ...duelParameters(state.seed, round, 0) }
      return { state, events }
    }
    if (contestedCrystal && duelWinner) {
      const loser = duelWinner === 'p1' ? 'p2' : 'p1'
      success[loser] = false
      state.scores[duelWinner]++
      state.lastDuel = { winner: duelWinner, turn: round }
      events.push({ type: 'duel-won', player: duelWinner })
    } else {
      if (same(moves.p1.to, moves.p2.to)) success.p1 = success.p2 = false
      for (const player of ['p1', 'p2'] as const) {
        const other = player === 'p1' ? 'p2' : 'p1'
        if (same(moves[player].to, moves[other].from)) success[player] = false
        if (moves[player].valid && !success[player]) events.push({ type: 'blocked', player })
      }
    }
  }
  for (const player of ['p1', 'p2'] as const) {
    const move = moves[player]
    if (!success[player] || same(move.from, move.to)) continue
    state.positions[player] = move.to
    if (move.action.kind === 'move' && move.action.jump) state.jumps[player] = false
    events.push({ type: 'moved', player, from: move.from, to: move.to, jumped: move.action.kind === 'move' && !!move.action.jump })
  }
  for (const player of ['p1', 'p2'] as const) {
    const move = moves[player]
    if (success[player] && !same(move.from, move.to) && !same(move.from, state.positions.p1) && !same(move.from, state.positions.p2)) state.trails.push({ ...move.from, expiresBeforeRound: round + 3, owner: player })
  }
  for (const player of ['p1', 'p2'] as const) {
    if (!success[player] || same(moves[player].from, moves[player].to)) continue
    const index = state.crystals.findIndex((crystal) => same(crystal, state.positions[player]))
    if (index >= 0) {
      const [crystal] = state.crystals.splice(index, 1)
      state.scores[player] += crystal.value
      events.push({ type: 'collected', player, crystalId: crystal.id, value: crystal.value })
    }
  }
  state.finished = state.scores.p1 >= state.targetScore || state.scores.p2 >= state.targetScore
  if (!state.finished) {
    for (const value of [2, 1] as const) while (state.crystals.filter((c) => c.value === value).length < (value === 2 ? SPECIAL_CRYSTALS : COMMON_CRYSTALS)) {
      const candidates = freeCells(state)
      if (!candidates.length) break
      const preferred = candidates.filter((p) => Math.abs(p.x - 3) + Math.abs(p.y - 3) <= 4 && Math.abs(p.x - state.positions.p1.x) + Math.abs(p.y - state.positions.p1.y) > 1 && Math.abs(p.x - state.positions.p2.x) + Math.abs(p.y - state.positions.p2.y) > 1)
      const selectedFrom = preferred.length ? preferred : candidates
      const chosen = pick(selectedFrom, state.rngState); state.rngState = chosen.state
      state.refillCount++
      state.crystals.push({ ...chosen.item, id: `r${round}-${state.refillCount}`, value })
    }
  }
  state.round = round + 1
  if (state.finished) {
    const winner = state.scores.p1 === state.scores.p2 ? 'draw' : state.scores.p1 > state.scores.p2 ? 'p1' : 'p2'
    events.push({ type: 'game-finished', winner, scores: { ...state.scores } })
  } else events.push({ type: 'round-finished', round })
  return { state, events }
}

export function resolveDuel(current: GameState, attempts: Record<PlayerId, DuelAttempt>): { state: GameState; events: GameEvent[] } {
  if (!current.duel || current.finished) return { state: current, events: [] }
  const duel = current.duel
  const distance = (attempt: DuelAttempt) => attempt.position !== null && Number.isFinite(attempt.position) && attempt.position >= 0 && attempt.position <= 1 ? Math.abs(attempt.position - duel.center) : 2
  const p1 = distance(attempts.p1), p2 = distance(attempts.p2)
  if ((p1 <= duel.width / 2 && p2 <= duel.width / 2) || Math.abs(p1 - p2) < .00001) {
    const stage = duel.stage + 1
    return { state: { ...current, duel: { ...duel, stage, ...duelParameters(current.seed, current.round, stage) } }, events: [] }
  }
  return resolveRound(current, duel.actions, p1 < p2 ? 'p1' : 'p2')
}

export function winnerOf(state: GameState): PlayerId | 'draw' | null {
  if (!state.finished) return null
  return state.scores.p1 === state.scores.p2 ? 'draw' : state.scores.p1 > state.scores.p2 ? 'p1' : 'p2'
}

export function positionsEqual(a: Position, b: Position): boolean { return same(a, b) }
