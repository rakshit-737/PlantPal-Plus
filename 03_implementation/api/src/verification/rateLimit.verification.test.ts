/**
 * White-box verification of the in-memory rate limiter (NFR-SEC rate limiting).
 * The limiter is bypassed under NODE_ENV=test in the routes, so it is exercised
 * directly here. No database needed.
 * Test IDs: TC-SEC-101 ..
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rateLimit } from '../http/rateLimit.ts'

const call = (mw: ReturnType<typeof rateLimit>, ip = '10.0.0.1') => {
  const headers: Record<string, string> = {}
  const req = { ip } as never
  const res = { setHeader: (k: string, v: string) => (headers[k] = v) } as never
  const next = vi.fn()
  mw(req, res, next)
  return { next, headers, error: next.mock.calls[0]?.[0] as { code?: string } | undefined }
}

describe('rateLimit', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('TC-SEC-101 allows exactly `max` requests in a window and refuses the next with RATE_LIMITED', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 3 })
    for (let i = 0; i < 3; i++) expect(call(mw).error).toBeUndefined()
    expect(call(mw).error?.code).toBe('RATE_LIMITED')
  })

  it('TC-SEC-102 the refusal carries a Retry-After header in whole seconds', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 })
    call(mw)
    const refused = call(mw)
    expect(Number(refused.headers['Retry-After'])).toBeGreaterThan(0)
    expect(Number(refused.headers['Retry-After'])).toBeLessThanOrEqual(60)
  })

  it('TC-SEC-103 the window resets after windowMs', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 })
    call(mw)
    expect(call(mw).error?.code).toBe('RATE_LIMITED')
    vi.advanceTimersByTime(60_001)
    expect(call(mw).error).toBeUndefined()
  })

  it('TC-SEC-104 limits are tracked per client address', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1 })
    call(mw, '10.0.0.1')
    expect(call(mw, '10.0.0.1').error?.code).toBe('RATE_LIMITED')
    expect(call(mw, '10.0.0.2').error).toBeUndefined()
  })

  it('TC-SEC-105 two limiters do not share counters', () => {
    const a = rateLimit({ windowMs: 60_000, max: 1 })
    const b = rateLimit({ windowMs: 60_000, max: 1 })
    call(a)
    expect(call(b).error).toBeUndefined()
  })

  it('TC-SEC-106 a request exactly at the reset instant starts a fresh window', () => {
    const mw = rateLimit({ windowMs: 1_000, max: 1 })
    call(mw)
    vi.advanceTimersByTime(1_000)
    expect(call(mw).error).toBeUndefined()
  })
})
