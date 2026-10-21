/**
 * State-transition verification of the streak rules (BR-GAM-07, BR-GAM-08):
 * counted day, gap, freeze tokens, calendar edges.
 * Test IDs: TC-GAM-001 ..
 */
import { describe, expect, it } from 'vitest'

import { advanceStreakOnLog, EMPTY_STREAK, localDateDiffDays, type StreakState } from '../index.js'

const s = (over: Partial<StreakState> = {}): StreakState => ({ ...EMPTY_STREAK, ...over })

describe('state transitions', () => {
  it('TC-GAM-001 the empty state is 0 / 0 / null / 0 tokens', () => {
    expect(EMPTY_STREAK).toEqual({ currentLength: 0, longestLength: 0, lastCountedDate: null, freezeTokens: 0 })
  })

  it('TC-GAM-002 first ever log starts the streak at 1', () => {
    expect(advanceStreakOnLog(EMPTY_STREAK, '2026-07-01')).toMatchObject({ currentLength: 1, longestLength: 1, lastCountedDate: '2026-07-01' })
  })

  it('TC-GAM-003 a log on the following day increments by exactly 1', () => {
    const next = advanceStreakOnLog(s({ currentLength: 4, longestLength: 4, lastCountedDate: '2026-07-01' }), '2026-07-02')
    expect(next).toMatchObject({ currentLength: 5, longestLength: 5, lastCountedDate: '2026-07-02' })
  })

  it('TC-GAM-004 the same day twice is idempotent and returns the same state', () => {
    const state = s({ currentLength: 3, longestLength: 3, lastCountedDate: '2026-07-02' })
    expect(advanceStreakOnLog(state, '2026-07-02')).toEqual(state)
  })

  it('TC-GAM-005 a backdated log never changes the streak', () => {
    const state = s({ currentLength: 3, longestLength: 3, lastCountedDate: '2026-07-10' })
    expect(advanceStreakOnLog(state, '2026-07-05')).toEqual(state)
  })

  it('TC-GAM-006 a gap with no tokens resets current to 1 and keeps the longest', () => {
    const next = advanceStreakOnLog(s({ currentLength: 9, longestLength: 9, lastCountedDate: '2026-07-01' }), '2026-07-03')
    expect(next).toMatchObject({ currentLength: 1, longestLength: 9, lastCountedDate: '2026-07-03' })
  })

  it('TC-GAM-007 one missed day is bridged by exactly one token', () => {
    const next = advanceStreakOnLog(s({ currentLength: 5, longestLength: 5, lastCountedDate: '2026-07-01', freezeTokens: 2 }), '2026-07-03')
    expect(next).toMatchObject({ currentLength: 6, freezeTokens: 1 })
  })

  it('TC-GAM-008 a gap larger than the token balance resets and leaves the tokens untouched', () => {
    const next = advanceStreakOnLog(s({ currentLength: 5, longestLength: 5, lastCountedDate: '2026-07-01', freezeTokens: 1 }), '2026-07-05')
    expect(next).toMatchObject({ currentLength: 1, freezeTokens: 1 })
  })

  it('TC-GAM-009 tokens exactly equal to the missed days are all consumed (boundary)', () => {
    const next = advanceStreakOnLog(s({ currentLength: 5, longestLength: 5, lastCountedDate: '2026-07-01', freezeTokens: 3 }), '2026-07-05')
    expect(next).toMatchObject({ currentLength: 6, freezeTokens: 0 })
  })

  it('TC-GAM-010 one token short of the missed days resets (boundary)', () => {
    const next = advanceStreakOnLog(s({ currentLength: 5, longestLength: 5, lastCountedDate: '2026-07-01', freezeTokens: 2 }), '2026-07-05')
    expect(next.currentLength).toBe(1)
  })

  it('TC-GAM-011 longest rises with current but never falls', () => {
    const rising = advanceStreakOnLog(s({ currentLength: 7, longestLength: 7, lastCountedDate: '2026-07-01' }), '2026-07-02')
    expect(rising.longestLength).toBe(8)
    const lower = advanceStreakOnLog(s({ currentLength: 2, longestLength: 30, lastCountedDate: '2026-07-01' }), '2026-07-02')
    expect(lower.longestLength).toBe(30)
  })

  it('TC-GAM-012 never mutates the state it was given', () => {
    const state = Object.freeze(s({ currentLength: 2, longestLength: 2, lastCountedDate: '2026-07-01' }))
    expect(() => advanceStreakOnLog(state, '2026-07-02')).not.toThrow()
  })
})

describe('calendar edges (local-date strings, no time zone arithmetic)', () => {
  it.each([
    ['month end', '2026-01-31', '2026-02-01'],
    ['year end', '2026-12-31', '2027-01-01'],
    ['leap day in', '2028-02-28', '2028-02-29'],
    ['leap day out', '2028-02-29', '2028-03-01'],
    ['non-leap February', '2027-02-28', '2027-03-01'],
    ['EU spring-forward weekend', '2026-03-28', '2026-03-29'],
    ['EU fall-back weekend', '2026-10-24', '2026-10-25'],
    ['US spring-forward', '2026-03-07', '2026-03-08'],
    ['US fall-back', '2026-10-31', '2026-11-01'],
  ])('TC-GAM-013 %s counts as exactly one day (%s -> %s)', (_l, a, b) => {
    expect(localDateDiffDays(a, b)).toBe(1)
    const next = advanceStreakOnLog(s({ currentLength: 1, longestLength: 1, lastCountedDate: a }), b)
    expect(next.currentLength).toBe(2)
  })

  it('TC-GAM-014 a full year apart is 365 (or 366 over a leap February) days', () => {
    expect(localDateDiffDays('2026-01-01', '2027-01-01')).toBe(365)
    expect(localDateDiffDays('2028-01-01', '2029-01-01')).toBe(366)
  })

  it('TC-GAM-015 the difference is signed', () => {
    expect(localDateDiffDays('2026-07-10', '2026-07-05')).toBe(-5)
    expect(localDateDiffDays('2026-07-05', '2026-07-05')).toBe(0)
  })

  it.each(['', '2026-7-1', '07/01/2026', '2026-07-01T00:00:00Z', 'yesterday'])('TC-GAM-016 rejects the date %j', (bad) => {
    expect(() => localDateDiffDays(bad, '2026-07-01')).toThrow(RangeError)
    expect(() => advanceStreakOnLog(EMPTY_STREAK, bad)).toThrow(RangeError)
  })

  it('TC-GAM-017 [DEF-004] a syntactically valid but impossible date is rejected', () => {
    // 2026-02-30 and 2026-13-45 match YYYY-MM-DD, so the regex accepts them and
    // Date.parse returns NaN: the difference becomes NaN and the comparison
    // `diff <= 0` is false, so the streak silently resets instead of failing fast.
    const state = s({ currentLength: 5, longestLength: 5, lastCountedDate: '2026-07-01' })
    expect(() => advanceStreakOnLog(state, '2026-02-30')).toThrow(RangeError)
    expect(() => localDateDiffDays('2026-07-01', '2026-13-45')).toThrow(RangeError)
  })
})
