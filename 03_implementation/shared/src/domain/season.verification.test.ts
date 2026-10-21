/**
 * Black-box verification of BR-PLT-03 (season derivation) and BR-PLT-04
 * (season factor). The expected values are transcribed from the specification
 * tables, not read from the implementation.
 *
 * Test IDs: TC-PLT-001 .. TC-PLT-0xx
 */
import { describe, expect, it } from 'vitest'

import { Hemisphere, Season, SEASON_FACTOR, seasonForLocalDate, seasonForMonth } from '../index.js'
import type { MonthNumber } from './season.js'

// BR-PLT-03 clause 3: month -> [NORTHERN, SOUTHERN]
const SPEC_TABLE: ReadonlyArray<[MonthNumber, string, Season, Season]> = [
  [1, 'January', 'WINTER', 'SUMMER'],
  [2, 'February', 'WINTER', 'SUMMER'],
  [3, 'March', 'SPRING', 'AUTUMN'],
  [4, 'April', 'SPRING', 'AUTUMN'],
  [5, 'May', 'SPRING', 'AUTUMN'],
  [6, 'June', 'SUMMER', 'WINTER'],
  [7, 'July', 'SUMMER', 'WINTER'],
  [8, 'August', 'SUMMER', 'WINTER'],
  [9, 'September', 'AUTUMN', 'SPRING'],
  [10, 'October', 'AUTUMN', 'SPRING'],
  [11, 'November', 'AUTUMN', 'SPRING'],
  [12, 'December', 'WINTER', 'SUMMER'],
]

describe('FR-PLT-07 / BR-PLT-03: season by month and hemisphere (36 cells)', () => {
  it.each(SPEC_TABLE)('TC-PLT-001 month %i (%s): NORTHERN=%s, SOUTHERN=%s, EQUATORIAL=YEAR_ROUND', (month, _name, north, south) => {
    expect(seasonForMonth(month, Hemisphere.NORTHERN)).toBe(north)
    expect(seasonForMonth(month, Hemisphere.SOUTHERN)).toBe(south)
    expect(seasonForMonth(month, Hemisphere.EQUATORIAL)).toBe(Season.YEAR_ROUND)
  })

  it('TC-PLT-002 southern is the northern mapping shifted by six months, for all twelve months', () => {
    for (let m = 1; m <= 12; m++) {
      const shifted = (((m + 5) % 12) + 1) as MonthNumber
      expect(seasonForMonth(m as MonthNumber, Hemisphere.SOUTHERN)).toBe(
        seasonForMonth(shifted, Hemisphere.NORTHERN),
      )
    }
  })

  it('TC-PLT-003 rejects months outside 1..12 for a seasonal hemisphere', () => {
    expect(() => seasonForMonth(0 as MonthNumber, Hemisphere.NORTHERN)).toThrow(RangeError)
    expect(() => seasonForMonth(13 as MonthNumber, Hemisphere.NORTHERN)).toThrow(RangeError)
    expect(() => seasonForMonth(0 as MonthNumber, Hemisphere.SOUTHERN)).toThrow(RangeError)
  })
})

describe('BR-PLT-03 clause 2: the local date decides, never the server clock', () => {
  it('TC-PLT-004 resolves the month from the YYYY-MM-DD string at both ends of a month', () => {
    expect(seasonForLocalDate('2026-02-28', Hemisphere.NORTHERN)).toBe('WINTER')
    expect(seasonForLocalDate('2026-03-01', Hemisphere.NORTHERN)).toBe('SPRING')
    expect(seasonForLocalDate('2026-05-31', Hemisphere.NORTHERN)).toBe('SPRING')
    expect(seasonForLocalDate('2026-06-01', Hemisphere.NORTHERN)).toBe('SUMMER')
    expect(seasonForLocalDate('2026-11-30', Hemisphere.NORTHERN)).toBe('AUTUMN')
    expect(seasonForLocalDate('2026-12-01', Hemisphere.NORTHERN)).toBe('WINTER')
  })

  it('TC-PLT-005 a leap day resolves like any February day', () => {
    expect(seasonForLocalDate('2028-02-29', Hemisphere.NORTHERN)).toBe('WINTER')
    expect(seasonForLocalDate('2028-02-29', Hemisphere.SOUTHERN)).toBe('SUMMER')
  })

  it('TC-PLT-006 the equatorial hemisphere is YEAR_ROUND on any date', () => {
    for (const d of ['2026-01-01', '2026-04-15', '2026-07-31', '2026-12-31']) {
      expect(seasonForLocalDate(d, Hemisphere.EQUATORIAL)).toBe(Season.YEAR_ROUND)
    }
  })

  it.each([
    ['empty string', ''],
    ['no dashes', '20260715'],
    ['slashes', '2026/07/15'],
    ['two-digit year', '26-07-15'],
    ['month 00', '2026-00-10'],
    ['month 13', '2026-13-10'],
    ['trailing text', '2026-07-15T00:00:00Z'],
    ['letters', 'abcd-ef-gh'],
  ])('TC-PLT-007 rejects a malformed date: %s', (_label, value) => {
    expect(() => seasonForLocalDate(value, Hemisphere.NORTHERN)).toThrow(RangeError)
  })
})

describe('BR-PLT-04: season factor table', () => {
  it.each([
    ['SPRING', 0.95],
    ['SUMMER', 0.8],
    ['AUTUMN', 1.15],
    ['WINTER', 1.4],
    ['YEAR_ROUND', 1.0],
  ] as const)('TC-PLT-008 %s has factor %f', (season, factor) => {
    expect(SEASON_FACTOR[season]).toBe(factor)
  })

  it('TC-PLT-009 summer shortens and winter lengthens the interval relative to the baseline', () => {
    expect(SEASON_FACTOR.SUMMER).toBeLessThan(1)
    expect(SEASON_FACTOR.WINTER).toBeGreaterThan(1)
    expect(Math.max(...Object.values(SEASON_FACTOR))).toBe(SEASON_FACTOR.WINTER)
  })

  it('TC-PLT-010 the factor table is frozen so no caller can alter a published multiplier', () => {
    expect(Object.isFrozen(SEASON_FACTOR)).toBe(true)
  })
})
