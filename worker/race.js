import { field, neighbors, revealSafeArea } from './field.js'

export function runner(board, stage = 1, revision = 0) {
  return { stage, revision, cols: board.cols, rows: board.rows,
    open: Object.fromEntries(board.initial.map(i => [i, board.clues[i]])),
    flags: {}, steps: 0, firstStep: board.firstStep, mineCount: board.mineCount,
    blockedUntil: 0, bomb: -1, last: board.initial.at(-1) }
}

export function settle(room, now) {
  let changed = false
  if (room.phase === 'countdown' && now >= room.starts) {
    room.phase = 'running'
    changed = true
  }
  if (room.phase !== 'running' || now < room.ends) return changed
  const [a, b] = room.scores
  room.phase = a === b ? 'overtime' : 'finished'
  if (a !== b) room.winner = a > b ? 0 : 1
  return true
}

export function flag(player, cell, flagged) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= player.cols * player.rows ||
      Object.hasOwn(player.open, cell)) return null
  const flags = { ...(player.flags ?? {}) }
  if (flagged) flags[cell] = true
  else delete flags[cell]
  return { ...player, flags }
}

// Called inside a room transaction, after settling the regulation deadline.
export function move(room, player, seat, seed, action, now) {
  if (!['running', 'overtime'].includes(room.phase) || now < room.starts ||
      now < player.blockedUntil || action.revision !== player.revision) return null
  const id = action.cell
  if (!Number.isInteger(id) || id < 0 || id >= player.cols * player.rows ||
      Object.hasOwn(player.open, id) || player.flags?.[id] ||
      !neighbors(id, player.cols, player.rows).some(n => Object.hasOwn(player.open, n)) ||
      (player.steps === 0 && id !== player.firstStep)) return null
  const board = field(seed, player.stage)
  const revision = player.revision + 1
  if (board.mines.has(id)) return { ...runner(board, player.stage, revision), blockedUntil: now + 5000, bomb: id }
  if (id < board.cols) {
    room.scores[seat]++
    if (room.phase === 'overtime') {
      room.phase = 'finished'
      room.winner = seat
    }
    return runner(field(seed, player.stage + 1), player.stage + 1, revision)
  }
  const flags = { ...(player.flags ?? {}) }
  delete flags[id]
  return { ...player, open: revealSafeArea(board, player.open, id, flags), flags,
    steps: player.steps + 1, revision, last: id, bomb: -1 }
}
