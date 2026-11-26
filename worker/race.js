import { field } from './field.js'
import { moveWithFields } from '../src/games/minas/race-core.ts'
export { flag, runner, settle } from '../src/games/minas/race-core.ts'

export function move(room, player, seat, seed, action, now, legacyField = false) {
  return moveWithFields(room, player, seat, action, now, stage => field(seed, stage, legacyField))
}
