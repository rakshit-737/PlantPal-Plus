import { afterEach, describe, expect, it, vi } from 'vitest'
import { chunkMessages, sendPushMessages, EXPO_PUSH_BATCH_LIMIT } from './expoPush.ts'

const msgs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ to: `t${i}`, title: 'a', body: 'b' }))

afterEach(() => vi.unstubAllGlobals())

describe('FR-NOT-16 chunked submission', () => {
  it('TC-NOT-201 limit is 100', () => {
    expect(EXPO_PUSH_BATCH_LIMIT).toBe(100)
  })
  it('TC-NOT-202 empty input gives no batches', () => {
    expect(chunkMessages([])).toEqual([])
  })
  it('TC-NOT-203 100 messages give one batch', () => {
    expect(chunkMessages(msgs(100)).map((c) => c.length)).toEqual([100])
  })
  it('TC-NOT-204 101 messages give 100 and 1', () => {
    expect(chunkMessages(msgs(101)).map((c) => c.length)).toEqual([100, 1])
  })
  it('TC-NOT-205 250 messages give 100, 100, 50 and keep order', () => {
    const c = chunkMessages(msgs(250))
    expect(c.map((x) => x.length)).toEqual([100, 100, 50])
    expect(c.flat().map((m) => m.to)).toEqual(msgs(250).map((m) => m.to))
  })
  it('TC-NOT-206 sends one request per batch', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }))
    vi.stubGlobal('fetch', f)
    await sendPushMessages(msgs(201))
    expect(f).toHaveBeenCalledTimes(3)
  })
})

describe('FR-NOT-15 ticket handling', () => {
  it('TC-NOT-207 ok, DeviceNotRegistered and other errors are separated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            { status: 'ok' },
            { status: 'error', details: { error: 'DeviceNotRegistered' } },
            { status: 'error', details: { error: 'MessageRateExceeded' } },
          ],
        }),
      })),
    )
    const r = await sendPushMessages(msgs(3))
    expect(r.delivered).toEqual(['t0'])
    expect(r.notRegistered).toEqual(['t1'])
    expect(r.failed).toEqual(['t2'])
  })
  it('TC-NOT-208 missing ticket counts as failed, not delivered', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ status: 'ok' }] }) })))
    const r = await sendPushMessages(msgs(2))
    expect(r.delivered).toEqual(['t0'])
    expect(r.failed).toEqual(['t1'])
  })
  it('TC-NOT-209 non-2xx batch marks every token failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))
    const r = await sendPushMessages(msgs(3))
    expect(r.failed).toEqual(['t0', 't1', 't2'])
  })
  it('TC-NOT-210 network error marks batch failed and later batches still run', async () => {
    const f = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ status: 'ok' }] }) })
    vi.stubGlobal('fetch', f)
    const r = await sendPushMessages(msgs(101))
    expect(r.failed.length).toBe(100)
    expect(r.delivered).toEqual(['t100'])
  })
})
