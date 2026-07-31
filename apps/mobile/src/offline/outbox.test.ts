/**
 * The outbox is the one place in the mobile app where a bug costs a user data:
 * a wrongly-classified verdict either drops a logged event or replays it as a
 * duplicate. These tests pin the classification rules and the queue's
 * persistence, using the server contract in
 * apps/api/src/modules/sync/syncController.ts as the source of truth.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AsyncStorage from '../test/stubs/async-storage'
import type { OutboxItem, SyncResult } from './types'

const apiRequest = vi.fn()

class TestApiError extends Error {
  status: number
  code: string
  constructor(status: number, code = 'ERR') {
    super(code)
    this.status = status
    this.code = code
  }
}

vi.mock('../api/client', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  ApiError: TestApiError,
}))

// Imported after the mock so the module graph picks it up.
const outbox = await import('./outbox')
const { STORAGE_KEY } = await import('./storage')

function result(
  key: string,
  status: 'PROCESSED' | 'FAILED',
  errorCode: string | null = null,
): SyncResult {
  return { client_idempotency_key: key, status, replay: false, entity_id: null, error_code: errorCode }
}

function queued(label = 'Watered Monstera'): OutboxItem {
  return outbox.createOutboxItem('PLANT_CARE_EVENT', { plant_id: 'p1' }, label)
}

async function resetModuleState() {
  AsyncStorage.__reset()
  apiRequest.mockReset()
  outbox.__resetHydrationForTests()
  await outbox.setOutboxOwner(null)
  await outbox.setOutboxOwner('test-user')
  outbox.dismissOutboxNotice()
}

beforeEach(async () => {
  await resetModuleState()
})

describe('createOutboxItem', () => {
  it('mints a v4 UUID key so the same identity can serve the online attempt', () => {
    const item = queued()
    expect(item.client_idempotency_key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(item.attempts).toBe(0)
  })

  it('does not enqueue on its own — the online path must fail first', async () => {
    queued()
    expect(outbox.getOutboxSnapshot().pending).toBe(0)
  })
})

describe('queue persistence', () => {
  it('writes queued items to storage so they survive a cold start', async () => {
    await outbox.enqueueOutboxItem(queued())
    const raw = AsyncStorage.__raw.get(STORAGE_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toHaveLength(1)
  })

  it('ignores a duplicate key rather than queueing the same event twice', async () => {
    const item = queued()
    await outbox.enqueueOutboxItem(item)
    await outbox.enqueueOutboxItem(item)
    expect(outbox.getOutboxSnapshot().pending).toBe(1)
  })

  it('clears the queue on sign-out so events are not mis-filed to the next account', async () => {
    await outbox.enqueueOutboxItem(queued())
    await outbox.clearOutbox()
    expect(outbox.getOutboxSnapshot().pending).toBe(0)
    expect(JSON.parse(AsyncStorage.__raw.get(STORAGE_KEY)!)).toHaveLength(0)
  })
})

describe('drain classification', () => {
  it('removes items the server reports PROCESSED', async () => {
    const item = queued()
    await outbox.enqueueOutboxItem(item)
    apiRequest.mockResolvedValueOnce({
      results: [result(item.client_idempotency_key, 'PROCESSED')],
    })

    await outbox.drainOutbox()
    expect(outbox.getOutboxSnapshot().pending).toBe(0)
  })

  it('treats a replay as done — the row already exists, it is not a duplicate', async () => {
    const item = queued()
    await outbox.enqueueOutboxItem(item)
    apiRequest.mockResolvedValueOnce({
      results: [{ ...result(item.client_idempotency_key, 'PROCESSED'), replay: true, entity_id: 'e1' }],
    })

    await outbox.drainOutbox()
    expect(outbox.getOutboxSnapshot().pending).toBe(0)
  })

  it('keeps everything when the request itself fails — an unadjudicated batch is not lost', async () => {
    await outbox.enqueueOutboxItem(queued())
    apiRequest.mockRejectedValueOnce(new TestApiError(0, 'NETWORK_ERROR'))

    await outbox.drainOutbox()
    expect(outbox.getOutboxSnapshot().pending).toBe(1)
    expect(outbox.getOutboxSnapshot().notice).toBeNull()
  })

  it('keeps items the response never mentions', async () => {
    const a = queued('A')
    const b = queued('B')
    await outbox.enqueueOutboxItem(a)
    await outbox.enqueueOutboxItem(b)
    // Only A gets a verdict; B must stay queued rather than vanish.
    apiRequest.mockResolvedValueOnce({
      results: [result(a.client_idempotency_key, 'PROCESSED')],
    })

    await outbox.drainOutbox()
    const snap = outbox.getOutboxSnapshot()
    expect(snap.pending).toBe(1)
    expect(snap.items[0]!.label).toBe('B')
  })

  it('drops a terminally-rejected item and says so, rather than retrying forever', async () => {
    const item = queued('Watered Fern')
    await outbox.enqueueOutboxItem(item)
    apiRequest.mockResolvedValueOnce({
      results: [result(item.client_idempotency_key, 'FAILED', 'VALIDATION_FAILED')],
    })

    await outbox.drainOutbox()
    const snap = outbox.getOutboxSnapshot()
    expect(snap.pending).toBe(0)
    expect(snap.notice).toContain('Watered Fern')
  })

  it('retries a non-terminal failure, then gives up after three verdicts', async () => {
    const item = queued('Watered Fig')
    await outbox.enqueueOutboxItem(item)
    const failure = { results: [result(item.client_idempotency_key, 'FAILED', 'INTERNAL_ERROR')] }

    apiRequest.mockResolvedValueOnce(failure)
    await outbox.drainOutbox()
    expect(outbox.getOutboxSnapshot().pending).toBe(1)

    apiRequest.mockResolvedValueOnce(failure)
    await outbox.drainOutbox()
    expect(outbox.getOutboxSnapshot().pending).toBe(1)

    apiRequest.mockResolvedValueOnce(failure)
    await outbox.drainOutbox()
    const snap = outbox.getOutboxSnapshot()
    expect(snap.pending).toBe(0)
    expect(snap.notice).toContain('Watered Fig')
  })

  it('matches verdict keys case-insensitively', async () => {
    const item = queued()
    await outbox.enqueueOutboxItem(item)
    apiRequest.mockResolvedValueOnce({
      results: [result(item.client_idempotency_key.toUpperCase(), 'PROCESSED')],
    })

    await outbox.drainOutbox()
    expect(outbox.getOutboxSnapshot().pending).toBe(0)
  })

  it('sends the queued events as the batch body in FIFO order', async () => {
    const a = queued('A')
    const b = queued('B')
    await outbox.enqueueOutboxItem(a)
    await outbox.enqueueOutboxItem(b)
    apiRequest.mockResolvedValueOnce({
      results: [
        result(a.client_idempotency_key, 'PROCESSED'),
        result(b.client_idempotency_key, 'PROCESSED'),
      ],
    })

    await outbox.drainOutbox()
    const [path, init] = apiRequest.mock.calls[0]!
    expect(path).toBe('/v1/sync/outbox')
    expect(init.method).toBe('POST')
    expect(init.body.events.map((e: { client_idempotency_key: string }) => e.client_idempotency_key)).toEqual([
      a.client_idempotency_key,
      b.client_idempotency_key,
    ])
    // Local bookkeeping must not leak onto the wire.
    expect(init.body.events[0]).not.toHaveProperty('attempts')
    expect(init.body.events[0]).not.toHaveProperty('label')
  })

  it('does nothing when the queue is empty', async () => {
    await outbox.drainOutbox()
    expect(apiRequest).not.toHaveBeenCalled()
  })
})

describe('unadjudicated batches are never discarded', () => {
  it('keeps items when the batch POST is rate limited, without counting an attempt', async () => {
    const item = queued('Watered Palm')
    await outbox.enqueueOutboxItem(item)

    // 429 three times: the batch was never adjudicated, so nothing may be
    // dropped no matter how often it happens.
    for (let i = 0; i < 3; i++) {
      apiRequest.mockRejectedValueOnce(new TestApiError(429, 'RATE_LIMITED'))
      await outbox.drainOutbox()
    }

    const snap = outbox.getOutboxSnapshot()
    expect(snap.pending).toBe(1)
    expect(snap.notice).toBeNull()
  })

  it('keeps items when the session has expired (401), so a re-login can still sync them', async () => {
    await outbox.enqueueOutboxItem(queued())
    for (let i = 0; i < 3; i++) {
      apiRequest.mockRejectedValueOnce(new TestApiError(401, 'TOKEN_EXPIRED'))
      await outbox.drainOutbox()
    }
    expect(outbox.getOutboxSnapshot().pending).toBe(1)
  })

  it('does count a malformed envelope (422), which resending cannot fix', async () => {
    await outbox.enqueueOutboxItem(queued('Watered Ivy'))
    for (let i = 0; i < 3; i++) {
      apiRequest.mockRejectedValueOnce(new TestApiError(422, 'VALIDATION_FAILED'))
      await outbox.drainOutbox()
    }
    const snap = outbox.getOutboxSnapshot()
    expect(snap.pending).toBe(0)
    expect(snap.notice).toContain('Watered Ivy')
  })
})

describe('persistence safety', () => {
  it('does not overwrite the stored queue when the store could not be read', async () => {
    // A previous session left entries behind.
    AsyncStorage.__raw.set(
      STORAGE_KEY,
      JSON.stringify([{ ...queued('From last session'), attempts: 0 }]),
    )
    outbox.__resetHydrationForTests()

    // The read fails; enqueueing must not flush memory over those rows.
    AsyncStorage.__fail('read')
    await outbox.enqueueOutboxItem(queued('New entry'))
    AsyncStorage.__fail('none')

    const stored = JSON.parse(AsyncStorage.__raw.get(STORAGE_KEY)!)
    expect(stored).toHaveLength(1)
    expect(stored[0].label).toBe('From last session')
  })

  it('clears storage on sign-out even when this session never loaded the queue', async () => {
    AsyncStorage.__raw.set(STORAGE_KEY, JSON.stringify([queued('Another account')]))
    outbox.__resetHydrationForTests()

    await outbox.clearOutbox()
    expect(JSON.parse(AsyncStorage.__raw.get(STORAGE_KEY)!)).toHaveLength(0)
  })

  it('does not resurrect the queue when a hydration was in flight during sign-out', async () => {
    AsyncStorage.__raw.set(STORAGE_KEY, JSON.stringify([queued('Stale')]))
    outbox.__resetHydrationForTests()

    // Start a hydration, then sign out before it resolves.
    const hydrating = outbox.hydrateOutbox()
    await outbox.clearOutbox()
    await hydrating

    expect(outbox.getOutboxSnapshot().pending).toBe(0)
  })
})

describe('queue ownership', () => {
  it('discards a queue left by another account instead of posting it as this one', async () => {
    // User A was killed by the OS with two entries unsynced — no sign-out ran,
    // so the queue is still on disk when user B signs in on the same device.
    AsyncStorage.__raw.set(
      STORAGE_KEY,
      JSON.stringify([
        { ...queued('A meal'), ownerId: 'user-a' },
        { ...queued('A water entry'), ownerId: 'user-a' },
      ]),
    )
    outbox.__resetHydrationForTests()

    await outbox.setOutboxOwner('user-b')
    await outbox.drainOutbox()

    // Nothing may be sent under B's session, and B is told why the count fell.
    expect(apiRequest).not.toHaveBeenCalled()
    const snap = outbox.getOutboxSnapshot()
    expect(snap.pending).toBe(0)
    expect(snap.notice).toContain('another account')
  })

  it('keeps the queue when the same account signs back in', async () => {
    AsyncStorage.__raw.set(
      STORAGE_KEY,
      JSON.stringify([{ ...queued('Own entry'), ownerId: 'user-a' }]),
    )
    outbox.__resetHydrationForTests()

    await outbox.setOutboxOwner('user-a')
    expect(outbox.getOutboxSnapshot().pending).toBe(1)
    expect(outbox.getOutboxSnapshot().notice).toBeNull()
  })

  it('stamps new items with the signed-in account', async () => {
    await outbox.setOutboxOwner('user-a')
    const item = outbox.createOutboxItem('MEAL', { meal_type: 'LUNCH' }, 'Lunch')
    expect(item.ownerId).toBe('user-a')
  })
})

describe('isOfflineError', () => {
  it('recognises only the transport error, not a server rejection', () => {
    expect(outbox.isOfflineError(new TestApiError(0, 'NETWORK_ERROR'))).toBe(true)
    expect(outbox.isOfflineError(new TestApiError(422, 'VALIDATION_FAILED'))).toBe(false)
    expect(outbox.isOfflineError(new TestApiError(500, 'INTERNAL_ERROR'))).toBe(false)
    expect(outbox.isOfflineError(new Error('boom'))).toBe(false)
  })
})
