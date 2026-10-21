/**
 * Boundary verification of the reminder planner and dispatcher against
 * BR-NOT-08 (quiet hours predicate), BR-NOT-13 (daily cap) and the planning
 * horizon. Test IDs: TC-NOT-101 ..
 */
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  isWithinQuietHours,
  MAX_DELIVERY_ATTEMPTS,
  planWateringReminders,
  tick,
  type UserNotificationSettings,
} from './reminderEngine.ts'

const S = (over: Partial<UserNotificationSettings> = {}): UserNotificationSettings => ({ ...DEFAULT_NOTIFICATION_SETTINGS, quiet_hours_mode: 'WINDOW', quiet_start_time: '22:00', quiet_end_time: '07:00', timezone: 'UTC', ...over })
const d = (iso: string) => new Date(iso)

describe('planWateringReminders horizon', () => {
  const now = d('2026-10-18T12:00:00Z')
  const plant = (iso: string, id = 'p1') => ({ plant_id: id, user_id: 'u1', nickname: 'Fern', next_water_due_at: d(iso) })

  it('TC-NOT-101 a plant due exactly at the 24 h horizon is planned; one millisecond later is not', () => {
    expect(planWateringReminders(now, [plant('2026-10-19T12:00:00.000Z')])).toHaveLength(1)
    expect(planWateringReminders(now, [plant('2026-10-19T12:00:00.001Z')])).toHaveLength(0)
  })

  it('TC-NOT-102 an overdue plant says "is due for watering"; a not-yet-due one says "needs water soon"', () => {
    const [overdue] = planWateringReminders(now, [plant('2026-10-17T00:00:00Z')])
    const [soon] = planWateringReminders(now, [plant('2026-10-18T18:00:00Z')])
    expect(overdue!.body).toBe('Fern is due for watering.')
    expect(soon!.body).toBe('Fern needs water soon.')
  })

  it('TC-NOT-103 a plant due exactly now reads as due, and fires now', () => {
    const [r] = planWateringReminders(now, [plant('2026-10-18T12:00:00Z')])
    expect(r!.body).toBe('Fern is due for watering.')
    expect(r!.due_at_utc.getTime()).toBe(now.getTime())
  })

  it('TC-NOT-104 a custom horizon of 0 plans only what is due now or overdue', () => {
    const rows = [plant('2026-10-18T11:00:00Z', 'a'), plant('2026-10-18T12:00:01Z', 'b')]
    expect(planWateringReminders(now, rows, 0).map((r) => r.target_entity_id)).toEqual(['a'])
  })

  it('TC-NOT-105 an empty list plans nothing and the planner keeps input order', () => {
    expect(planWateringReminders(now, [])).toEqual([])
    const rows = [plant('2026-10-18T20:00:00Z', 'x'), plant('2026-10-18T13:00:00Z', 'y')]
    expect(planWateringReminders(now, rows).map((r) => r.target_entity_id)).toEqual(['x', 'y'])
  })

  it('TC-NOT-106 the title names the plant and the type is WATER_PLANT targeting a PLANT', () => {
    const [r] = planWateringReminders(now, [plant('2026-10-18T13:00:00Z')])
    expect(r).toMatchObject({ title: 'Water Fern', reminder_type: 'WATER_PLANT', target_entity_type: 'PLANT' })
  })
})

describe('BR-NOT-08 quiet-hours predicate: start inclusive, end exclusive', () => {
  it.each([
    ['21:59', false], ['22:00', true], ['22:01', true], ['23:59', true], ['00:00', true],
    ['06:59', true], ['07:00', false], ['07:01', false], ['12:00', false],
  ])('TC-NOT-107 crossing window 22:00-07:00 at %s -> quiet=%s', (hhmm, quiet) => {
    expect(isWithinQuietHours(d(`2026-10-18T${hhmm}:00Z`), S())).toBe(quiet)
  })

  it.each([
    ['12:59', false], ['13:00', true], ['14:59', true], ['15:00', false],
  ])('TC-NOT-108 non-crossing window 13:00-15:00 at %s -> quiet=%s', (hhmm, quiet) => {
    expect(isWithinQuietHours(d(`2026-10-18T${hhmm}:00Z`), S({ quiet_start_time: '13:00', quiet_end_time: '15:00' }))).toBe(quiet)
  })

  it('TC-NOT-109 a reminder due exactly at the window end is NOT deferred (BR-NOT-08 cl. 1)', () => {
    const decision = tick(d('2026-10-18T07:00:00Z'), [{ id: 'r', user_id: 'u', due_at_utc: d('2026-10-18T07:00:00Z'), attempts: 0 }], { settings: new Map([['u', S()]]) })
    expect(decision.send).toEqual(['r'])
  })

  it('TC-NOT-110 the window is evaluated in the user\'s zone: 22:30 in Kolkata is 17:00 UTC', () => {
    const settings = S({ timezone: 'Asia/Kolkata' })
    expect(isWithinQuietHours(d('2026-10-18T17:00:00Z'), settings)).toBe(true)
    expect(isWithinQuietHours(d('2026-10-18T02:00:00Z'), settings)).toBe(false) // 07:30 IST, after the 07:00 end
  })

  it('TC-NOT-111 across a DST change the local wall clock decides (New York, spring forward 2026-03-08)', () => {
    const settings = S({ timezone: 'America/New_York', quiet_start_time: '02:30', quiet_end_time: '03:30' })
    // 03:15 EDT local on the transition day = 07:15 UTC.
    expect(isWithinQuietHours(d('2026-03-08T07:15:00Z'), settings)).toBe(true)
    expect(isWithinQuietHours(d('2026-03-08T08:00:00Z'), settings)).toBe(false) // 04:00 EDT
  })

  it.each(['7:00', '07:00:00', '07:00:00.000'])('TC-NOT-112 accepts the time spellings %s', (end) => {
    expect(() => isWithinQuietHours(d('2026-10-18T03:00:00Z'), S({ quiet_end_time: end }))).not.toThrow()
  })

  it.each(['24:00', 'abc', '', '25:00'])('TC-NOT-113 an unparseable bound %j means "no window", never "always quiet"', (bad) => {
    expect(isWithinQuietHours(d('2026-10-18T03:00:00Z'), S({ quiet_end_time: bad }))).toBe(false)
  })
})

