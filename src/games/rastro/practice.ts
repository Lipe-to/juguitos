import { PRACTICE_BOT, PRACTICE_CODE, PRACTICE_USER, practiceSeed } from '../practice'
import { BOARD_SIZE, createGame, DEFAULT_TARGET_SCORE, MAP_WALLS, resolveDuel, resolveRound, type Action, type Direction, type GameState, type Position } from './engine'
import type { Room } from './multiplayer'

const directions: [Direction, number, number][] = [['up', 0, -1], ['left', -1, 0], ['down', 0, 1], ['right', 1, 0]]
const cell = ({x, y}: Position) => y * BOARD_SIZE + x

function botAction(game: GameState): Action {
  const blocked = new Set([...MAP_WALLS[game.mapId], ...game.trails.filter(trail => trail.expiresBeforeRound > game.round), game.positions.p1].map(cell))
  const crystals = new Set(game.crystals.map(cell))
  const visited = new Set([cell(game.positions.p2)])
  const queue: { position: Position; direction?: Direction }[] = [{ position: game.positions.p2 }]
  for (const {position, direction} of queue) {
    if (direction && crystals.has(cell(position))) return { kind: 'move', direction }
    for (const [next, dx, dy] of directions) {
      const neighbor = { x: position.x + dx, y: position.y + dy }
      const id = cell(neighbor)
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= BOARD_SIZE || neighbor.y >= BOARD_SIZE || blocked.has(id) || visited.has(id)) continue
      visited.add(id)
      queue.push({ position: neighbor, direction: direction ?? next })
    }
  }
  return { kind: 'stay' }
}

export function createRastroPractice() {
  let room: Room = {
    code: PRACTICE_CODE, creator: PRACTICE_USER, players: { p1: PRACTICE_USER, p2: PRACTICE_BOT },
    status: 'WAITING', game: null, confirmations: { p1: false, p2: true },
    version: 0, revenge: { p1: false, p2: true }, targetScore: DEFAULT_TARGET_SCORE,
  }
  let listener: ((room: Room) => void) | undefined
  function update(changes: Partial<Room>) {
    room = { ...room, ...changes, version: room.version + 1 }
    listener?.(room)
  }
  function start() {
    update({ status: 'PLAYING', game: createGame(practiceSeed(), room.game?.mapId, room.targetScore) })
  }
  function advance(game: GameState) {
    update({ game, status: game.finished ? 'FINISHED' : 'PLAYING', duelConfirmations: { p1: false, p2: Boolean(game.duel) } })
  }
  return {
    waitForUser: async () => ({ uid: PRACTICE_USER }),
    joinRoom: async (_code: string, _uid: string) => 'p1' as const,
    subscribeRoom(_code: string, onRoom: (room: Room | null) => void) {
      listener = onRoom
      onRoom(room)
      return () => { listener = undefined }
    },
    async updateTargetScore(_code: string, _uid: string, targetScore: number) { update({ targetScore }) },
    async startRoom() { if (room.status === 'WAITING') start() },
    async requestRevenge() { if (room.status === 'FINISHED') start() },
    async submitAction(_code: string, _uid: string, action: Action) {
      const { game } = room
      if (!game || game.finished || game.duel) return
      advance(resolveRound(game, { p1: action, p2: botAction(game) }).state)
    },
    async submitDuelAttempt(_code: string, _uid: string, id: string, stage: number, position: number | null) {
      const game = room.game
      const duel = game?.duel
      if (!duel || duel.id !== id || duel.stage !== stage) return
      // The bot taps just outside the target so a well timed tap wins.
      const miss = duel.center < .5 ? duel.center + duel.width : duel.center - duel.width
      advance(resolveDuel(game, { p1: { position }, p2: { position: miss } }).state)
    },
  }
}
