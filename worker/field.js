import { createHash } from 'node:crypto'

function randomSource(seed, stage) {
  let state = createHash('sha256').update(seed + ':' + stage).digest().readUInt32LE()
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function neighbors(id, cols, rows, diagonal = false) {
  const cells = []
  const x = id % cols, y = Math.floor(id / cols)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || (!diagonal && dx && dy)) continue
      if (x + dx >= 0 && x + dx < cols && y + dy >= 0 && y + dy < rows) {
        cells.push((y + dy) * cols + x + dx)
      }
    }
  }
  return cells
}

// Only use visible clues. An unknown neighbor is safe once all mines
// around its clue are accounted for. Only side-adjacent cells can open.
export function clueRoute({ cols, rows, initial, clues }) {
  const open = new Set(initial), flagged = new Set(), safe = new Set()
  for (;;) {
    const before = open.size + flagged.size
    for (const id of open) {
      const around = neighbors(id, cols, rows, true)
      const unknown = around.filter(n => !open.has(n) && !flagged.has(n))
      const left = clues[id] - around.filter(n => flagged.has(n)).length
      if (left === 0) unknown.forEach(n => safe.add(n))
      else if (left === unknown.length) unknown.forEach(n => flagged.add(n))
      for (const n of neighbors(id, cols, rows)) {
        if (safe.has(n)) {
          if (n < cols) return true
          open.add(n)
        }
      }
    }
    if (before === open.size + flagged.size) return false
  }
}

export function revealSafeArea(board, opened, firstCell, flags = {}) {
  const next = { ...opened }
  const pending = [firstCell]
  const visited = new Set()

  while (pending.length) {
    const cell = pending.pop()
    if (visited.has(cell) || board.mines.has(cell) || flags[cell]) continue
    visited.add(cell)
    next[cell] = board.clues[cell]
    if (board.clues[cell] === 0) {
      for (const neighbor of neighbors(cell, board.cols, board.rows, true)) {
        if (!visited.has(neighbor) && !board.mines.has(neighbor) && !flags[neighbor]) pending.push(neighbor)
      }
    }
  }

  return next
}

export function field(seed, stage) {
  const cols = stage + 3, rows = 2 * stage + 4, size = cols * rows
  const random = randomSource(seed, stage)
  const count = Math.round(size / 24), initial = []
  for (let remaining = count, y = rows - 1; remaining > 0; y--) {
    const width = Math.min(cols, remaining)
    const start = Math.floor(random() * (cols - width + 1))
    for (let x = start; x < start + width; x++) initial.push(y * cols + x)
    remaining -= width
  }
  const start = initial.at(-1)
  const firstRow = Math.floor(start / cols) - 1
  const firstRowCells = Array.from({ length: cols }, (_, x) => firstRow * cols + x)
  const protectedCells = new Set([...initial, ...neighbors(start, cols, rows, true), ...firstRowCells])
  let x = start % cols
  const path = [start]
  for (let y = firstRow; y >= 0; y--) {
    path.push(y * cols + x)
    x = Math.max(0, Math.min(cols - 1, x + Math.floor(random() * 3) - 1))
    path.push(y * cols + x)
  }
  path.forEach(id => protectedCells.add(id))
  for (let attempt = 0; ; attempt++) {
    if (attempt === 24) {
      for (const id of path) neighbors(id, cols, rows, true).forEach(n => protectedCells.add(n))
    }
    const candidates = Array.from({ length: size }, (_, i) => i).filter(i => !protectedCells.has(i))
    const mines = new Set()
    const target = Math.min(candidates.length, Math.round(size * Math.min(.20, .12 + stage * .01)))
    for (let i = 0; i < target; i++) {
      const j = i + Math.floor(random() * (candidates.length - i))
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
      mines.add(candidates[i])
    }
    const clues = Array.from({ length: size }, (_, i) =>
      neighbors(i, cols, rows, true).filter(n => mines.has(n)).length)
    const board = { cols, rows, initial, mines, mineCount: mines.size, clues, firstRow }
    if (stage > 3 || clueRoute(board)) return board
  }
}
