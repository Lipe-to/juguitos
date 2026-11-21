import test from 'node:test'
import assert from 'node:assert/strict'
import { field, neighbors, clueRoute } from './field.js'
import { move, runner, settle } from './race.js'

test('largada, pistas e rotas em 800 combinações de campo e semente', () => {
  for (let s = 0; s < 80; s++) for (let stage = 1; stage <= 10; stage++) {
    const board = field(String(s), stage)
    const { cols, rows, initial, mines, clues } = board
    const entry = new Set(initial)
    assert.equal(entry.size, Math.round(cols * rows / 12))
    assert.ok(initial.some(i => i >= cols * (rows-1)))
    assert.ok(initial.every(i => !mines.has(i)))
    assert.ok(initial.some(i => clues[i] === 0 && neighbors(i,cols,rows).some(n => !entry.has(n))))
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
const nearFinish = () => ({ ...runner(board), open: { [top + board.cols]: board.clues[top + board.cols] } })
test('travessia a 1 ms do fim decide no tempo regulamentar', () => {
  const r = room()
  move(r, nearFinish(), 0, seed, { cell: top, revision: 0 }, r.ends-1)
  settle(r, r.ends)
  assert.equal(r.winner, 0)
})
test('explosão conserva mapa, bloqueio e prorrogação', () => {
  const r = room(), bomb = [...board.mines][0]
  const next = neighbors(bomb,board.cols,board.rows).find(i => !board.mines.has(i))
  const p = move(r, { ...runner(board), open: { [next]: board.clues[next] } }, 1, seed, { revision: 0, cell: bomb }, r.ends-1)
  assert.deepEqual(p.open, runner(board).open)
  settle(r, r.ends)
  assert.equal(r.phase, 'overtime')
  const cell = board.initial.flatMap(i => neighbors(i,board.cols,board.rows)).find(i => !board.initial.includes(i) && !board.mines.has(i))
  assert.equal(move(r,p,1,seed,{revision:1,cell},p.blockedUntil-1),null)
  assert.ok(move(r,p,1,seed,{revision:1,cell},p.blockedUntil))
})
