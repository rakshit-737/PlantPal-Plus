import { describe, expect, it } from 'vitest'

import { fmtDay } from './dates'

const NOW = new Date(2026, 9, 1) // 1 Oct 2026, local

describe('fmtDay', () => {
  it('formats a date in the current year without the year', () => {
    expect(fmtDay('2026-09-30', NOW)).toBe('Wed 30 Sep')
  })

  it('adds the year for another year', () => {
    expect(fmtDay('2025-12-31', NOW)).toBe('Wed 31 Dec 2025')
  })

  it('reads the string as a local date, never shifting it a day', () => {
    expect(fmtDay('2026-10-01', NOW)).toMatch(/^Thu 1 Oct$/)
  })

  it('passes anything that is not YYYY-MM-DD through untouched', () => {
    expect(fmtDay('yesterday', NOW)).toBe('yesterday')
  })
})
