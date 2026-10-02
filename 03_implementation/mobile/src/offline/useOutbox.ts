/**
 * React binding for the outbox. The queue lives in module scope, so it is read
 * through useSyncExternalStore rather than context — any component can observe
 * the pending count without a provider above it, and the count stays correct
 * across screen switches because nothing about it is component state.
 */

import { useSyncExternalStore } from 'react'

import { getOutboxSnapshot, subscribeOutbox } from './outbox'
import type { OutboxSnapshot } from './types'

export function useOutbox(): OutboxSnapshot {
  return useSyncExternalStore(subscribeOutbox, getOutboxSnapshot)
}

/** Just the number, for callers that only render a count. */
export function usePendingSyncCount(): number {
  return useOutbox().pending
}
