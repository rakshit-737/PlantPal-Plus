/**
 * Write-through (online first, queue on transport failure): FR-SYS offline
 * behaviour. Test IDs: TC-SYS-421 ..
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AsyncStorage from '../test/stubs/async-storage'

const apiRequest = vi.fn()
class TestApiError extends Error {
  status: number
  code: string
  details: { field: string; issue: string }[]
  constructor(status: number, message = 'msg', details: { field: string; issue: string }[] = []) {
    super(message)
    this.status = status
    this.code = 'ERR'
    this.details = details
  }
}
vi.mock('../api/client', () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a), ApiError: TestApiError }))

const outbox = await import('./outbox')
const wt = await import('./writeThrough')
const { UUID_V4 } = await import('./ids')

async function reset() {
  AsyncStorage.__reset()
  apiRequest.mockReset()
  outbox.__resetHydrationForTests()
  await outbox.setOutboxOwner('user-1')
}
const offline = () => new TestApiError(0, 'Network request failed')

describe('write-through', () => {
  beforeEach(reset)

  it('TC-SYS-421 online success returns the data, is not queued, and uses one v4 idempotency key', async () => {
    apiRequest.mockResolvedValue({ id: 'w1' })
    const r = await wt.logWorkoutWriteThrough({ activity_type: 'RUN', duration_mins: 30, local_date_str: '2026-10-18' })
    expect(r).toEqual({ queued: false, data: { id: 'w1' } })
    const body = apiRequest.mock.calls[0]![1].body
    expect(body.client_idempotency_key).toMatch(UUID_V4)
    expect(outbox.getOutboxSnapshot().pending).toBe(0)
  })

  it('TC-SYS-422 a transport failure queues the write with the SAME key and tells the user it is saved on the device', async () => {
    apiRequest.mockRejectedValue(offline())
    const r = await wt.logWaterWriteThrough(250, '2026-10-18')
    expect(r).toEqual({ queued: true, message: wt.QUEUED_MESSAGE })
    const sentKey = apiRequest.mock.calls[0]![1].body.client_idempotency_key
    const items = outbox.getOutboxSnapshot().items
    expect(items).toHaveLength(1)
    expect(items[0]!.client_idempotency_key).toBe(sentKey)
    expect(items[0]!.entity_type).toBe('WATER_LOG')
  })

  it('TC-SYS-423 a server rejection (not a transport failure) is thrown to the caller and is never queued', async () => {
    apiRequest.mockRejectedValue(new TestApiError(422, 'Invalid', [{ field: 'amount_ml', issue: 'out_of_range' }]))
    await expect(wt.logWaterWriteThrough(0, '2026-10-18')).rejects.toBeInstanceOf(TestApiError)
    expect(outbox.getOutboxSnapshot().pending).toBe(0)
  })

  it('TC-SYS-424 a non-API error is rethrown and never queued', async () => {
    apiRequest.mockRejectedValue(new Error('boom'))
    await expect(wt.logWaterWriteThrough(250, '2026-10-18')).rejects.toThrow('boom')
    expect(outbox.getOutboxSnapshot().pending).toBe(0)
  })

  it('TC-SYS-425 two offline writes are queued in order', async () => {
    apiRequest.mockRejectedValue(offline())
    await wt.logWaterWriteThrough(100, '2026-10-18')
    await wt.logWaterWriteThrough(200, '2026-10-18')
    expect(outbox.getOutboxSnapshot().items.map((i) => i.payload.amount_ml)).toEqual([100, 200])
  })

  it('TC-SYS-426 care payload omits an empty note and keeps the plant id and date', async () => {
    apiRequest.mockResolvedValue({ status: 'ok' })
    await wt.logCareWriteThrough('p1', { action_type: 'WATER', local_date_str: '2026-10-18', note: '' })
    const [path, opts] = apiRequest.mock.calls[0]!
    expect(path).toBe('/v1/plants/p1/care')
    expect(opts.body).not.toHaveProperty('note')
    expect(opts.body).toMatchObject({ action_type: 'WATER', local_date_str: '2026-10-18' })
  })

  it('TC-SYS-427 workout payload keeps a zero step count but omits fields that were not given', async () => {
    apiRequest.mockResolvedValue({})
    await wt.logWorkoutWriteThrough({ activity_type: 'WALK', steps: 0, local_date_str: '2026-10-18' })
    const body = apiRequest.mock.calls[0]![1].body
    expect(body.steps).toBe(0)
    expect(body).not.toHaveProperty('duration_mins')
    expect(body).not.toHaveProperty('note')
  })

  it('TC-SYS-428 the queued meal payload contains only fields the server\'s strict schema accepts', async () => {
    apiRequest.mockRejectedValue(offline())
    await wt.logMealWriteThrough({
      meal_type: 'LUNCH', local_date_str: '2026-10-18', note: '',
      items: [{ food_name_at_log: 'Rice', quantity: 1, serving_unit: 'CUP', grams: 150, kcal: 200, protein_g: 4, carbs_g: 44, fat_g: 0.4, extra: 'x' } as never],
    })
    const queued = outbox.getOutboxSnapshot().items[0]!.payload as { items: Record<string, unknown>[] }
    expect(Object.keys(queued.items[0]!).sort()).toEqual(['carbs_g', 'fat_g', 'food_name_at_log', 'grams', 'kcal', 'protein_g', 'quantity', 'serving_unit'])
    expect(queued).not.toHaveProperty('note')
  })

  it('TC-SYS-429 a meal item keeps its food_id only when one was chosen', async () => {
    apiRequest.mockRejectedValue(offline())
    const base = { food_name_at_log: 'Rice', quantity: 1, serving_unit: 'CUP', grams: 150, kcal: 200, protein_g: 4, carbs_g: 44, fat_g: 0.4 }
    await wt.logMealWriteThrough({ meal_type: 'LUNCH', local_date_str: '2026-10-18', items: [{ ...base, food_id: 'f1' }, base] })
    const items = (outbox.getOutboxSnapshot().items[0]!.payload as { items: Record<string, unknown>[] }).items
    expect(items[0]).toHaveProperty('food_id', 'f1')
    expect(items[1]).not.toHaveProperty('food_id')
  })
})

describe('describeWriteError', () => {
  it('TC-SYS-431 shows the server message with the first field detail for a 4xx', () => {
    const e = new TestApiError(422, 'Please check this', [{ field: 'amount_ml', issue: 'out_of_range' }])
    expect(wt.describeWriteError(e, 'fallback')).toBe('Please check this (amount_ml: out_of_range)')
  })

  it('TC-SYS-432 shows just the message when there is no detail', () => {
    expect(wt.describeWriteError(new TestApiError(409, 'Conflict'), 'fallback')).toBe('Conflict')
  })

  it.each([[500], [503], [0]])('TC-SYS-433 a %i response never leaks its message; the fallback is used', (status) => {
    expect(wt.describeWriteError(new TestApiError(status, 'internal detail'), 'Try again later')).toBe('Try again later')
  })

  it('TC-SYS-434 a non-API error uses the fallback', () => {
    expect(wt.describeWriteError(new Error('x'), 'Try again later')).toBe('Try again later')
  })
})
