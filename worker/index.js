import { DurableObject } from 'cloudflare:workers'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { field } from './field.js'
import { flag, move, runner, settle } from './race.js'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ttl = 24 * 60 * 60 * 1000
const roomPattern = /^I[A-HJ-NP-Z2-9]{5}$/
const tokenPattern = /^Bearer ([0-9a-f]{32})$/
const siteOrigins = new Set([
  'https://gemini-9815a.web.app',
  'https://gemini-9815a.firebaseapp.com',
  'https://lipe-to.github.io',
])

function fail(status, error) {
  return { status, data: { error } }
}

export class MineRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    this.sql.exec('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, value TEXT NOT NULL)')
  }

  async play(op, identity, action) {
    const row = this.sql.exec('SELECT value FROM state WHERE id = 1').toArray()[0]
    const now = Date.now()
    let state = row ? JSON.parse(row.value) : null
    if (state?.expires <= now) state = null

    if (op === 'create') {
      if (state) return fail(409, 'Código já reservado.')
      const seed = randomBytes(16).toString('hex')
      state = {
        seed,
        fieldVersion: 2,
        expires: now + ttl,
        players: [identity],
        runners: [runner(field(seed, 1))],
        room: { phase: 'waiting', playerCount: 1, scores: [0, 0], starts: 0, ends: 0, winner: -1 },
        version: 1,
      }
      this.save(state)
      await this.ctx.storage.setAlarm(state.expires)
      return { status: 201 }
    }

    if (!state) return fail(404, 'Sala não encontrada ou expirada.')
    const { room, players, runners, seed } = state
    const legacyField = state.fieldVersion === undefined
    let seat = players.indexOf(identity)
    let changed = false
    if (!Number.isInteger(room.playerCount)) { room.playerCount = players.length; changed = true }
    if (seat < 0) {
      if (op !== 'join') return fail(403, 'Entre na sala primeiro.')
      if (room.phase !== 'waiting' || players.length >= 2) return fail(409, 'Esta sala já tem dois jogadores.')
      seat = 1
      players.push(identity)
      runners.push(runner(field(seed, 1, legacyField)))
      room.playerCount = players.length
      changed = true
    }
    if (seat < 0) return fail(403, 'Entre na sala primeiro.')

    for (const player of runners) {
      player.flags ??= {}
      if (player.steps === undefined) {
        const board = field(seed, player.stage, legacyField)
        player.steps = Math.max(0, Object.keys(player.open).length - board.initial.length)
        changed = true
      }
      // Restore the final click in games that revealed the finish before this fix.
      if (legacyField) {
        const revealedFinish = Object.keys(player.open).filter(cell => Number(cell) < player.cols)
        if (revealedFinish.length > 0) {
          for (const cell of revealedFinish) delete player.open[cell]
          player.revision++
          changed = true
        }
      }
    }

    if (settle(room, now)) changed = true
    if (op === 'start') {
      if (seat !== 0) return fail(403, 'Só quem criou a sala pode iniciar a partida.')
      if (room.phase !== 'waiting' || players.length !== 2) {
        return fail(409, 'A outra pessoa ainda não entrou na sala.')
      }
      room.phase = 'countdown'
      room.starts = now + 3000
      room.ends = room.starts + 120000
      changed = true
    }
    if (op === 'move') {
      const next = move(room, runners[seat], seat, seed, action, now, legacyField)
      if (next) {
        runners[seat] = next
        changed = true
      }
    }
    if (op === 'flag') {
      if (!['running', 'overtime'].includes(room.phase)) return fail(409, 'As bandeiras ficam disponíveis durante a partida.')
      const next = flag(runners[seat], action.cell, action.flagged)
      if (next) {
        runners[seat] = next
        changed = true
      }
    }
    if (changed) {
      state.version++
      this.save(state)
    }
    return { status: 200, data: { room, player: runners[seat], seat, version: state.version, now } }
  }

  save(state) {
    this.sql.exec('INSERT OR REPLACE INTO state (id, value) VALUES (1, ?)', JSON.stringify(state))
  }

  async alarm() {
    const row = this.sql.exec('SELECT value FROM state WHERE id = 1').toArray()[0]
    if (!row) return
    const { expires } = JSON.parse(row.value)
    if (expires <= Date.now()) this.sql.exec('DELETE FROM state WHERE id = 1')
    else await this.ctx.storage.setAlarm(expires)
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const isLocal = ['127.0.0.1', 'localhost'].includes(url.hostname) &&
      /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin ?? '')
    const headers = { 'Cache-Control': 'no-store', Vary: 'Origin' }
    if (origin) {
      if (!isLocal && !siteOrigins.has(origin)) return new Response(null, { status: 403 })
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
      headers['Access-Control-Allow-Headers'] = 'Authorization'
      headers['Access-Control-Max-Age'] = '86400'
    }
    const send = ({ status, data }) => Response.json(data, { status, headers })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (url.pathname === '/health' && request.method === 'GET') return send({ status: 200, data: { ok: true } })

    const token = tokenPattern.exec(request.headers.get('Authorization') ?? '')?.[1]
    if (!token) return send(fail(401, 'Identidade da sala inválida.'))
    const identity = createHash('sha256').update(token).digest('hex')

    if (url.pathname === '/rooms' && request.method === 'POST') {
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = 'I' + Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join('')
        const result = await env.ROOMS.getByName(code).play('create', identity, null)
        if (result.status === 201) return send({ status: 201, data: { code } })
      }
      return send(fail(503, 'Tente criar outra sala.'))
    }
    const [, rooms, code, op, extra] = url.pathname.split('/')
    if (rooms !== 'rooms' || !roomPattern.test(code ?? '') || extra !== undefined ||
      (op === 'state' ? request.method !== 'GET' : !['join', 'start', 'move', 'flag'].includes(op) || request.method !== 'POST')) {
      return send(fail(404, 'Endereço da sala inválido.'))
    }
    const cell = url.searchParams.get('cell')
    const revision = url.searchParams.get('revision')
    if (op === 'move' && (!/^\d{1,9}$/.test(cell ?? '') || !/^\d{1,9}$/.test(revision ?? ''))) {
      return send(fail(400, 'Jogada inválida.'))
    }
    if (op === 'flag' && (!/^\d{1,9}$/.test(cell ?? '') || !['true', 'false'].includes(url.searchParams.get('flagged')))) {
      return send(fail(400, 'Marcação inválida.'))
    }
    return send(await env.ROOMS.getByName(code).play(op, identity, {
      cell: Number(cell), revision: Number(revision), flagged: url.searchParams.get('flagged') === 'true',
    }))
  },
}
