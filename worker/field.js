import { createHash } from 'node:crypto'
import { generateField } from '../src/games/minas/field-core.ts'
export { neighbors, clueRoute, revealSafeArea } from '../src/games/minas/field-core.ts'

function randomSource(seed, stage) {
  let state = createHash('sha256').update(seed + ':' + stage).digest().readUInt32LE()
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function field(seed, stage, legacy = false) {
  return generateField(stage, randomSource(seed, stage), legacy)
}
