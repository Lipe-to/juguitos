import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

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
const safe = countdown.player.firstRow * countdown.player.cols + Math.floor(countdown.player.cols / 2)
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
console.log('Sala de espera, largada explícita, primeira jogada, bandeiras, jogada duplicada e reconexão verificadas com duas identidades.')
