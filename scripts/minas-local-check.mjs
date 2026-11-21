import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { neighbors } from '../worker/field.js'

const endpoint = process.argv[2] ?? 'http://127.0.0.1:8787'
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
assert.deepEqual(Object.keys(second.room).sort(), ['ends', 'phase', 'scores', 'starts', 'winner'])
assert.equal(second.room.ends - second.room.starts, 120000)
assert.equal(second.seat, 1)

const { open, cols, rows } = first.player
const safe = Object.keys(open).filter(id => open[id] === 0)
  .flatMap(id => neighbors(Number(id), cols, rows)).find(id => !Object.hasOwn(open, id))
assert.ok(Number.isInteger(safe))
const move = (cell, revision = 0) => request(room + '/move?cell=' + cell + '&revision=' + revision, host)
const premature = await move(safe)
assert.equal(premature.player.revision, 0)
await new Promise(resolve => setTimeout(resolve, Math.max(0, second.room.starts - Date.now()) + 200))
const [one, duplicate] = await Promise.all([move(safe), move(safe)])
assert.equal(one.player.revision, 1)
assert.deepEqual(one.player, duplicate.player)
assert.deepEqual((await state(guest)).player, second.player)
assert.deepEqual((await request(room + '/join', host)).player, one.player)
assert.equal((await move(cols * rows + 1, 1)).player.revision, 1)
console.log('Sala, isolamento, largada, jogada única e reconexão verificados com duas identidades.')
