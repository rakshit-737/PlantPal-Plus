/**
 * The offline outbox — the mobile half of POST /api/v1/sync/outbox.
 *
 * The server half (apps/api/src/modules/sync) is an exactly-once ingest keyed
 * on (user_id, client_idempotency_key). This module is what feeds it: a FIFO
 * queue of append-only log events, a drain that posts them in one batch, and
 * the rules for what to do with each per-event verdict.
 *
 * Three properties are worth stating plainly, because the whole design leans
 * on them:
 *
 * 1. The idempotency key is minted BEFORE the online attempt (see
 *    writeThrough.ts) and reused verbatim for the queued replay. The dangerous
 *    case in offline sync is not "the request failed" — it is "the request
 *    succeeded and the response was lost". With one key end to end, that case
 *    resolves to a PROCESSED replay carrying the original entity id, not a
 *    duplicate watering.
 * 2. Every entity type here is append-only, so a replay can never conflict and
 *    there is deliberately no merge algorithm of any kind.
 * 3. A FAILED verdict is stored server-side against the key, and every future
 *    replay of that key returns the stored FAILED. Retrying a key the server
 *    has already rejected can therefore never succeed — see the drain below.
 *
 * State lives in module scope (not React state) so a queued event is not tied
 * to the lifetime of the screen that created it.
 */

import { ApiError, apiRequest } from '../api/client'
import { UUID_V4, newIdempotencyKey } from './ids'
import { loadItems, saveItems } from './storage'
import type { OutboxEntityType, OutboxItem, OutboxSnapshot, SyncResult } from './types'

/** The server rejects a batch larger than this (MAX_BATCH in syncController). */
const MAX_BATCH = 50

/** A local safety valve: a queue this long means something is badly wrong. */
const MAX_QUEUE = 200

/**
 * How many server verdicts an item may collect before it is discarded. Only
 * non-terminal FAILED verdicts count, and because the server stores a FAILED
 * outcome per key, this is a bound on a loop that would otherwise never end.
 */
const MAX_ATTEMPTS = 3

/**
 * Error codes syncController records for events that will never succeed on
 * retry: a payload that does not validate, or a parent row (a plant, a food)
 * that does not exist. Anything else is treated as possibly-transient and
 * retried up to MAX_ATTEMPTS.
 */
const TERMINAL_ERROR_CODES = new Set(['VALIDATION_FAILED', 'PARENT_NOT_FOUND'])

/**
 * The only statuses that mean THIS BUILD's batch envelope is malformed and
 * resending it unchanged cannot help: a schema failure on the envelope (422),
 * unparseable JSON (400) or a body over the size limit (413).
 *
 * Every other 4xx means the batch was never adjudicated — 401/403 (token
 * expired or revoked), 404 (a route this build expects is missing), 405, 409,
 * 429 (rate limited) — and must be treated exactly like an outage: kept,
 * uncounted, retried on the next foreground. Counting those would burn all
 * three attempts on, say, three rate-limited retries and then silently
 * discard up to 50 of the user's logged events.
 */
const ENVELOPE_REJECTED_STATUSES = new Set([400, 413, 422])

/* ------------------------------------------------------------------ state */

let items: OutboxItem[] = []
let draining = false
let notice: string | null = null
let hydration: Promise<void> | null = null
/** True once a read of the store has succeeded — gates every whole-array write. */
let hydrated = false
/** Bumped by every clear, so a hydration that started earlier cannot revive it. */
let clearGeneration = 0
/** The signed-in account id, or null before sign-in. See OutboxItem.ownerId. */
let ownerId: string | null = null

const listeners = new Set<() => void>()

/**
 * useSyncExternalStore compares snapshots by reference, so the snapshot object
 * is rebuilt only when something actually changed — never per render.
 */
let snapshot: OutboxSnapshot = { items: [], pending: 0, draining: false, notice: null }

