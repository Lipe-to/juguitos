import { practiceSeed } from '../practice'
import { generateField, neighbors, type Field } from './field-core.ts'
import { flag, moveWithFields, runner, settle } from './race-core.ts'
import type { Race, Runner, Snapshot } from './online'

const BOT_MOVE_MS = 7000

function botStep(board: Field, player: Runner): number | undefined {
  const { cols, rows, mines } = board
  const finish = Array.from({ length: cols }, (_, cell) => cell).filter(cell => !mines.has(cell))
  const visited = new Set(finish)
  const queue = [...finish]
  for (const cell of queue) {
    const adjacent: number[] = neighbors(cell, cols, rows)
    if (Object.hasOwn(player.open, cell)) continue
    if (adjacent.some(id => Object.hasOwn(player.open, id))) return cell
    for (const next of adjacent) {
      if (visited.has(next) || mines.has(next)) continue
      visited.add(next)
      queue.push(next)
    }
  }
}

export function createMinePractice() {
  let room: Race, players: [Runner, Runner], version = 0, nextMove = 0
  let playerRevision = -1
  let seed: number
  const fields = new Map<number, ReturnType<typeof generateField>>()
  function fieldForStage(stage: number) {
    const cached = fields.get(stage)
    if (cached) return cached
    let state = (seed ^ Math.imul(stage, 0x9e3779b9)) >>> 0
    const field = generateField(stage, () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 4294967296
    })
    fields.set(stage, field)
    return field
  }
  function reset() {
    fields.clear()
    seed = practiceSeed()
    room = { phase: 'waiting', playerCount: 2, scores: [0, 0], starts: 0, ends: 0, winner: -1 }
    const field = fieldForStage(1)
    players = [runner(field, 1, ++playerRevision), runner(field)]
    version++
  }
  function snapshot(now: number): Snapshot {
    return { room: { ...room, scores: [...room.scores] }, player: players[0], seat: 0, version, now }
  }
  function advance(now: number) {
    if (settle(room, now)) version++
    if ((room.phase !== 'running' && room.phase !== 'overtime') || now < nextMove) return
    nextMove = now + BOT_MOVE_MS
    const bot = players[1]
    const cell = botStep(fieldForStage(bot.stage), bot)
    if (cell === undefined) return
    const updated = moveWithFields(room, bot, 1, { cell, revision: bot.revision }, now, fieldForStage)
    if (updated) { players[1] = updated; version++ }
  }
  async function read(_code: string) {
    const now = Date.now()
    advance(now)
    return snapshot(now)
  }
  reset()
  return {
    joinRoom: read,
    roomState: read,
    async startRace(_code: string) {
      const now = Date.now()
      if (room.phase === 'waiting') {
        room = { ...room, phase: 'countdown', starts: now + 3000, ends: now + 123000 }
        nextMove = room.starts + BOT_MOVE_MS
        version++
      }
      return snapshot(now)
    },
    async openCell(_code: string, cell: number, revision: number) {
      const now = Date.now()
      advance(now)
      const updated = moveWithFields(room, players[0], 0, { cell, revision }, now, fieldForStage)
      if (updated) {
        players[0] = updated
        playerRevision = updated.revision
        version++
      }
      return snapshot(now)
    },
    async setFlag(_code: string, cell: number, flagged: boolean) {
      const now = Date.now()
      advance(now)
      if (room.phase === 'running' || room.phase === 'overtime') {
        const updated = flag(players[0], cell, flagged)
        if (updated) { players[0] = updated; version++ }
      }
      return snapshot(now)
    },
    async reset() {
      reset()
      return snapshot(Date.now())
    },
  }
}
