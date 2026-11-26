import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { neighbors } from '../worker/field.js'

const endpoint = process.argv.find(arg => /^https?:\/\//.test(arg)) ?? 'http://127.0.0.1:8787'
const identity = () => 'Bearer ' + randomBytes(16).toString('hex')
const [host, guest, stranger] = Array.from({ length: 3 }, identity)
async function request(path, authorization, status = 200, method = 'POST') {
  const response = await fetch(endpoint + path, {
    method,
    headers: { Authorization: authorization, Origin: 'https://gemini-9815a.web.app' },
    signal: AbortSignal.timeout(10000),
  })
  const data = await response.json()
  assert.equal(response.status, status, JSON.stringify(data))
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://gemini-9815a.web.app')
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  return data
}
const { code } = await request('/rooms', host, 201)
const room = '/rooms/' + code
const state = player => request(room + '/state', player, 200, 'GET')
const first = await request(room + '/join', host)
assert.equal(first.room.phase, 'waiting')
await request(room + '/state', stranger, 403, 'GET')
const second = await request(room + '/join', guest)
await request(room + '/join', stranger, 409)
assert.deepEqual(first.player, second.player)
assert.deepEqual(Object.keys(second).sort(), ['now', 'player', 'room', 'seat', 'version'])
assert.deepEqual(Object.keys(second.room).sort(), ['ends', 'phase', 'playerCount', 'scores', 'starts', 'winner'])
assert.equal(first.room.playerCount, 1)
assert.equal(second.room.playerCount, 2)
assert.equal(second.room.starts, 0)
assert.equal(second.room.ends, 0)
assert.equal(second.seat, 1)
await request(room + '/start', guest, 403)
const countdown = await request(room + '/start', host)
assert.equal(countdown.room.phase, 'countdown')
assert.equal(countdown.room.ends - countdown.room.starts, 120000)
const { cols, rows } = countdown.player
const opened = Object.keys(countdown.player.open).map(Number)
assert.equal(opened.length, 2)
assert.ok(opened.every(cell => cell >= cols * (rows - 1)))
const zero = opened.find(cell => countdown.player.open[cell] === 0)
const row = Math.floor(zero / cols), column = zero % cols
const safe = [
  ...(row > 0 ? [zero - cols] : []), ...(row < rows - 1 ? [zero + cols] : []),
  ...(column > 0 ? [zero - 1] : []), ...(column < cols - 1 ? [zero + 1] : []),
].find(cell => countdown.player.open[cell] === undefined)
assert.ok(Number.isInteger(safe))
const move = (cell, revision = 0) => request(room + '/move?cell=' + cell + '&revision=' + revision, host)
const premature = await move(safe)
assert.equal(premature.player.revision, 0)
await request(room + '/flag?cell=' + safe + '&flagged=true', host, 409)
await new Promise(resolve => setTimeout(resolve, Math.max(0, countdown.room.starts - Date.now()) + 200))
const marked = await request(room + '/flag?cell=' + safe + '&flagged=true', host)
assert.equal(marked.player.flags[safe], true)
assert.equal((await move(safe)).player.revision, 0)
const unmarked = await request(room + '/flag?cell=' + safe + '&flagged=false', host)
assert.equal(unmarked.player.flags[safe], undefined)
const [one, duplicate] = await Promise.all([move(safe), move(safe)])
assert.equal(one.player.revision, 1)
assert.deepEqual(one.player, duplicate.player)
assert.equal((await state(guest)).player.steps, 0)
assert.deepEqual((await request(room + '/join', host)).player, one.player)
assert.equal((await move(cols * rows + 1, 1)).player.revision, 1)

// Cross the field using only the clues sent to the player.
const knownMines = new Set()
let current = one
while (current.player.stage === 1) {
  const { open, revision } = current.player
  assert.ok(Object.keys(open).every(cell => Number(cell) >= cols))
  const clues = Object.keys(open).map(Number)
  const frontier = new Set(clues.flatMap(cell => neighbors(cell, cols, rows)))
  const safeCells = new Set()
  let previousMineCount
  do {
    previousMineCount = knownMines.size
    for (const cell of clues) {
      const nearby = neighbors(cell, cols, rows, true)
      const unknown = nearby.filter(id => !Object.hasOwn(open, id) && !knownMines.has(id))
      const remaining = open[cell] - nearby.filter(id => knownMines.has(id)).length
      if (remaining === 0) unknown.forEach(id => safeCells.add(id))
      else if (remaining === unknown.length) unknown.forEach(id => knownMines.add(id))
    }
  } while (knownMines.size > previousMineCount)
  const next = [...safeCells].find(cell => cell < cols && frontier.has(cell)) ??
    [...safeCells].find(cell => frontier.has(cell))
  assert.ok(next !== undefined, 'As pistas precisam permitir avançar até a chegada.')
  current = await move(next, revision)
  assert.equal(current.player.revision, revision + 1)
  assert.equal(current.player.bomb, -1)
}
assert.equal(current.player.stage, 2)
assert.deepEqual(current.room.scores, [1, 0])
assert.equal(Object.keys(current.player.open).length, 2)
assert.deepEqual((await state(guest)).room.scores, [1, 0])
console.log('Sala, largada, bandeiras, reconexão e travessia até o campo seguinte verificadas com duas identidades.')