function publish(): void {
  snapshot = { items: items.slice(), pending: items.length, draining, notice }
  for (const listener of listeners) listener()
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getOutboxSnapshot(): OutboxSnapshot {
  return snapshot
}

/**
 * Test seam: forget that the store was ever read, so a test can set up a
 * stored queue and exercise the cold-start path. Not used by app code.
 */
export function __resetHydrationForTests(): void {
  hydration = null
  hydrated = false
  items = []
  notice = null
  publish()
}

export function dismissOutboxNotice(): void {
  if (notice === null) return
  notice = null
  publish()
}

/* ------------------------------------------------------------ queue edits */

/**
 * Every write is a whole-array replace, so it must not run until the stored
 * queue has actually been read — otherwise the first enqueue after a cold
 * start would overwrite entries the user logged in a previous session before
 * they were ever loaded. `hydrated` is only set once a read SUCCEEDS: a
 * transient read failure leaves the queue in memory and blocks persistence
 * rather than erasing what is on disk.
 */
async function persist(): Promise<void> {
  await hydrateOutbox()
  if (!hydrated) return
  await saveItems(items)
}

/**
 * Load any previously stored queue. Safe to call repeatedly and concurrently:
 * the first call owns the read and every later caller awaits the same promise,
 * so a drain racing the provider's mount cannot see a half-loaded queue.
 *
 * A failed read is not cached: the next call retries, so a store that was
 * briefly unavailable at boot still hydrates later in the session.
 */
export function hydrateOutbox(): Promise<void> {
  if (!hydration) {
    hydration = (async () => {
      const generation = clearGeneration
      const stored = await loadItems()
      if (stored === null) {
        // Could not read. Leave `hydrated` false (persistence stays blocked)
        // and allow a later retry.
        hydration = null
        return
      }
      if (clearGeneration !== generation) {
        // A sign-out landed while this read was in flight. Adopting the rows
        // it returned would resurrect the queue that clear just emptied.
        hydrated = true
        return
      }
      hydrated = true
      if (stored.length === 0) return
      // Stored items are older than anything enqueued while the read was in
      // flight, so they lead; a key already in memory is not re-added.
      const known = new Set(items.map((i) => i.client_idempotency_key))
      items = [...stored.filter((i) => !known.has(i.client_idempotency_key)), ...items]
      publish()
    })()
  }
  return hydration
}

/**
 * Mint an item without queueing it. The caller sends
 * `item.client_idempotency_key` with its online attempt and only enqueues if
 * that attempt fails at the transport — that is what ties the two paths to one
 * identity.
 */
export function createOutboxItem(
  entityType: OutboxEntityType,
  payload: Record<string, unknown>,
  label: string,
): OutboxItem {
  return {
    client_idempotency_key: newIdempotencyKey(),
    entity_type: entityType,
    ownerId: ownerId ?? '',
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    label,
  }
}

/**
 * Record who is signed in. Called by OutboxProvider on every auth change.
 *
 * Setting a different owner drops anything the previous account left behind:
 * an event is filed against whichever session drains it, so posting account
 * A's unsynced watering under account B would attribute it to the wrong
 * person's garden. This is the guard for the cold-start case sign-out alone
 * cannot cover — the app can be killed with a queue still on disk, and the
 * next person to sign in on that device may not be the one who filled it.
 */
export async function setOutboxOwner(nextOwner: string | null): Promise<void> {
  if (nextOwner === ownerId) return
  ownerId = nextOwner
  if (nextOwner === null) return

  await hydrateOutbox()
  const foreign = items.filter((i) => i.ownerId !== nextOwner)
  if (foreign.length === 0) return
  items = items.filter((i) => i.ownerId === nextOwner)
  notice = `${foreign.length} unsynced ${
    foreign.length === 1 ? 'entry from another account was' : 'entries from another account were'
  } discarded.`
  publish()
  await persist()
}

export async function enqueueOutboxItem(item: OutboxItem): Promise<void> {
  if (items.some((i) => i.client_idempotency_key === item.client_idempotency_key)) return
  items = [...items, item]
  if (items.length > MAX_QUEUE) {
    // Shed the oldest rather than refusing new writes: the user is still
    // logging, and losing the newest entry is the more surprising failure.
    const shed = items.length - MAX_QUEUE
    items = items.slice(shed)
    notice =
      shed === 1
        ? 'The offline queue is full. The oldest unsynced entry was discarded.'
        : `The offline queue is full. The ${shed} oldest unsynced entries were discarded.`
  }
  publish()
  await persist()
}

/**
 * Drop everything. Called on sign-out: queued events are attributed to
 * whichever account drains them, so carrying one user's unsynced logs into the
 * next session would mis-file them.
 */
export async function clearOutbox(): Promise<void> {
  // Bumping the generation first invalidates any hydration already in flight,
  // so a read that started before sign-out cannot re-materialise the queue.
  clearGeneration += 1
  hydration = null
  hydrated = true
  items = []
  publish()
  // Always write, even when memory was already empty: the store may hold rows
  // this session never loaded, and leaving them for the next account is
  // exactly the mis-filing this clear exists to prevent.
  await saveItems(items)
}

/* ----------------------------------------------------------------- drain */

/** The project's transport failure: ApiError.transport() reports status 0. */
export function isOfflineError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0
}

function toEvent(item: OutboxItem) {
  return {
    client_idempotency_key: item.client_idempotency_key,
    entity_type: item.entity_type,
    payload: item.payload,
  }
}

function describeDropped(labels: string[]): string {
  if (labels.length === 1) {
    return `${labels[0]} could not be saved on the server and was discarded.`
  }
  return `${labels.length} offline entries could not be saved on the server and were discarded.`
}

