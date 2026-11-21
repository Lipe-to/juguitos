import { expect, it } from 'vitest'
import { flockCount, flockDuration, judgeRound, makeFlock, tempo } from './engine'

it('gives both clients the same complete flock, crossing in both directions', () => {
  for (let seed = 0; seed < 30; seed++) {
    for (const round of [1, 2, 7, 13, 50]) {
      const flock = makeFlock(seed, round)
      expect(flock).toEqual(makeFlock(seed, round))
      expect(flock).toHaveLength(flockCount(seed, round))
      expect(new Set(flock.map(s => s.direction))).toEqual(new Set([-1, 1]))
      expect(flock.every(s => s.at > 0 && s.at + s.travel < flockDuration(round))).toBe(true)
    }
  }
})

it('gives later rounds more time for a bigger flock and limits the music tempo', () => {
  expect(flockCount(1800, 13)).toBeGreaterThan(flockCount(1800, 1))
  expect(flockDuration(13)).toBeGreaterThan(flockDuration(1))
  expect(tempo(13)).toBeGreaterThan(tempo(1))
  expect(tempo(400)).toBeGreaterThan(tempo(13))
})

it('only removes one life from the less accurate player, including their last life', () => {
  expect(judgeRound(12, { p1: 11, p2: 16 }, { p1: 3, p2: 1 })).toEqual({ loser: 'p2', lives: { p1: 3, p2: 0 } })
  expect(judgeRound(8, { p1: null, p2: 99 }, { p1: 1, p2: 3 }).lives).toEqual({ p1: 0, p2: 3 })
})

it('does not remove lives for equal distances or two timeouts', () => {
  const lives = { p1: 2, p2: 1 }
  expect(judgeRound(10, { p1: 8, p2: 12 }, lives)).toEqual({ loser: null, lives })
  expect(judgeRound(10, { p1: null, p2: null }, lives)).toEqual({ loser: null, lives })
})