describe('time parsing', () => {
  it('TC-NOT-113b [DEF-021] a minute value of 60 or more is rejected, not rolled into the next hour', () => {
    // "12:60" is read as 13:00. A PostgreSQL time column cannot hold it, so it is
    // unreachable through the API today, but the parser is the last line of defence.
    const s = S({ quiet_start_time: '12:00', quiet_end_time: '12:60' })
    expect(isWithinQuietHours(d('2026-10-18T12:30:00Z'), s)).toBe(false)
  })
})

describe('BR-NOT-13 daily cap and attempts boundary', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${String(i).padStart(2, '0')}`, user_id: 'u', due_at_utc: d(`2026-10-18T10:${String(i).padStart(2, '0')}:00Z`), attempts: 0 }))
  const now = d('2026-10-18T12:00:00Z')
  const cfg = (cap: number) => new Map([['u', S({ quiet_hours_mode: 'OFF', daily_notification_cap: cap })]])

  it('TC-NOT-114 exactly cap reminders are sent, the next is deferred with DAILY_CAP_REACHED', () => {
    const out = tick(now, rows(4), { settings: cfg(3) })
    expect(out.send).toHaveLength(3)
    expect(out.defer).toEqual([{ id: 'r03', reason: 'DAILY_CAP_REACHED' }])
  })

  it('TC-NOT-115 sends already made earlier the same local day reduce the budget', () => {
    const sentAt = new Map([['u', [d('2026-10-18T06:00:00Z'), d('2026-10-18T07:00:00Z')]]])
    const out = tick(now, rows(3), { settings: cfg(3), sentAt })
    expect(out.send).toHaveLength(1)
  })

  it.each([[0], [-3], [Number.NaN]])('TC-NOT-116 an invalid cap %s falls back to the default rather than muting the user', (cap) => {
    const out = tick(now, rows(2), { settings: cfg(cap) })
    expect(out.send).toHaveLength(2)
  })

  it('TC-NOT-117 a fractional cap is floored (2.9 allows 2)', () => {
    expect(tick(now, rows(5), { settings: cfg(2.9) }).send).toHaveLength(2)
  })

  it('TC-NOT-118 attempts = MAX-1 is still sent; attempts = MAX fails', () => {
    const base = { user_id: 'u', due_at_utc: d('2026-10-18T10:00:00Z') }
    const out = tick(now, [{ id: 'ok', attempts: MAX_DELIVERY_ATTEMPTS - 1, ...base }, { id: 'dead', attempts: MAX_DELIVERY_ATTEMPTS, ...base }], { settings: cfg(10) })
    expect(out.send).toEqual(['ok'])
    expect(out.fail).toEqual(['dead'])
  })

  it('TC-NOT-119 a reminder due one millisecond in the future is left alone entirely', () => {
    const out = tick(now, [{ id: 'later', user_id: 'u', due_at_utc: d('2026-10-18T12:00:00.001Z'), attempts: 0 }], { settings: cfg(10) })
    expect(out).toEqual({ send: [], fail: [], defer: [] })
  })

  it('TC-NOT-120 the same id never appears in two outcomes', () => {
    const out = tick(now, rows(10), { settings: cfg(4) })
    const all = [...out.send, ...out.fail, ...out.defer.map((x) => x.id)]
    expect(new Set(all).size).toBe(all.length)
    expect(all).toHaveLength(10)
  })

  it('TC-NOT-121 overflow order is deterministic: oldest due first, ties broken by id', () => {
    const same = ['b', 'a', 'c'].map((id) => ({ id, user_id: 'u', due_at_utc: d('2026-10-18T10:00:00Z'), attempts: 0 }))
    expect(tick(now, same, { settings: cfg(2) }).send).toEqual(['a', 'b'])
  })
})