/**
 * Items the server could not possibly accept never reach the wire: a single
 * malformed key fails the batch envelope's validation and would take 49 good
 * events down with it.
 */
function sweepUnusable(): void {
  const unusable = items.filter((i) => !UUID_V4.test(i.client_idempotency_key))
  if (unusable.length === 0) return
  const keys = new Set(unusable.map((i) => i.client_idempotency_key))
  items = items.filter((i) => !keys.has(i.client_idempotency_key))
  notice = describeDropped(unusable.map((i) => i.label))
  publish()
}

/** One POST of up to MAX_BATCH events, plus the bookkeeping for its verdicts. */
async function sendBatch(): Promise<{ stop: boolean; removed: number }> {
  // FIFO: the server applies events in array order (drain ordering), so the
  // order the user logged them in is the order they land.
  const batch = items.slice(0, MAX_BATCH)

  let results: SyncResult[]
  try {
    const body = await apiRequest<{ results: SyncResult[] }>('/v1/sync/outbox', {
      method: 'POST',
      body: { events: batch.map(toEvent) },
    })
    results = Array.isArray(body.results) ? body.results : []
  } catch (err) {
    // Offline, unauthenticated or a server fault: the batch was never
    // adjudicated, so nothing is removed and nothing is held against the
    // items. The next foreground tries again.
    const status = err instanceof ApiError ? err.status : -1
    if (ENVELOPE_REJECTED_STATUSES.has(status)) {
      // The batch envelope itself was rejected, which is a client bug rather
      // than a server outage. Count it, so an item this build cannot express
      // correctly cannot wedge the queue forever.
      for (const item of batch) item.attempts += 1
      const spent = batch.filter((i) => i.attempts >= MAX_ATTEMPTS)
      if (spent.length > 0) {
        const keys = new Set(spent.map((i) => i.client_idempotency_key))
        items = items.filter((i) => !keys.has(i.client_idempotency_key))
        notice = describeDropped(spent.map((i) => i.label))
      }
      await persist()
      return { stop: true, removed: spent.length }
    }
    return { stop: true, removed: 0 }
  }

  const byKey = new Map<string, SyncResult>()
  for (const result of results) {
    if (result && typeof result.client_idempotency_key === 'string') {
      byKey.set(result.client_idempotency_key.toLowerCase(), result)
    }
  }

  const dropped: string[] = []
  const kept: OutboxItem[] = []

  for (const item of items) {
    const result = byKey.get(item.client_idempotency_key.toLowerCase())
    // Not in this batch, or no verdict came back for it: keep it queued.
    // Clearing an event the server never confirmed is silent, permanent loss.
    if (!result) {
      kept.push(item)
      continue
    }
    // PROCESSED covers a first application and a replay alike — including the
    // online attempt that reached the database but whose response never made
    // it back. Either way the server holds the row, so the item is done.
    if (result.status === 'PROCESSED') continue

    // FAILED. The verdict is stored against the key server-side and every
    // future replay returns it, so a terminal code can only ever be terminal.
    if (TERMINAL_ERROR_CODES.has(result.error_code ?? '')) {
      dropped.push(item.label)
      continue
    }
    // Anything else (INTERNAL_ERROR, an unknown code) gets a bounded retry:
    // it may have been a blip, but since the stored outcome is what a replay
    // returns, retrying forever would be a loop with a fixed answer.
    item.attempts += 1
    if (item.attempts >= MAX_ATTEMPTS) {
      dropped.push(item.label)
      continue
    }
    kept.push(item)
  }

  const removed = items.length - kept.length
  items = kept
  if (dropped.length > 0) notice = describeDropped(dropped)
  // Published per batch, not per drain, so a long queue visibly counts down.
  publish()
  await persist()
  return { stop: false, removed }
}

/**
 * Flush the queue. Called on app foreground, on sign-in, from the pending-sync
 * line and after any successful write. Safe to call at any time: overlapping
 * calls collapse, an empty queue is a no-op, and every send is idempotent by
 * key.
 */
export async function drainOutbox(): Promise<void> {
  if (draining) return
  await hydrateOutbox()
  if (items.length === 0) return

  draining = true
  publish()
  try {
    sweepUnusable()
    // A queue longer than one batch empties in one visit rather than one
    // batch per foreground; a round that removes nothing ends the loop, so a
    // wedged item cannot spin.
    const maxRounds = Math.ceil(MAX_QUEUE / MAX_BATCH) + 1
    for (let round = 0; round < maxRounds && items.length > 0; round++) {
      const { stop, removed } = await sendBatch()
      if (stop || removed === 0) break
    }
  } finally {
    draining = false
    publish()
  }
}
