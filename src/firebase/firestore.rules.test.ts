import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'
import { createGame } from '../games/rastro/engine'
import * as multiplayer from '../games/rastro/multiplayer'

const runtime = vi.hoisted(() => ({ db: null as Firestore | null }))
vi.mock('./client', () => ({ get db() { return runtime.db }, auth: null }))
vi.mock('./config', () => ({ firebaseReady: true }))

let env: RulesTestEnvironment
const room = { code: 'ABC234', creator: 'p1-user', players: { p1: 'p1-user', p2: 'p2-user' }, status: 'PLAYING', game: { seed: 77, round: 1, finished: false }, confirmations: { p1: false, p2: false }, version: 1, revenge: { p1: false, p2: false }, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }
const round = { seed: 77, round: 1, confirmations: { p1: false, p2: false }, resolved: false }

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-juguitos',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8085 },
  })
})

function actor(uid: string) { runtime.db = env.authenticatedContext(uid).firestore() as unknown as Firestore; return runtime.db }
async function setupCrystalDispute() {
  const game = { ...createGame(77), mapId: 0, positions: { p1: { x: 2, y: 3 }, p2: { x: 4, y: 3 } }, crystals: [{ x: 3, y: 3, id: 'dispute', value: 1 }] }
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'rooms', room.code), { ...room, game, targetScore: 15, duelConfirmations: { p1: false, p2: false } })
    await deleteDoc(doc(db, 'rooms', room.code, 'rounds', '77_1', 'actions', 'p1-user'))
  })
  actor('p1-user'); await multiplayer.submitAction(room.code, 'p1-user', { kind: 'move', direction: 'right' })
  actor('p2-user'); await multiplayer.submitAction(room.code, 'p2-user', { kind: 'move', direction: 'left' })
  await multiplayer.resolveIfReady(room.code)
  return (await multiplayer.readRoom(room.code))!
}

