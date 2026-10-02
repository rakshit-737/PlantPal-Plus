/**
 * Mounts the outbox's lifecycle: it holds no state of its own (the queue is a
 * module singleton) and renders nothing, it just decides when to drain.
 *
 * Drain triggers, in order of how often they fire:
 *   - the app returns to the foreground (AppState 'active') — the moment a
 *     phone comes out of a tunnel or off a plane
 *   - sign-in, which is the first point at which a drain can be authenticated
 *   - after any successful write (see writeThrough.ts)
 *
 * Sign-out clears the queue: an event is filed against whichever account
 * drains it, so carrying one user's unsynced logs into the next session would
 * post them to the wrong account. The logout also revoked the refresh token
 * those events would have needed.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { useAuth } from '../auth/AuthContext'
import { clearOutbox, drainOutbox, setOutboxOwner } from './outbox'

export function OutboxProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  // Read inside the AppState listener, which is registered once and must not
  // close over a stale value.
  const authed = useRef(isAuthenticated)
  const userId = user?.id ?? null

  useEffect(() => {
    const was = authed.current
    authed.current = isAuthenticated
    if (isAuthenticated) {
      // Wait for the identity before draining. A queue can outlive the session
      // that wrote it (an OS kill leaves it on disk), so setOutboxOwner is what
      // stops one account's unsynced events being posted under the next
      // account to sign in on this device.
      if (userId === null) return
      void setOutboxOwner(userId).then(() => drainOutbox())
    } else if (was) {
      void setOutboxOwner(null)
      void clearOutbox()
    }
  }, [isAuthenticated, userId])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && authed.current) void drainOutbox()
    })
    return () => sub.remove()
  }, [])

  return <>{children}</>
}
