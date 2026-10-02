import { describe, expect, it } from 'vitest'

import {
  advanceStreakOnLog,
  EMPTY_STREAK,
  localDateDiffDays,
  type StreakState,
} from './streak.js'

function state(overrides: Partial<StreakState> = {}): StreakState {
  return { ...EMPTY_STREAK, ...overrides }
}

describe('localDateDiffDays', () => {
  it('computes whole-day differences', () => {
    expect(localDateDiffDays('2026-07-24', '2026-07-25')).toBe(1)
    expect(localDateDiffDays('2026-07-25', '2026-07-25')).toBe(0)
    expect(localDateDiffDays('2026-07-25', '2026-07-24')).toBe(-1)
    expect(localDateDiffDays('2026-02-28', '2026-03-01')).toBe(1)
  })

  it('rejects malformed dates', () => {
    expect(() => localDateDiffDays('2026-7-1', '2026-07-25')).toThrow(RangeError)
  })
})

describe('advanceStreakOnLog (BR-GAM-07)', () => {
  it('first ever MET day starts the streak at 1', () => {
    const next = advanceStreakOnLog(EMPTY_STREAK, '2026-07-25')
    expect(next).toEqual(state({ currentLength: 1, longestLength: 1, lastCountedDate: '2026-07-25' }))
  })

  it('a second log on the same day is a no-op — exactly once per date', () => {
    const s = state({ currentLength: 3, longestLength: 5, lastCountedDate: '2026-07-25' })
    expect(advanceStreakOnLog(s, '2026-07-25')).toEqual(s)
  })

  it('a backdated log before the last counted date is ignored', () => {
    const s = state({ currentLength: 3, longestLength: 5, lastCountedDate: '2026-07-25' })
    expect(advanceStreakOnLog(s, '2026-07-20')).toEqual(s)
  })

  it('a consecutive MET day increments and tracks longest (BR-GAM-08)', () => {
    const s = state({ currentLength: 5, longestLength: 5, lastCountedDate: '2026-07-24' })
    const next = advanceStreakOnLog(s, '2026-07-25')
    expect(next.currentLength).toBe(6)
    expect(next.longestLength).toBe(6)
    expect(next.lastCountedDate).toBe('2026-07-25')
  })

  it('longest never decreases when current is below it', () => {
    const s = state({ currentLength: 2, longestLength: 10, lastCountedDate: '2026-07-24' })
    expect(advanceStreakOnLog(s, '2026-07-25').longestLength).toBe(10)
  })

  it('one missed day with a freeze token: token consumed, streak continues (FROZEN row)', () => {
    const s = state({
      currentLength: 7,
      longestLength: 7,
      lastCountedDate: '2026-07-23',
      freezeTokens: 2,
    })
    const next = advanceStreakOnLog(s, '2026-07-25') // 07-24 missed
    expect(next).toEqual(
      state({
        currentLength: 8,
        longestLength: 8,
        lastCountedDate: '2026-07-25',
        freezeTokens: 1,
      }),
    )
  })

  it('a two-day gap consumes two tokens when available', () => {
    const s = state({
      currentLength: 4,
      longestLength: 9,
      lastCountedDate: '2026-07-21',
      freezeTokens: 3,
    })
    const next = advanceStreakOnLog(s, '2026-07-24') // 07-22 and 07-23 missed
    expect(next.currentLength).toBe(5)
    expect(next.freezeTokens).toBe(1)
  })

  it('a gap larger than the token balance resets to 1 and keeps the tokens (NOT_MET row)', () => {
    const s = state({
      currentLength: 12,
      longestLength: 12,
      lastCountedDate: '2026-07-20',
      freezeTokens: 1,
    })
    const next = advanceStreakOnLog(s, '2026-07-25') // four missed days, one token
    expect(next).toEqual(
      state({
        currentLength: 1,
        longestLength: 12,
        lastCountedDate: '2026-07-25',
        freezeTokens: 1,
      }),
    )
  })

  it('a reset after a long gap with zero tokens starts a fresh streak', () => {
    const s = state({ currentLength: 30, longestLength: 30, lastCountedDate: '2026-06-01' })
    const next = advanceStreakOnLog(s, '2026-07-25')
    expect(next.currentLength).toBe(1)
    expect(next.longestLength).toBe(30)
  })
})
