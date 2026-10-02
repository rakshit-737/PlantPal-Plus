/**
 * Display formatting for the local calendar dates the API stores as
 * `YYYY-MM-DD` strings. They are wall-clock dates, not instants, so they are
 * parsed as local midnight: going through `new Date('2026-09-30')` would read
 * them as UTC and show the previous day to anyone west of Greenwich.
 *
 * The abbreviations are spelled out rather than taken from Intl: ICU versions
 * disagree on "Sep" versus "Sept" and on where commas go, and a ledger should
 * read the same in every browser.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** "2026-09-30" → "Wed 30 Sep"; the year is added only when it is not this one. */
export function fmtDay(iso: string, now: Date = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const d = new Date(year, month, day)
  // Rejects impossible dates such as 2026-02-31, which Date would roll over.
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return iso
  const base = `${WEEKDAYS[d.getDay()]} ${day} ${MONTHS[month]}`
  return year === now.getFullYear() ? base : `${base} ${year}`
}
