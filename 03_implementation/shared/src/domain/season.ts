/**
 * Season derivation — BR-PLT-03.
 *
 * The mapping is whole-month meteorological rather than astronomical. The
 * requirement makes that choice deliberately: the underlying horticultural
 * guidance is coarse, and a whole-month rule is exhaustively testable at exactly
 * twelve points per hemisphere without needing an ephemeris.
 *
 * BR-PLT-03 clause 7 requires this to be implemented once in the shared package
 * and never duplicated, because the gamification module reuses it for seasonal
 * achievement predicates.
 */

import { Hemisphere, Season } from './enums.js'

/** Month index 1 = January … 12 = December, matching human convention rather than `Date.getMonth()`. */
export type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

const NORTHERN_BY_MONTH: readonly Season[] = [
  Season.WINTER, // January
  Season.WINTER, // February
  Season.SPRING, // March
  Season.SPRING, // April
  Season.SPRING, // May
  Season.SUMMER, // June
  Season.SUMMER, // July
  Season.SUMMER, // August
  Season.AUTUMN, // September
  Season.AUTUMN, // October
  Season.AUTUMN, // November
  Season.WINTER, // December
]

/** The southern hemisphere is the northern mapping offset by six months. */
const SOUTHERN_OPPOSITE: Readonly<Record<Season, Season>> = Object.freeze({
  [Season.WINTER]: Season.SUMMER,
  [Season.SUMMER]: Season.WINTER,
  [Season.SPRING]: Season.AUTUMN,
  [Season.AUTUMN]: Season.SPRING,
  [Season.YEAR_ROUND]: Season.YEAR_ROUND,
})

/**
 * Resolve the season for a calendar month in the user's hemisphere.
 *
 * Equatorial users always resolve to YEAR_ROUND (BR-PLT-03 clause 4): temperate
 * four-season seasonality does not describe the climate near the equator, so the
 * product applies no seasonal adjustment rather than a wrong one.
 */
export function seasonForMonth(month: MonthNumber, hemisphere: Hemisphere): Season {
  if (hemisphere === Hemisphere.EQUATORIAL) return Season.YEAR_ROUND

  const northern = NORTHERN_BY_MONTH[month - 1]
  if (northern === undefined) {
    throw new RangeError(`seasonForMonth expected a month in 1..12, received ${month}`)
  }
  return hemisphere === Hemisphere.NORTHERN ? northern : SOUTHERN_OPPOSITE[northern]
}

/**
 * Resolve the season for a local calendar date.
 *
 * Takes the user's *local* date as a plain `YYYY-MM-DD` string rather than a
 * `Date`, because the season must follow the user's local day and never the
 * server's. Passing a `Date` here would invite an accidental UTC read that shifts
 * the month for users either side of midnight.
 */
export function seasonForLocalDate(localDate: string, hemisphere: Hemisphere): Season {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate)
  if (!match?.[2]) {
    throw new RangeError(`seasonForLocalDate expected a YYYY-MM-DD date, received "${localDate}"`)
  }
  const month = Number(match[2])
  if (month < 1 || month > 12) {
    throw new RangeError(`seasonForLocalDate received an out-of-range month in "${localDate}"`)
  }
  return seasonForMonth(month as MonthNumber, hemisphere)
}
