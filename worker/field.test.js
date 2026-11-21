import test from 'node:test'
import assert from 'node:assert/strict'
import { field, neighbors, clueRoute, revealSafeArea } from './field.js'
import { flag, move, runner, settle } from './race.js'

test('largada, pistas e rotas em 800 combinações de campo e semente', () => {
  for (let s = 0; s < 80; s++) for (let stage = 1; stage <= 10; stage++) {
    const board = field(String(s), stage)
    const { cols, rows, initial, mines, clues } = board
    const entry = new Set(initial)
    assert.equal(entry.size, Math.round(cols * rows / 12))
    assert.ok(initial.some(i => i >= cols * (rows-1)))
    assert.ok(initial.every(i => !mines.has(i)))
    assert.ok(initial.some(i => clues[i] === 0 && neighbors(i,cols,rows).some(n => !entry.has(n) && !mines.has(n))))
    const connected = new Set([initial[0]])
    for (const i of connected) for (const n of neighbors(i,cols,rows)) if (entry.has(n)) connected.add(n)
    assert.equal(connected.size, entry.size)
    for (const i of connected) for (const n of neighbors(i,cols,rows)) if (!mines.has(n)) connected.add(n)
    assert.ok([...connected].some(i => i < cols))
    if (stage <= 3) assert.ok(clueRoute(board))
  }
})
const seed = 'corrida'
const board = field(seed, 1)
const room = () => ({ starts: 100, ends: 120100, scores: [0,0], phase: 'running', winner: -1 })
const top = [...Array(board.cols).keys()].find(i => !board.mines.has(i) && !board.mines.has(i + board.cols))
const nearFinish = () => ({ ...runner(board), steps: 1, open: { [top + board.cols]: board.clues[top + board.cols] } })
test('travessia a 1 ms do fim decide no tempo regulamentar', () => {
  const r = room()
  move(r, nearFinish(), 0, seed, { cell: top, revision: 0 }, r.ends-1)
  settle(r, r.ends)
  assert.equal(r.winner, 0)
})
test('na prorrogação vence a primeira chegada aceita entre duas quase simultâneas', () => {
  const r = { ...room(), phase: 'overtime' }
  const first = nearFinish(), second = nearFinish()
  assert.ok(move(r, first, 1, seed, { cell: top, revision: 0 }, 121000))
  assert.equal(r.phase, 'finished')
  assert.equal(r.winner, 1)
  assert.equal(move(r, second, 0, seed, { cell: top, revision: 0 }, 121001), null)
  assert.equal(r.winner, 1)
})
test('a primeira jogada é fixa e segura; a bandeira pode ser removida', () => {
  const r = room(), p = runner(board)
  assert.ok(!board.mines.has(p.firstStep))
  assert.equal(move(r, p, 0, seed, { cell: p.firstStep + 1, revision: 0 }, 101), null)
  const markedStart = flag(p, p.firstStep, true)
  assert.equal(move(r, markedStart, 0, seed, { cell: p.firstStep, revision: 0 }, 101), null)
  const opened = move(r, flag(markedStart, p.firstStep, false), 0, seed, { cell: p.firstStep, revision: 0 }, 101)
  assert.equal(opened.steps, 1)
  assert.ok(Object.keys(opened.open).every(cell => !board.mines.has(Number(cell))))
  const outside = p.firstStep - board.cols
  const marked = flag(p, outside, true)
  assert.equal(marked.flags[outside], true)
  assert.equal(flag(marked, outside, false).flags[outside], undefined)
})
test('abrir um zero revela a área segura vizinha em cadeia', () => {
  const zero = board.initial.find(cell => board.clues[cell] === 0)
  const safeNeighbor = neighbors(zero, board.cols, board.rows, true)
    .find(cell => !board.initial.includes(cell) && !board.mines.has(cell))
  const opened = revealSafeArea(board, runner(board).open, zero, { [safeNeighbor]: true })
  assert.equal(Object.hasOwn(opened, safeNeighbor), false)
  for (const cell of neighbors(zero, board.cols, board.rows, true)) {
    assert.ok(board.mines.has(cell) || cell === safeNeighbor || Object.hasOwn(opened, cell))
  }
  assert.ok(Object.keys(opened).every(cell => !board.mines.has(Number(cell))))
})
test('explosão conserva mapa, bloqueio e prorrogação', () => {
  const r = room(), bomb = [...board.mines][0]
  const next = neighbors(bomb,board.cols,board.rows).find(i => !board.mines.has(i))
  const p = move(r, { ...runner(board), steps: 1, open: { [next]: board.clues[next] } }, 1, seed, { revision: 0, cell: bomb }, r.ends-1)
  assert.deepEqual(p.open, runner(board).open)
  settle(r, r.ends)
  assert.equal(r.phase, 'overtime')
  const cell = p.firstStep
  assert.equal(move(r,p,1,seed,{revision:1,cell},p.blockedUntil-1),null)
  assert.ok(move(r,p,1,seed,{revision:1,cell},p.blockedUntil))
})