describe('point goals and QTE multiplayer through the real Firestore emulator', () => {
  it('creates, joins, configures and starts a match using the application services', async () => {
    actor('new-host'); const code = await multiplayer.createRoom('new-host')
    expect((await multiplayer.readRoom(code))?.targetScore).toBe(15)
    await multiplayer.updateTargetScore(code, 'new-host', 25)
    actor('new-guest'); await multiplayer.joinRoom(code, 'new-guest')
    await expect(multiplayer.updateTargetScore(code, 'new-guest', 10)).rejects.toThrow()
    actor('new-host'); await multiplayer.startRoom(code, 'new-host')
    const match = (await multiplayer.readRoom(code))!
    expect(match.game?.targetScore).toBe(25); expect(match.game?.crystals).toHaveLength(8)
    await assertFails(updateDoc(doc(runtime.db!, 'rooms', code), { targetScore: 30 }))
  })
  it('restricts goal edits to the waiting host and rejects invalid types and ranges', async () => {
    actor('new-host'); const code = await multiplayer.createRoom('new-host')
    for (const value of [0, 101, 5.5, '15']) await assertFails(updateDoc(doc(runtime.db!, 'rooms', code), { targetScore: value }))
    const guestDb = actor('outsider')
    await assertFails(updateDoc(doc(guestDb, 'rooms', code), { targetScore: 25 }))
    actor('new-host')
    await assertFails(updateDoc(doc(runtime.db!, 'rooms', code), { creator: 'outsider' }))
  })
  it('opens a shared crystal duel, hides attempts, repeats two hits, then resolves the winner once', async () => {
    let match = await setupCrystalDispute(), duel = match.game!.duel!
    expect(duel.stage).toBe(0); expect(match.game!.round).toBe(1)
    actor('p1-user'); await multiplayer.submitDuelAttempt(room.code, 'p1-user', duel.id, duel.stage, duel.center)
    const guest = actor('p2-user')
    const attempt = doc(guest, 'rooms', room.code, 'duels', `${duel.id}_${duel.stage}`, 'attempts', 'p1-user')
    await assertFails(getDoc(attempt))
    await assertFails(updateDoc(doc(guest, 'rooms', room.code), { duelConfirmations: { p1: true, p2: true } }))
    await multiplayer.submitDuelAttempt(room.code, 'p2-user', duel.id, duel.stage, duel.center + .01)
    await assertSucceeds(getDoc(attempt))
    await multiplayer.resolveDuelIfReady(room.code)
    match = (await multiplayer.readRoom(room.code))!; const previous = duel; duel = match.game!.duel!
    expect(duel.stage).toBe(1); expect(duel.periodMs).toBeLessThan(previous.periodMs)
    expect(match.duelConfirmations).toEqual({ p1: false, p2: false })
    actor('p1-user'); await multiplayer.submitDuelAttempt(room.code, 'p1-user', duel.id, duel.stage, duel.center)
    await multiplayer.submitDuelAttempt(room.code, 'p1-user', duel.id, duel.stage, 0) // immutable duplicate keeps the original attempt
    actor('p2-user'); await multiplayer.submitDuelAttempt(room.code, 'p2-user', duel.id, duel.stage, null)
    await multiplayer.resolveDuelIfReady(room.code); await multiplayer.resolveDuelIfReady(room.code)
    match = (await multiplayer.readRoom(room.code))!
    expect(match.game!.duel).toBeNull(); expect(match.game!.round).toBe(2); expect(match.game!.scores.p1).toBe(2)
    expect(match.game!.positions.p1).toEqual({ x: 3, y: 3 })
  })
  it('rejects outsiders, forged ownership, invalid positions, edits and stale-stage attempts', async () => {
    const match = await setupCrystalDispute(), duel = match.game!.duel!
    const makeAttempt = (uid: string, position: unknown, stage = 0) => ({ uid, duelId: duel.id, stage, position })
    const outsider = actor('outsider')
    const outsiderRef = doc(outsider, 'rooms', room.code, 'duels', `${duel.id}_0`, 'attempts', 'outsider')
    await assertFails(setDoc(outsiderRef, makeAttempt('outsider', .5)))
    const host = actor('p1-user')
    const ownRef = doc(host, 'rooms', room.code, 'duels', `${duel.id}_0`, 'attempts', 'p1-user')
    await assertFails(setDoc(ownRef, makeAttempt('p1-user', 2)))
    await assertFails(setDoc(ownRef, makeAttempt('p1-user', '0.5')))
    await assertFails(setDoc(ownRef, { ...makeAttempt('p1-user', .5), extra: 'forged' }))
    await assertFails(setDoc(doc(host, 'rooms', room.code, 'duels', `${duel.id}_0`, 'attempts', 'p2-user'), makeAttempt('p2-user', .5)))
    await assertFails(setDoc(doc(host, 'rooms', room.code, 'duels', `${duel.id}_1`, 'attempts', 'p1-user'), makeAttempt('p1-user', .5, 1)))
    await multiplayer.submitDuelAttempt(room.code, 'p1-user', duel.id, 0, .5)
    await assertFails(updateDoc(ownRef, { position: duel.center }))
    await expect(multiplayer.submitAction(room.code, 'p1-user', { kind: 'stay' })).rejects.toThrow()
  })
  it('rejects confirmation without an action and action replay through a forged round path', async () => {
    const guest = actor('p2-user')
    await assertFails(updateDoc(doc(guest, 'rooms', room.code), { 'confirmations.p2': true }))
    const bogusRound = doc(guest, 'rooms', room.code, 'rounds', 'forged-round')
    await assertFails(setDoc(bogusRound, { seed: 77, round: 1, confirmations: { p1: false, p2: true }, resolved: false }))
    const bogusAction = doc(guest, 'rooms', room.code, 'rounds', 'forged-round', 'actions', 'p2-user')
    await assertFails(setDoc(bogusAction, { uid: 'p2-user', round: 1, action: { kind: 'stay' } }))
  })
  it('continues walking after a spent jump and resets the same goal on a rematch', async () => {
    const game = { ...createGame(77, undefined, 25), mapId: 0, crystals: [{ x: 3, y: 3, id: 'dispute', value: 1 }] }
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'rooms', room.code), { ...room, game, targetScore: 25 })
      await deleteDoc(doc(db, 'rooms', room.code, 'rounds', '77_1', 'actions', 'p1-user'))
    })
    for (const jump of [true, true]) {
      actor('p1-user'); await multiplayer.submitAction(room.code, 'p1-user', { kind: 'move', direction: 'right', jump })
      actor('p2-user'); await multiplayer.submitAction(room.code, 'p2-user', { kind: 'stay' })
      await multiplayer.resolveIfReady(room.code)
    }
    expect((await multiplayer.readRoom(room.code))!.game!.positions.p1).toEqual({ x: 3, y: 3 })
    await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'rooms', room.code), { status: 'FINISHED', 'game.finished': true }) })
    actor('p1-user'); await multiplayer.requestRevenge(room.code, 'p1-user')
    actor('p2-user'); await multiplayer.requestRevenge(room.code, 'p2-user'); await multiplayer.beginRevengeIfReady(room.code)
    const next = (await multiplayer.readRoom(room.code))!
    expect(next.game!.targetScore).toBe(25); expect(next.game!.scores).toEqual({ p1: 0, p2: 0 }); expect(next.game!.duel).toBeNull()
  })
})
afterAll(async () => { await env.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'rooms', room.code), room)
    await setDoc(doc(db, 'rooms', room.code, 'rounds', '77_1'), round)
    await setDoc(doc(db, 'rooms', room.code, 'rounds', '77_1', 'actions', 'p1-user'), { uid: 'p1-user', round: 1, action: { kind: 'move', direction: 'right' } })
  })
})

