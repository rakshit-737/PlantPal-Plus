/**
 * Idempotency key generation (BR-SYS-05): the server accepts only UUID v4.
 * Test IDs: TC-SYS-411 ..
 */
import { describe, expect, it } from 'vitest'

import { newIdempotencyKey, UUID_V4 } from './ids'

describe('newIdempotencyKey', () => {
  it('TC-SYS-411 returns a canonical lowercase UUID v4', () => {
    const k = newIdempotencyKey()
    expect(k).toMatch(UUID_V4)
    expect(k).toBe(k.toLowerCase())
    expect(k).toHaveLength(36)
  })

  it('TC-SYS-412 sets the version nibble to 4 and the variant to 8, 9, a or b, in 5000 keys', () => {
    for (let i = 0; i < 5000; i++) {
      const k = newIdempotencyKey()
      expect(k[14]).toBe('4')
      expect('89ab').toContain(k[19]!)
    }
  })

  it('TC-SYS-413 5000 keys are all distinct', () => {
    const set = new Set(Array.from({ length: 5000 }, () => newIdempotencyKey()))
    expect(set.size).toBe(5000)
  })

  it('TC-SYS-414 hyphens sit at positions 8, 13, 18 and 23', () => {
    const k = newIdempotencyKey()
    expect([k[8], k[13], k[18], k[23]]).toEqual(['-', '-', '-', '-'])
  })

  it.each([
    ['uppercase v4', 'C232AB00-9414-41EC-B3C8-9F6BDECED846', true],
    ['version 1', 'c232ab00-9414-11ec-b3c8-9f6bdeced846', false],
    ['bad variant', 'c232ab00-9414-41ec-c3c8-9f6bdeced846', false],
    ['no hyphens', 'c232ab00941441ecb3c89f6bdeced846', false],
    ['empty', '', false],
  ])('TC-SYS-415 UUID_V4 %s -> %s', (_label, value, ok) => {
    expect(UUID_V4.test(value)).toBe(ok)
  })
})
