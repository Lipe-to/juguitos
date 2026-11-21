export interface Race {
  scores: number[]
  starts: number
  ends: number
  phase: 'waiting' | 'running' | 'overtime' | 'finished'
  winner: number
}

export interface Runner {
  stage: number
  revision: number
  cols: number
  rows: number
  open: Record<string, number>
  blockedUntil: number
  bomb: number
  last: number
}

export interface Snapshot {
  room: Race
  player: Runner
  seat: number
  version: number
  now: number
}

const endpoint = import.meta.env.VITE_MINES_API_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8787' : '')
const identityKey = 'juguitos-minas-identity'

function identity() {
  let token = localStorage.getItem(identityKey)
  if (!token || !/^[0-9a-f]{32}$/.test(token)) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
      byte.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(identityKey, token)
  }
  return token
}

async function request<T>(path: string, method: 'GET' | 'POST') {
  if (!endpoint) throw new Error('O servidor do Campo Minado ainda está indisponível.')
  let response: Response
  try {
    response = await fetch(endpoint.replace(/\/$/, '') + path, {
      method,
      headers: { Authorization: 'Bearer ' + identity() },
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    throw new Error('Falha na conexão com a sala. Tente novamente.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    throw new Error(data?.error || 'O servidor da sala está indisponível. Tente novamente.')
  }
  return data as T
}

export function createRoom() {
  return request<{ code: string }>('/rooms', 'POST')
}

export function joinRoom(code: string) {
  return request<Snapshot>('/rooms/' + encodeURIComponent(code) + '/join', 'POST')
}

export function roomState(code: string) {
  return request<Snapshot>('/rooms/' + encodeURIComponent(code) + '/state', 'GET')
}

export function openCell(code: string, cell: number, revision: number) {
  const action = new URLSearchParams({ cell: String(cell), revision: String(revision) })
  return request<Snapshot>('/rooms/' + encodeURIComponent(code) + '/move?' + action, 'POST')
}
