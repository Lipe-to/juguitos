import test from 'node:test'
import assert from 'node:assert/strict'
import { field, neighbors, clueRoute, revealSafeArea } from './field.js'
import { flag, move, runner, settle } from './race.js'

test('largada, pistas e rotas em 800 combinações de campo e semente', () => {
  for (let s = 0; s < 80; s++) for (let stage = 1; stage <= 10; stage++) {
    const board = field(String(s), stage)
    const { cols, rows, initial, mines, clues } = board
    const entry = new Set(initial)
    assert.equal(entry.size, Math.min(3, Math.max(2, Math.round(cols * rows / 24))))
    assert.ok(initial.every(i => i >= cols * (rows-1)))
    assert.ok(initial.every(i => !mines.has(i)))
    assert.ok(initial.some(i => clues[i] === 0 && neighbors(i,cols,rows).some(n => !entry.has(n) && !mines.has(n))))
    const connected = new Set([initial[0]])
    for (const i of connected) for (const n of neighbors(i,cols,rows)) if (entry.has(n)) connected.add(n)
    assert.equal(connected.size, entry.size)
    for (const i of connected) for (const n of neighbors(i,cols,rows)) if (!mines.has(n)) connected.add(n)
    assert.ok([...connected].some(i => i < cols))
    assert.ok(clueRoute(board))
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
test('a partida começa com casas abertas e o primeiro lance respeita a vizinhança', () => {
  const r = room(), p = runner(board)
  assert.equal(Object.keys(p.open).length, Math.max(2, Math.round(p.cols * p.rows / 24)))
  const zero = Object.keys(p.open).map(Number).find(cell => p.open[cell] === 0)
  const safeNeighbor = neighbors(zero, p.cols, p.rows).find(cell => !Object.hasOwn(p.open, cell))
  const outside = Array.from({ length: p.cols * p.rows }, (_, cell) => cell)
    .find(cell => !Object.hasOwn(p.open, cell) && !neighbors(cell, p.cols, p.rows).some(n => Object.hasOwn(p.open, n)))
  assert.equal(move(r, p, 0, seed, { cell: outside, revision: 0 }, 101), null)
  const markedStart = flag(p, safeNeighbor, true)
  assert.equal(move(r, markedStart, 0, seed, { cell: safeNeighbor, revision: 0 }, 101), null)
  const opened = move(r, flag(markedStart, safeNeighbor, false), 0, seed, { cell: safeNeighbor, revision: 0 }, 101)
  assert.equal(opened.steps, 1)
  assert.ok(Object.keys(opened.open).every(cell => !board.mines.has(Number(cell))))
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
test('uma abertura em cadeia perto do topo deixa a chegada disponível para pontuar', () => {
  const r = room()
  const seedWithZero = '0'
  const map = field(seedWithZero, 1)
  const cell = map.clues.findIndex((clue, index) => index >= map.cols && index < map.cols * 2 && clue === 0)
  assert.notEqual(cell, -1)
  const previous = cell + map.cols
  const player = { ...runner(map), steps: 1, open: { [previous]: map.clues[previous] } }
  const next = move(r, player, 0, seedWithZero, { cell, revision: 0 }, 101)
  const finish = cell - map.cols
  assert.equal(next.open[cell], 0)
  assert.equal(next.open[finish], undefined)
  assert.deepEqual(r.scores, [0, 0])

  const nextField = move(r, next, 0, seedWithZero, { cell: finish, revision: 1 }, 102)
  assert.deepEqual(r.scores, [1, 0])
  assert.equal(nextField.stage, 2)
  assert.equal(Object.keys(nextField.open).length, 2)
})
test('explosão conserva mapa, bloqueio e prorrogação', () => {
  const r = room(), bomb = [...board.mines][0]
  const next = neighbors(bomb,board.cols,board.rows).find(i => !board.mines.has(i))
  const p = move(r, { ...runner(board), steps: 1, open: { [next]: board.clues[next] } }, 1, seed, { revision: 0, cell: bomb }, r.ends-1)
  assert.deepEqual(p.open, runner(board).open)
  settle(r, r.ends)
  assert.equal(r.phase, 'overtime')
  const opened = Object.keys(p.open).map(Number)
  const cell = opened.flatMap(i => neighbors(i, p.cols, p.rows))
    .find(i => !Object.hasOwn(p.open, i) && !board.mines.has(i))
  assert.equal(move(r,p,1,seed,{revision:1,cell},p.blockedUntil-1),null)
  assert.ok(move(r,p,1,seed,{revision:1,cell},p.blockedUntil))
})
