import { readFile } from 'node:fs/promises'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { flockCount } from '../games/ovelhas/engine'
import * as online from '../games/ovelhas/online'

const runtime = vi.hoisted(() => ({ db: null as Firestore | null }))
vi.mock('./client', () => ({ get db() { return runtime.db }, auth: null }))
let env: RulesTestEnvironment
const host = 'sheep-host', guest = 'sheep-guest'
const clock = { now: Date.now, latency: 0 }
const turn = { match: 1, round: 1 }
const flags = { p1: false, p2: false }
const actor = (uid: string) => runtime.db = env.authenticatedContext(uid).firestore() as unknown as Firestore
const ref = (code: string, db = runtime.db!) => doc(db, 'sheepRooms', code)
const guess = (code: string, uid: string, db = runtime.db!) => doc(db, 'sheepRooms', code, 'rounds', '1_1', 'guesses', uid)
const read = async (code: string) => (await getDoc(ref(code))).data() as online.SheepRoom
const backdate = (code: string, ms: number, lives?: { p1: number; p2: number }) =>
  env.withSecurityRulesDisabled(ctx => updateDoc(ref(code, ctx.firestore() as unknown as Firestore), {
    anchor: Timestamp.fromMillis(Date.now() - ms), ...(lives ? { lives } : {}),
  }))

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-juguitos',
    firestore: { host: '127.0.0.1', port: 8085, rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
})
afterAll(async () => { await env?.cleanup() })

async function lobby() {
  actor(host); const code = await online.createSheepRoom(host)
  actor(guest); expect(await online.joinSheepRoom(code, guest)).toBe('p2')
  actor(host); return code
}
async function match() {
  const code = await lobby()
  await online.startSheepMatch(code, host)
  return code
}

describe('sheep rooms with server-enforced clocks and lives', () => {
  it('allows an invite and host start while rejecting enumeration, hijacking and malformed writes', async () => {
    actor(host); const code = await online.createSheepRoom(host), original = await read(code)
    const stranger = actor('sheep-outsider')
    await assertFails(getDocs(collection(stranger, 'sheepRooms')))
    await assertFails(getDoc(ref(code, env.unauthenticatedContext().firestore() as unknown as Firestore)))
    await assertFails(setDoc(ref('OABCDE'), { ...original, anchor: serverTimestamp() }))
    await assertFails(setDoc(ref('OABCDE'), { ...original, host: 'sheep-outsider', anchor: serverTimestamp(), extraData: 'x'.repeat(30000) }))
    await assertFails(setDoc(ref('OABCDE'), { ...original, host: 'sheep-outsider', seed: 'bad', anchor: serverTimestamp() }))
    actor(host)
    await assertFails(updateDoc(ref(code), { phase: 'run', round: 1, anchor: serverTimestamp() }))
    actor(guest); await online.joinSheepRoom(code, guest)
    await assertFails(updateDoc(ref(code), { phase: 'run', round: 1, anchor: serverTimestamp() }))
    await assertFails(updateDoc(ref(code), { host: guest }))
    await assertFails(updateDoc(ref(code), { seed: deleteField() }))
    await assertFails(getDoc(ref(code, stranger)))
    actor(host); await online.startSheepMatch(code, host)
    expect((await read(code)).lives).toEqual({ p1: 3, p2: 3 })
  })

  it('accepts only in-window atomic guesses, reveals after both, and refuses forged results', async () => {
    const code = await match(), initial = await read(code)
    const total = flockCount(initial.seed, 1)
    await assertFails(online.sendGuess(code, host, turn, total))
    await backdate(code, 15000)
    await assertFails(updateDoc(ref(code), { 'sent.p1': true }))
    await assertFails(setDoc(guess(code, host), { value: total }))
    await assertSucceeds(online.sendGuess(code, host, turn, total))
    await assertFails(updateDoc(guess(code, host), { value: 99 }))
    actor(guest)
    await assertFails(getDoc(guess(code, host)))
    const bad = writeBatch(runtime.db!)
    bad.set(guess(code, guest), { value: 100 })
    bad.update(ref(code), { 'sent.p2': true })
    await assertFails(bad.commit())
    await online.sendGuess(code, guest, turn, 99)
    expect((await assertSucceeds(getDoc(guess(code, host)))).get('value')).toBe(total)
    await assertFails(updateDoc(ref(code), { phase: 'finished', last: { p1: total, p2: 99 }, lives: { p1: 0, p2: 3 }, anchor: serverTimestamp() }))
    await online.settleSheepRound(code, turn, clock)
    expect(await read(code)).toMatchObject({ phase: 'result', last: { p1: total, p2: 99 }, lives: { p1: 3, p2: 2 } })
    await assertFails(updateDoc(ref(code), { phase: 'run', round: 2, last: null, sent: flags, anchor: serverTimestamp() }))
    await backdate(code, 6000)
    await online.nextSheepRound(code, turn, clock)
    expect(await read(code)).toMatchObject({ phase: 'run', round: 2, sent: flags, lives: { p1: 3, p2: 2 } })
    await online.settleSheepRound(code, turn, clock)
    expect((await read(code)).round).toBe(2)
  })

  it('honors the deadline, ends at zero lives, and requires both players for a rematch', async () => {
    const code = await match()
    await backdate(code, 15000, { p1: 3, p2: 1 })
    await online.sendGuess(code, host, turn, 9)
    await online.settleSheepRound(code, turn, clock)
    expect((await read(code)).phase).toBe('run')
    await backdate(code, 27000)
    actor(guest); await assertFails(online.sendGuess(code, guest, turn, 9))
    await online.settleSheepRound(code, turn, clock)
    expect(await read(code)).toMatchObject({ phase: 'finished', lives: { p1: 3, p2: 0 }, last: { p1: 9, p2: null } })
    await online.sheepRematch(code, guest, 1)
    expect((await read(code)).phase).toBe('finished')
    actor(host); await online.sheepRematch(code, host, 1)
    expect(await read(code)).toMatchObject({ phase: 'run', match: 2, round: 1, lives: { p1: 3, p2: 3 }, replay: flags })
  })

  it('keeps synchronization timestamps server-written and owner-only', async () => {
    const own = doc(actor(host), 'sheepClocks', host)
    await assertFails(setDoc(own, { at: Timestamp.fromMillis(0) }))
    const measured = await online.syncClock(host)
    expect(Math.abs(measured.now() - Date.now())).toBeLessThan(1800)
    await assertFails(getDoc(doc(actor(guest), 'sheepClocks', host)))
  })
})
