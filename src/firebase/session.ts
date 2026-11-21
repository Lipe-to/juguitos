import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { auth } from './client'
import { firebaseReady } from './config'

let authenticatedUser: Promise<User> | null = null

export function waitForUser(): Promise<User> {
  const firebaseAuth = auth
  if (!firebaseAuth || !firebaseReady) return Promise.reject(new Error('Firebase não está configurado.'))
  if (authenticatedUser) return authenticatedUser
  authenticatedUser = new Promise<User>((resolve, reject) => {
    const stop = onAuthStateChanged(firebaseAuth, async (user) => {
      stop()
      try { resolve(user ?? (await signInAnonymously(firebaseAuth)).user) }
      catch (error) { reject(error) }
    }, reject)
  }).catch((error) => { authenticatedUser = null; throw error })
  return authenticatedUser
}