describe('Firestore room security rules', () => {
  it('requires authentication to read a room', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'rooms', room.code)))
  })
  it('lets a participant read the shared room state', async () => {
    await assertSucceeds(getDoc(doc(env.authenticatedContext('p2-user').firestore(), 'rooms', room.code)))
  })
  it('does not let authenticated non-participants read a private room action', async () => {
    await assertFails(getDoc(doc(env.authenticatedContext('outsider').firestore(), 'rooms', room.code, 'rounds', '77_1', 'actions', 'p1-user')))
  })
  it('hides a player action until both players confirm', async () => {
    await assertFails(getDoc(doc(env.authenticatedContext('p2-user').firestore(), 'rooms', room.code, 'rounds', '77_1', 'actions', 'p1-user')))
  })
  it('reveals actions after both players confirm', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await updateDoc(doc(db, 'rooms', room.code), { confirmations: { p1: true, p2: true } })
      await updateDoc(doc(db, 'rooms', room.code, 'rounds', '77_1'), { confirmations: { p1: true, p2: true } })
    })
    await assertSucceeds(getDoc(doc(env.authenticatedContext('p2-user').firestore(), 'rooms', room.code, 'rounds', '77_1', 'actions', 'p1-user')))
  })
  it('lets a player read their own private action', async () => {
    await assertSucceeds(getDoc(doc(env.authenticatedContext('p1-user').firestore(), 'rooms', room.code, 'rounds', '77_1', 'actions', 'p1-user')))
  })
  it('rejects arbitrary edits to the game state', async () => {
    await assertFails(updateDoc(doc(env.authenticatedContext('p1-user').firestore(), 'rooms', room.code), { game: { seed: 77, round: 8, finished: false } }))
  })
  it('does not let a non-participant write a room', async () => {
    await assertFails(setDoc(doc(env.authenticatedContext('outsider').firestore(), 'rooms', 'QWERTY'), { code: 'QWERTY' }))
  })
  it('allows the first guest into a waiting room', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'rooms', 'GUEST2'), {
        code: 'GUEST2', creator: 'new-host', players: { p1: 'new-host', p2: null }, status: 'WAITING', game: null,
        confirmations: { p1: false, p2: false }, version: 0, revenge: { p1: false, p2: false },
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      })
    })
    const db = env.authenticatedContext('guest-user').firestore()
    await assertSucceeds(updateDoc(doc(db, 'rooms', 'GUEST2'), { 'players.p2': 'guest-user' }))
    expect((await getDoc(doc(db, 'rooms', 'GUEST2'))).data()?.players.p2).toBe('guest-user')
  })
  it('allows a first confirmation to create the missing current-round document', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'rooms', room.code), { game: { seed: 77, round: 2, finished: false } })
    })
    const db = env.authenticatedContext('p1-user').firestore()
    const roomRef = doc(db, 'rooms', room.code)
    const roundRef = doc(db, 'rooms', room.code, 'rounds', '77_2')
    const actionRef = doc(db, 'rooms', room.code, 'rounds', '77_2', 'actions', 'p1-user')
    await assertSucceeds(runTransaction(db, async (tx) => {
      const roundSnapshot = await tx.get(roundRef)
      const actionSnapshot = await tx.get(actionRef)
      const confirmations = roundSnapshot.exists() ? roundSnapshot.data().confirmations : { p1: false, p2: false }
      if (actionSnapshot.exists()) throw new Error('duplicate')
      tx.set(actionRef, { uid: 'p1-user', round: 2, action: { kind: 'stay' } })
      tx.set(roundRef, { seed: 77, round: 2, confirmations: { ...confirmations, p1: true }, resolved: false })
      tx.update(roomRef, { 'confirmations.p1': true, updatedAt: serverTimestamp() })
    }))
  })
  it('allows a new host to create a valid waiting room on the six-character code format', async () => {
    const db = env.authenticatedContext('new-host').firestore()
    await assertSucceeds(setDoc(doc(db, 'rooms', 'QWERTY'), {
      code: 'QWERTY', creator: 'new-host', players: { p1: 'new-host', p2: null }, status: 'WAITING', game: null,
      confirmations: { p1: false, p2: false }, version: 0, revenge: { p1: false, p2: false },
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
  })
  it('does not allow a third player to replace a participant in a filled room', async () => {
    const db = env.authenticatedContext('outsider').firestore()
    await assertFails(updateDoc(doc(db, 'rooms', room.code), { 'players.p2': 'outsider' }))
  })
  it('atomically accepts both confirmations and reveals the private action afterwards', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), 'rooms', room.code, 'rounds', '77_1', 'actions', 'p1-user'))
    })
    async function confirm(uid: string, slot: 'p1' | 'p2') {
      const db = env.authenticatedContext(uid).firestore()
      const roomRef = doc(db, 'rooms', room.code)
      const roundRef = doc(db, 'rooms', room.code, 'rounds', '77_1')
      const actionRef = doc(db, 'rooms', room.code, 'rounds', '77_1', 'actions', uid)
      await runTransaction(db, async (tx) => {
        const roomSnapshot = await tx.get(roomRef)
        const roundSnapshot = await tx.get(roundRef)
        const actionSnapshot = await tx.get(actionRef)
        const next = { ...roundSnapshot.data()!.confirmations, [slot]: true }
        if (actionSnapshot.exists()) throw new Error('duplicate')
        tx.set(actionRef, { uid, round: 1, action: { kind: 'stay' } })
        tx.set(roundRef, { ...roundSnapshot.data(), confirmations: next })
        tx.update(roomRef, { confirmations: { ...roomSnapshot.data()!.confirmations, [slot]: true }, updatedAt: serverTimestamp() })
      })
    }
    await confirm('p1-user', 'p1')
    await assertFails(getDoc(doc(env.authenticatedContext('p2-user').firestore(), 'rooms', room.code, 'rounds', '77_1', 'actions', 'p1-user')))
    await confirm('p2-user', 'p2')
    await assertSucceeds(getDoc(doc(env.authenticatedContext('p2-user').firestore(), 'rooms', room.code, 'rounds', '77_1', 'actions', 'p1-user')))
  })
  it('serializes two simultaneous resolution attempts so only one advances the round', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await updateDoc(doc(db, 'rooms', room.code), { confirmations: { p1: true, p2: true } })
      await updateDoc(doc(db, 'rooms', room.code, 'rounds', '77_1'), { confirmations: { p1: true, p2: true } })
      await setDoc(doc(db, 'rooms', room.code, 'rounds', '77_1', 'actions', 'p2-user'), { uid: 'p2-user', round: 1, action: { kind: 'stay' } })
    })
    async function resolve(uid: string) {
      const db = env.authenticatedContext(uid).firestore()
      const roomRef = doc(db, 'rooms', room.code)
      const roundRef = doc(db, 'rooms', room.code, 'rounds', '77_1')
      return runTransaction(db, async (tx) => {
        const roomSnapshot = await tx.get(roomRef)
        const data = roomSnapshot.data()!
        if (!data.confirmations.p1 || !data.confirmations.p2) return false
        const roundSnapshot = await tx.get(roundRef)
        const roundData = roundSnapshot.data()!
        const p1 = await tx.get(doc(db, 'rooms', room.code, 'rounds', '77_1', 'actions', 'p1-user'))
        const p2 = await tx.get(doc(db, 'rooms', room.code, 'rounds', '77_1', 'actions', 'p2-user'))
        if (roundData.resolved || !p1.exists() || !p2.exists()) return false
        tx.update(roundRef, { resolved: true })
        tx.update(roomRef, { game: { ...data.game, round: data.game.round + 1 }, confirmations: { p1: false, p2: false }, version: data.version + 1, updatedAt: serverTimestamp() })
        return true
      })
    }
    async function resolveWithRetry(uid: string) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try { return await resolve(uid) }
        catch (error) {
          const latest = (await getDoc(doc(env.authenticatedContext(uid).firestore(), 'rooms', room.code))).data()
          if (!latest?.confirmations.p1 || !latest.confirmations.p2) return false
          if (attempt === 2) throw error
          await new Promise((done) => setTimeout(done, 100 * (attempt + 1)))
        }
      }
      return false
    }
    const results = await Promise.all([resolveWithRetry('p1-user'), resolveWithRetry('p2-user')])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect((await getDoc(doc(env.authenticatedContext('p1-user').firestore(), 'rooms', room.code))).data()?.game.round).toBe(2)
  })
})
