import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMinePractice } from './minas/practice'
import { neighbors } from './minas/field-core.ts'
import { createSheepPractice } from './ovelhas/practice'
import { CURRENT_FLOCK, flockCount, flockDuration, READY_MS, REVEAL_MS } from './ovelhas/engine'
import { createRastroPractice } from './rastro/practice'
import { PRACTICE_CODE, PRACTICE_USER } from './practice'
import type { Room } from './rastro/multiplayer'
import type { SheepRoom } from './ovelhas/online'

afterEach(() => vi.useRealTimers())

describe('sala fixa de treino', () => {
  it('resolve a jogada do RASTRO com um segundo jogador local', async () => {
    const session = createRastroPractice()
    let room: Room | null = null
    const stop = session.subscribeRoom(PRACTICE_CODE, next => { room = next })
    await session.updateTargetScore(PRACTICE_CODE, PRACTICE_USER, 5)
    await session.startRoom()
    const start = room!.game!
    await session.submitAction(PRACTICE_CODE, PRACTICE_USER, { kind: 'stay' })
    expect(room!.game!.targetScore).toBe(5)
    expect(room!.game!.round).toBe(2)
    expect(room!.game!.positions.p2).not.toEqual(start.positions.p2)
    stop()
  })

  it('revela os dois palpites de Ovelhas e avança a rodada', async () => {
    vi.useFakeTimers()
    const session = createSheepPractice()
    let room: SheepRoom | null = null
    const stop = session.watchSheepRoom(PRACTICE_CODE, next => { room = next })
    await session.startSheepMatch(PRACTICE_CODE, PRACTICE_USER)
    const turn = room!
    await vi.advanceTimersByTimeAsync(READY_MS + flockDuration(1, CURRENT_FLOCK) + 1300)
    expect(room!.sent.p2).toBe(true)
    expect(room!.last).toBeNull()
    await session.sendGuess(PRACTICE_CODE, PRACTICE_USER, turn, flockCount(turn.seed, 1))
    const clock = await session.syncClock(PRACTICE_USER)
    await session.settleSheepRound(PRACTICE_CODE, turn, clock)
    expect(room!.phase).toBe('result')
    expect(room!.lives).toEqual({ p1: 3, p2: 2 })
    await vi.advanceTimersByTimeAsync(REVEAL_MS)
    await session.nextSheepRound(PRACTICE_CODE, turn, clock)
    expect(room!.round).toBe(2)
    expect(room!.sent.p2).toBe(false)
    stop()
  })

  it('mantém o primeiro campo jogável no Campo Minado e o bot marca pontos', async () => {
    vi.useFakeTimers()
    const session = createMinePractice()
    const lobby = await session.joinRoom(PRACTICE_CODE)
    expect(lobby.room.playerCount).toBe(2)
    const start = await session.startRace(PRACTICE_CODE)
    expect(start.room.phase).toBe('countdown')
    const { open, cols, rows, revision } = start.player
    expect(Object.keys(open)).toHaveLength(2)
    const zero = Number(Object.keys(open).find(cell => open[cell] === 0))
    const safe = neighbors(zero, cols, rows).find(cell => !Object.hasOwn(open, cell))!
    await vi.advanceTimersByTimeAsync(3000)
    const first = await session.openCell(PRACTICE_CODE, safe, revision)
    expect(first.player.steps).toBe(1)
    expect(first.player.bomb).toBe(-1)
    for (let i = 0; i < 17; i++) {
      await vi.advanceTimersByTimeAsync(7000)
      await session.roomState(PRACTICE_CODE)
    }
    await vi.advanceTimersByTimeAsync(1000)
    const end = await session.roomState(PRACTICE_CODE)
    expect(end.room.scores[1]).toBeGreaterThan(0)
    expect(end.room.phase).toBe('finished')
    expect((await session.reset()).room.phase).toBe('waiting')
  })
})
