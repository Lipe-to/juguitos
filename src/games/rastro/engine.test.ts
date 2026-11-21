import { describe, expect, it } from 'vitest'
import { createGame, duelCursor, MAP_WALLS, nextRandom, resolveDuel, resolveRound, validateMaps, type Action, type GameState, type Position } from './engine'

const stay: Action = { kind: 'stay' }
const move = (direction: 'up' | 'down' | 'left' | 'right', jump = false): Action => ({ kind: 'move', direction, jump })
function state(overrides: Partial<GameState> = {}): GameState {
  return { ...createGame(25), mapId: 0, positions: { p1: { x: 0, y: 3 }, p2: { x: 6, y: 3 } }, crystals: [], trails: [], ...overrides }
}
function resolve(s: GameState, p1: Action, p2: Action = stay) { return resolveRound(s, { p1, p2 }) }
const pos = (x: number, y: number): Position => ({ x, y })

describe('RASTRO game engine', () => {
  it('moves one cell up', () => expect(resolve(state(), move('up')).state.positions.p1).toEqual(pos(0, 2)))
  it('moves one cell down', () => expect(resolve(state(), move('down')).state.positions.p1).toEqual(pos(0, 4)))
  it('moves one cell right', () => expect(resolve(state(), move('right')).state.positions.p1).toEqual(pos(1, 3)))
  it('does not move when staying', () => expect(resolve(state(), stay).state.positions.p1).toEqual(pos(0, 3)))
  it('blocks movement beyond the board', () => expect(resolve(state(), move('left')).state.positions.p1).toEqual(pos(0, 3)))
  it('blocks a move into a wall', () => expect(resolve(state({ positions: { p1: pos(2, 1), p2: pos(6, 3) } }), move('down')).state.positions.p1).toEqual(pos(2, 1)))
  it('blocks a move into an active trail', () => expect(resolve(state({ trails: [{ ...pos(1, 3), owner: 'p1', expiresBeforeRound: 5 }] }), move('right')).state.positions.p1).toEqual(pos(0, 3)))
  it('removes a trail before its expiry round', () => {
    const result = resolve(state({ round: 2, trails: [{ ...pos(1, 3), owner: 'p1', expiresBeforeRound: 2 }] }), move('right'))
    expect(result.state.positions.p1).toEqual(pos(1, 3)); expect(result.state.trails).toHaveLength(1)
  })
  it('retains a trail through its last blocking round', () => {
    const result = resolve(state({ round: 2, trails: [{ ...pos(1, 3), owner: 'p1', expiresBeforeRound: 4 }] }), move('right'))
    expect(result.state.positions.p1).toEqual(pos(0, 3)); expect(result.state.trails).toHaveLength(1)
  })
  it('creates no trail for a blocked move', () => expect(resolve(state(), move('left')).state.trails).toHaveLength(0))
  it('creates no trail for staying still', () => expect(resolve(state(), stay).state.trails).toHaveLength(0))
  it('does not create trails in a same-destination collision', () => {
    const result = resolve(state({ positions: { p1: pos(2, 3), p2: pos(4, 3) } }), move('right'), move('left'))
    expect(result.state.positions).toEqual({ p1: pos(2, 3), p2: pos(4, 3) }); expect(result.state.trails).toHaveLength(0)
  })
  it('blocks a direct position swap', () => {
    const result = resolve(state({ positions: { p1: pos(2, 3), p2: pos(3, 3) } }), move('right'), move('left'))
    expect(result.state.positions).toEqual({ p1: pos(2, 3), p2: pos(3, 3) })
  })
  it('blocks entry into the opponent’s current cell', () => expect(resolve(state({ positions: { p1: pos(2, 3), p2: pos(3, 3) } }), move('right'), stay).state.positions.p1).toEqual(pos(2, 3)))
  it('allows a jump over an active trail', () => expect(resolve(state({ trails: [{ ...pos(1, 3), owner: 'p2', expiresBeforeRound: 4 }] }), move('right', true)).state.positions.p1).toEqual(pos(2, 3)))
  it('allows a jump over the opponent without a duel or displacement', () => {
    const next = resolve(state({ positions: { p1: pos(0, 3), p2: pos(1, 3) } }), move('right', true)).state
    expect(next.positions).toEqual({ p1: pos(2, 3), p2: pos(1, 3) }); expect(next.duel).toBeNull(); expect(next.jumps.p1).toBe(false)
  })
  it('jumps over an intermediate wall, spending the charge and leaving only the origin trail', () => {
    const next = resolve(state({ positions: { p1: pos(2, 1), p2: pos(6, 3) } }), move('down', true)).state
    expect(next.positions.p1).toEqual(pos(2, 3)); expect(next.jumps.p1).toBe(false)
    expect(next.trails).toEqual([{ ...pos(2, 1), owner: 'p1', expiresBeforeRound: 4 }])
  })
  it('blocks landing on a wall and preserves the jump charge', () => {
    const next = resolve(state({ positions: { p1: pos(2, 0), p2: pos(6, 3) } }), move('down', true)).state
    expect(next.positions.p1).toEqual(pos(2, 0)); expect(next.jumps.p1).toBe(true); expect(next.trails).toHaveLength(0)
  })
  it('does not spend a jump when its destination is blocked', () => expect(resolve(state({ trails: [{ ...pos(2, 3), owner: 'p1', expiresBeforeRound: 4 }] }), move('right', true)).state.jumps.p1).toBe(true))
  it('spends a jump after successful movement', () => expect(resolve(state(), move('right', true)).state.jumps.p1).toBe(false))
  it('collects a crystal on a successful move', () => {
    const result = resolve(state({ crystals: [{ ...pos(1, 3), id: 'test', value: 1 }] }), move('right'))
    expect(result.state.scores.p1).toBe(1); expect(result.state.crystals.some((c) => c.id === 'test')).toBe(false)
  })
  it('collects a special crystal for two points', () => expect(resolve(state({ crystals: [{ ...pos(1, 3), id: 'star', value: 2 }] }), move('right')).state.scores.p1).toBe(2))
  it('replenishes six common and two special crystals while the match continues', () => {
    const result = resolve(state({ crystals: [{ ...pos(1, 3), id: 'test', value: 2 }] }), move('right')).state
    expect(result.crystals).toHaveLength(8)
    expect(result.crystals.filter((c) => c.value === 1)).toHaveLength(6)
    expect(result.crystals.filter((c) => c.value === 2)).toHaveLength(2)
  })
  it('never places replenished crystals on walls, trails, players, or each other', () => {
    const result = resolve(state({ crystals: [{ ...pos(1, 3), id: 'test', value: 1 }], trails: [{ ...pos(4, 3), owner: 'p2', expiresBeforeRound: 4 }] }), move('right'))
    const occupied = [result.state.positions.p1, result.state.positions.p2, ...result.state.trails]
    expect(result.state.crystals.every((c) => !MAP_WALLS[result.state.mapId].some((w) => w.x === c.x && w.y === c.y))).toBe(true)
    expect(result.state.crystals.every((c) => !occupied.some((p) => p.x === c.x && p.y === c.y))).toBe(true)
    expect(new Set(result.state.crystals.map((c) => `${c.x},${c.y}`)).size).toBe(result.state.crystals.length)
  })
  it('validates all five symmetric connected maps and crystal positions', () => expect(validateMaps()).toEqual([]))
  it('creates the same game for the same seed', () => expect(createGame(123456)).toEqual(createGame(123456)))
  it('chooses a different map for a rematch when possible', () => {
    const first = createGame(123); expect(createGame(124, first.mapId).mapId).not.toBe(first.mapId)
  })
  it('continues past 16 moves until someone reaches the goal', () => {
    let current = state()
    for (let i = 0; i < 100; i++) current = resolveRound(current, { p1: stay, p2: stay }).state
    expect(current.finished).toBe(false); expect(current.round).toBe(101)
  })
  it('ends as soon as a player reaches the configured point goal', () => {
    const current = state({ targetScore: 25, scores: { p1: 24, p2: 3 }, crystals: [{ ...pos(1, 3), id: 'finish', value: 2 }] })
    const result = resolve(current, move('right')).state
    expect(result.finished).toBe(true); expect(result.scores.p1).toBe(26)
  })
  it('declares a draw if both reach the same final score simultaneously', () => {
    const current = state({ scores: { p1: 14, p2: 14 }, crystals: [{ ...pos(1, 3), id: 'a', value: 1 }, { ...pos(5, 3), id: 'b', value: 1 }] })
    const result = resolve(current, move('right'), move('left')).state
    expect(result.finished).toBe(true); expect(result.scores).toEqual({ p1: 15, p2: 15 })
  })
  it('does not change an already finished game', () => {
    const finished = state({ finished: true, round: 17 })
    expect(resolve(finished, move('right')).state).toBe(finished)
  })
  it('simulates 1,000 seeded matches without invalid positions or crystals', () => {
    const directions = [move('up'), move('down'), move('left'), move('right'), stay, move('up', true), move('down', true), move('left', true), move('right', true)]
    for (let seed = 1; seed <= 1_000; seed++) {
      let current = createGame(seed)
      let actionSeed = seed ^ 0x51ed270b
      for (let round = 0; round < 16; round++) {
        const a = nextRandom(actionSeed); actionSeed = a.state
        const b = nextRandom(actionSeed); actionSeed = b.state
        current = resolveRound(current, { p1: directions[Math.floor(a.value * directions.length)], p2: directions[Math.floor(b.value * directions.length)] }).state
        if (current.duel) current = resolveDuel(current, { p1: { position: current.duel.center }, p2: { position: null } }).state
        const pieces = [current.positions.p1, current.positions.p2]
        expect(pieces.every((p) => p.x >= 0 && p.x < 7 && p.y >= 0 && p.y < 7)).toBe(true)
        expect(pieces[0]).not.toEqual(pieces[1])
        expect(current.trails.every((trail) => !MAP_WALLS[current.mapId].some((wall) => wall.x === trail.x && wall.y === trail.y))).toBe(true)
        expect(current.crystals.every((crystal) => crystal.x >= 0 && crystal.x < 7 && crystal.y >= 0 && crystal.y < 7)).toBe(true)
        expect(current.crystals.every((crystal) => !MAP_WALLS[current.mapId].some((wall) => wall.x === crystal.x && wall.y === crystal.y))).toBe(true)
        expect(new Set(current.crystals.map((crystal) => `${crystal.x},${crystal.y}`)).size).toBe(current.crystals.length)
      }
    }
  })
  it('distributes the map choice and paired starting crystals across 5,000 seeds', () => {
    const counts = [0, 0, 0, 0, 0]
    for (let seed = 1; seed <= 5_000; seed++) {
      const game = createGame(seed)
      counts[game.mapId]++
      const pair = game.crystals.filter((crystal) => crystal.value === 1).sort((a, b) => a.x - b.x)
      expect(pair).toHaveLength(6)
      expect(pair.every((c) => pair.some((other) => other.x === 6 - c.x && other.y === c.y))).toBe(true)
      const specials = game.crystals.filter((crystal) => crystal.value === 2)
      expect(specials).toHaveLength(2); expect(specials[0].x + specials[1].x).toBe(6); expect(specials[0].y).toBe(specials[1].y)
    }
    expect(counts.every((count) => count > 800 && count < 1_200)).toBe(true)
  })
  it('lets a player walk immediately after spending the jump, including a stale jump selection', () => {
    const jumped = resolve(state(), move('right', true)).state
    expect(jumped.jumps.p1).toBe(false)
    expect(resolve(jumped, move('right', true)).state.positions.p1).toEqual(pos(3, 3))
  })
  it('pauses a shared crystal dispute for a duel without advancing the movement', () => {
    const result = resolve(state({ positions: { p1: pos(2, 3), p2: pos(4, 3) }, crystals: [{ ...pos(3, 3), id: 'dispute', value: 1 }] }), move('right'), move('left')).state
    expect(result.duel).not.toBeNull(); expect(result.round).toBe(1); expect(result.scores).toEqual({ p1: 0, p2: 0 })
    expect(resolve(result, move('up')).state).toBe(result)
  })
  it('speeds up and moves the target when both hit the zone', () => {
    const duel = resolve(state({ positions: { p1: pos(2, 3), p2: pos(4, 3) }, crystals: [{ ...pos(3, 3), id: 'dispute', value: 1 }] }), move('right'), move('left')).state
    const next = resolveDuel(duel, { p1: { position: duel.duel!.center }, p2: { position: duel.duel!.center + .01 } }).state
    expect(next.duel!.stage).toBe(1); expect(next.duel!.periodMs).toBeLessThan(duel.duel!.periodMs)
    expect(next.duel!.width).toBeLessThan(duel.duel!.width); expect(Math.abs(next.duel!.center - duel.duel!.center)).toBeGreaterThan(.15)
    expect(next.round).toBe(duel.round); expect(next.positions).toEqual(duel.positions)
  })
  it('awards the closer miss the crystal and one bonus point', () => {
    const duel = resolve(state({ positions: { p1: pos(2, 3), p2: pos(4, 3) }, crystals: [{ ...pos(3, 3), id: 'dispute', value: 1 }] }), move('right'), move('left')).state
    const center = duel.duel!.center
    const near = center < .5 ? center + .16 : center - .16
    const far = center < .5 ? 1 : 0
    const next = resolveDuel(duel, { p1: { position: near }, p2: { position: far } }).state
    expect(next.duel).toBeNull(); expect(next.scores.p1).toBe(2); expect(next.positions.p1).toEqual(pos(3, 3)); expect(next.positions.p2).toEqual(pos(4, 3)); expect(next.round).toBe(2)
    expect(next.lastDuel).toEqual({ winner: 'p1', turn: 1 }); expect(next.crystals.some((c) => c.id === 'dispute')).toBe(false)
  })
  it('blocks head-on swaps without a duel, points, or consumed jump', () => {
    const next = resolve(state({ positions: { p1: pos(1, 3), p2: pos(3, 3) } }), move('right', true), move('left', true)).state
    expect(next.duel).toBeNull(); expect(next.scores).toEqual({ p1: 0, p2: 0 })
    expect(next.positions).toEqual({ p1: pos(1, 3), p2: pos(3, 3) }); expect(next.trails).toHaveLength(0)
    expect(next.jumps).toEqual({ p1: true, p2: true })
  })
  it('does not award points or open a duel on contact with a stationary opponent', () => {
    const next = resolve(state({ positions: { p1: pos(2, 3), p2: pos(3, 3) }, scores: { p1: 0, p2: 14 } }), move('right'), stay).state
    expect(next.duel).toBeNull(); expect(next.scores.p2).toBe(14); expect(next.finished).toBe(false)
    expect(next.positions).toEqual({ p1: pos(2, 3), p2: pos(3, 3) }); expect(next.lastDuel).toBeNull()
  })
  it('blocks a shared empty destination even when other crystals exist', () => {
    const next = resolve(state({ positions: { p1: pos(2, 3), p2: pos(4, 3) }, crystals: [{ ...pos(3, 1), id: 'elsewhere', value: 2 }] }), move('right'), move('left')).state
    expect(next.duel).toBeNull(); expect(next.scores).toEqual({ p1: 0, p2: 0 })
    expect(next.positions).toEqual({ p1: pos(2, 3), p2: pos(4, 3) }); expect(next.round).toBe(2)
  })
  it('opens a duel for a jump and a normal move toward the same special crystal and can finish the match', () => {
    const duel = resolve(state({ positions: { p1: pos(1, 3), p2: pos(4, 3) }, scores: { p1: 12, p2: 0 }, crystals: [{ ...pos(3, 3), id: 'special', value: 2 }] }), move('right', true), move('left')).state
    const next = resolveDuel(duel, { p1: { position: duel.duel!.center }, p2: { position: null } }).state
    expect(next.scores.p1).toBe(15); expect(next.finished).toBe(true); expect(next.jumps.p1).toBe(false)
    expect(next.lastDuel).toEqual({ winner: 'p1', turn: 1 }); expect(next.positions.p1).toEqual(pos(3, 3))
  })
  it('repeats equal misses and respects the minimum speed and zone size', () => {
    let duel = resolve(state({ positions: { p1: pos(2, 3), p2: pos(4, 3) }, crystals: [{ ...pos(3, 3), id: 'dispute', value: 1 }] }), move('right'), move('left')).state
    for (let stage = 0; stage < 20; stage++) duel = resolveDuel(duel, { p1: { position: null }, p2: { position: null } }).state
    expect(duel.duel!.stage).toBe(20); expect(duel.duel!.periodMs).toBe(300); expect(duel.duel!.width).toBe(.07)
    expect(duelCursor(0, 1000)).toBe(0); expect(duelCursor(500, 1000)).toBe(1); expect(duelCursor(1000, 1000)).toBe(0)
  })
})
