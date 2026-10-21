/**
 * localDateStr: the caller's local calendar date, which the API requires for
 * every dated write (BR-SYS local-date rule). Test IDs: TC-SYS-401 ..
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { localDateStr } from './dates'

afterEach(() => vi.useRealTimers())
const at = (iso: string) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
}

describe('localDateStr', () => {
  it('TC-SYS-401 returns YYYY-MM-DD', () => {
    at('2026-10-18T09:30:00')
    expect(localDateStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it.each([
    ['2026-01-05T09:00:00', '2026-01-05'],
    ['2026-09-09T09:00:00', '2026-09-09'],
    ['2026-12-31T23:59:59', '2026-12-31'],
    ['2027-01-01T00:00:00', '2027-01-01'],
    ['2028-02-29T12:00:00', '2028-02-29'],
    ['2026-03-01T00:00:01', '2026-03-01'],
  ])('TC-SYS-402 local time %s -> %s (zero padding, year and month edges, leap day)', (when, expected) => {
    at(when)
    expect(localDateStr()).toBe(expected)
  })

  it('TC-SYS-403 the date changes exactly at local midnight, not at UTC midnight', () => {
    at('2026-10-18T23:59:59')
    const before = localDateStr()
    at('2026-10-19T00:00:00')
    const after = localDateStr()
    expect(before).toBe('2026-10-18')
    expect(after).toBe('2026-10-19')
  })

  it('TC-SYS-404 the output always passes the API\'s date shape check', () => {
    for (const d of ['2026-02-28T10:00:00', '2026-11-30T10:00:00', '2030-07-04T10:00:00']) {
      at(d)
      expect(localDateStr()).toMatch(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
    }
  })
})
