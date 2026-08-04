import { describe, expect, it } from 'vitest'

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  MAX_DELIVERY_ATTEMPTS,
  planWateringReminders,
  tick,
  type DuePlantRow,
  type PendingReminderRow,
  type TickInputs,
  type UserNotificationSettings,
} from './reminderEngine.ts'

const NOW = new Date('2026-07-25T12:00:00Z')

function plant(overrides: Partial<DuePlantRow> = {}): DuePlantRow {
  return {
    plant_id: '11111111-1111-4111-8111-111111111111',
    user_id: '22222222-2222-4222-8222-222222222222',
    nickname: 'Monstera',
    next_water_due_at: new Date('2026-07-25T18:00:00Z'),
    ...overrides,
  }
}

describe('planWateringReminders', () => {
  it('schedules a reminder for a plant due within the horizon', () => {
    const result = planWateringReminders(NOW, [plant()])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      reminder_type: 'WATER_PLANT',
      target_entity_type: 'PLANT',
      title: 'Water Monstera',
    })
    expect(result[0]!.due_at_utc).toEqual(new Date('2026-07-25T18:00:00Z'))
  })

  it('skips a plant due beyond the horizon', () => {
    const result = planWateringReminders(NOW, [
      plant({ next_water_due_at: new Date('2026-07-27T12:00:01Z') }),
    ])
    expect(result).toHaveLength(0)
  })

  it('clamps an overdue plant to fire now, never in the past', () => {
    const result = planWateringReminders(NOW, [
      plant({ next_water_due_at: new Date('2026-07-20T00:00:00Z') }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0]!.due_at_utc).toEqual(NOW)
    expect(result[0]!.body).toContain('due for watering')
  })

  it('is a pure function of its inputs: same input, same output', () => {
    const input = [plant()]
    expect(planWateringReminders(NOW, input)).toEqual(planWateringReminders(NOW, input))
  })
})

const USER = '22222222-2222-4222-8222-222222222222'
const OTHER_USER = '44444444-4444-4444-8444-444444444444'
const REMINDER = '33333333-3333-4333-8333-333333333333'

function pending(overrides: Partial<PendingReminderRow> = {}): PendingReminderRow {
  return {
    id: REMINDER,
    user_id: USER,
    due_at_utc: new Date('2026-07-25T11:00:00Z'),
    attempts: 0,
    ...overrides,
  }
}

describe('tick', () => {
  it('sends a due pending reminder', () => {
    expect(tick(NOW, [pending()])).toEqual({
      send: [REMINDER],
      fail: [],
      defer: [],
    })
  })

  it('leaves a not-yet-due reminder untouched', () => {
    const result = tick(NOW, [pending({ due_at_utc: new Date('2026-07-25T12:00:01Z') })])
    expect(result).toEqual({ send: [], fail: [], defer: [] })
  })

  it('fails a reminder that exhausted its delivery attempts', () => {
    const result = tick(NOW, [pending({ attempts: MAX_DELIVERY_ATTEMPTS })])
    expect(result).toEqual({ send: [], fail: [REMINDER], defer: [] })
  })

  it('a reminder due exactly now is sent, not deferred', () => {
    const result = tick(NOW, [pending({ due_at_utc: NOW })])
    expect(result.send).toHaveLength(1)
  })

  it('sends normally for a user with no settings row', () => {
    // No row is the common state: the settings row is created lazily. The
    // column defaults (mode WINDOW, no times) must not mute such a user.
    const result = tick(NOW, [pending()], { settings: new Map(), sentAt: new Map() })
    expect(result.send).toEqual([REMINDER])
  })
})

/* --------------------------------------------------- quiet hours, BR-NOT-08 */

/** The 22:00–07:00 default: the cross-midnight case naive comparisons fail. */
function night(overrides: Partial<UserNotificationSettings> = {}): UserNotificationSettings {
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    quiet_hours_mode: 'WINDOW',
    quiet_start_time: '22:00',
    quiet_end_time: '07:00',
    ...overrides,
  }
}

function inputs(
  settings: Record<string, UserNotificationSettings>,
  sentAt: Record<string, Date[]> = {},
): TickInputs {
  return { settings: new Map(Object.entries(settings)), sentAt: new Map(Object.entries(sentAt)) }
}

/** Due since long before any `now` used below, so only the rules decide. */
function overdue(overrides: Partial<PendingReminderRow> = {}): PendingReminderRow {
  return pending({ due_at_utc: new Date('2026-07-01T00:00:00Z'), ...overrides })
}

/** 'send' | 'defer:<reason>' for one row, which is what these cases assert. */
function outcomeAt(at: string, settings: UserNotificationSettings, sentAt: Date[] = []): string {
  const result = tick(new Date(at), [overdue()], inputs({ [USER]: settings }, { [USER]: sentAt }))
  if (result.send.includes(REMINDER)) return 'send'
  const deferred = result.defer.find((d) => d.id === REMINDER)
  return deferred ? `defer:${deferred.reason}` : 'none'
}

describe('tick — quiet hours (BR-NOT-08)', () => {
  it('defers a reminder due inside the window and leaves the row PENDING', () => {
    const result = tick(
      new Date('2026-07-25T23:30:00Z'),
      [overdue()],
      inputs({ [USER]: night() }),
    )
    // Deferral is the absence of a write: not sent, not failed, so the row
    // keeps status PENDING and the next tick re-evaluates it (cl.2).
    expect(result).toEqual({ send: [], fail: [], defer: [{ id: REMINDER, reason: 'QUIET_HOURS' }] })
  })

  it('sends the same reminder once the window has ended', () => {
    expect(outcomeAt('2026-07-26T09:00:00Z', night())).toBe('send')
  })

  it('handles the cross-midnight window on both sides of midnight', () => {
    // s = 22:00, e = 07:00, so membership is `t >= s OR t < e`.
    expect(outcomeAt('2026-07-25T21:59:00Z', night())).toBe('send')
    expect(outcomeAt('2026-07-25T22:00:00Z', night())).toBe('defer:QUIET_HOURS')
    expect(outcomeAt('2026-07-25T23:59:00Z', night())).toBe('defer:QUIET_HOURS')
    expect(outcomeAt('2026-07-26T00:00:00Z', night())).toBe('defer:QUIET_HOURS')
    expect(outcomeAt('2026-07-26T03:00:00Z', night())).toBe('defer:QUIET_HOURS')
    expect(outcomeAt('2026-07-26T06:59:00Z', night())).toBe('defer:QUIET_HOURS')
    // The end boundary is exclusive, E-05.
    expect(outcomeAt('2026-07-26T07:00:00Z', night())).toBe('send')
  })

  it('handles a window that does not cross midnight', () => {
    const siesta = night({ quiet_start_time: '13:00', quiet_end_time: '14:00' })
    expect(outcomeAt('2026-07-25T12:59:00Z', siesta)).toBe('send')
    expect(outcomeAt('2026-07-25T13:00:00Z', siesta)).toBe('defer:QUIET_HOURS')
    expect(outcomeAt('2026-07-25T13:59:00Z', siesta)).toBe('defer:QUIET_HOURS')
    expect(outcomeAt('2026-07-25T14:00:00Z', siesta)).toBe('send')
  })

  it('evaluates the window in the user’s zone, not the server’s', () => {
    // One UTC instant, one window, two users: 18:00Z is 23:30 in Kolkata
    // (inside 22:00–07:00) and 14:00 in New York (outside it).
    const at = new Date('2026-07-25T18:00:00Z')
    const result = tick(
      at,
      [overdue(), overdue({ id: '55555555-5555-4555-8555-555555555555', user_id: OTHER_USER })],
      inputs({
        [USER]: night({ timezone: 'Asia/Kolkata' }),
        [OTHER_USER]: night({ timezone: 'America/New_York' }),
      }),
    )
    expect(result.send).toEqual(['55555555-5555-4555-8555-555555555555'])
    expect(result.defer).toEqual([{ id: REMINDER, reason: 'QUIET_HOURS' }])
  })

  it('mode OFF sends normally even with a window stored', () => {
    expect(outcomeAt('2026-07-25T23:30:00Z', night({ quiet_hours_mode: 'OFF' }))).toBe('send')
  })

  it('mode WINDOW with no times set is not a window', () => {
    const unset = night({ quiet_start_time: null, quiet_end_time: null })
    expect(outcomeAt('2026-07-25T23:30:00Z', unset)).toBe('send')
  })

  it('a start equal to the end is not treated as always quiet', () => {
    const ambiguous = night({ quiet_start_time: '22:00', quiet_end_time: '22:00' })
    expect(outcomeAt('2026-07-25T22:30:00Z', ambiguous)).toBe('send')
  })

  it('SCHEDULED_ONLY defers at every hour (the strictest reading, see engine)', () => {
    const dnd = night({ quiet_hours_mode: 'SCHEDULED_ONLY' })
    expect(outcomeAt('2026-07-25T12:00:00Z', dnd)).toBe('defer:QUIET_HOURS')
    expect(outcomeAt('2026-07-25T23:30:00Z', dnd)).toBe('defer:QUIET_HOURS')
  })

  it('accepts the raw HH:MM:SS a `time` column emits', () => {
    const raw = night({ quiet_start_time: '22:00:00', quiet_end_time: '07:00:00' })
    expect(outcomeAt('2026-07-25T23:30:00Z', raw)).toBe('defer:QUIET_HOURS')
  })

  it('falls back to UTC for an unresolvable zone rather than throwing', () => {
    // BR-NOT-10 cl.6: never guess an offset, never take the pass down.
    expect(outcomeAt('2026-07-25T23:30:00Z', night({ timezone: 'Mars/Olympus' }))).toBe(
      'defer:QUIET_HOURS',
    )
  })

  it('still fails an attempts-exhausted row inside quiet hours', () => {
    // Gate order: exhaustion is terminal bookkeeping and interrupts nobody.
    const result = tick(
      new Date('2026-07-25T23:30:00Z'),
      [overdue({ attempts: MAX_DELIVERY_ATTEMPTS })],
      inputs({ [USER]: night() }),
    )
    expect(result).toEqual({ send: [], fail: [REMINDER], defer: [] })
  })
})

/* ------------------------------------------- daily notification cap, BR-NOT-13 */

const NOON = '2026-07-25T12:00:00Z'

describe('tick — daily notification cap (BR-NOT-13)', () => {
  it('defers the (n+1)th reminder of the local day', () => {
    const capped = night({ quiet_hours_mode: 'OFF', daily_notification_cap: 2 })
    const sent = [new Date('2026-07-25T09:00:00Z'), new Date('2026-07-25T10:00:00Z')]
    expect(outcomeAt(NOON, capped, sent)).toBe('defer:DAILY_CAP_REACHED')
  })

  it('sends while the cap still has room', () => {
    const capped = night({ quiet_hours_mode: 'OFF', daily_notification_cap: 3 })
    const sent = [new Date('2026-07-25T09:00:00Z'), new Date('2026-07-25T10:00:00Z')]
    expect(outcomeAt(NOON, capped, sent)).toBe('send')
  })

  it('resets at the user’s local midnight: the same sends do not count tomorrow', () => {
    const capped = night({ quiet_hours_mode: 'OFF', daily_notification_cap: 2 })
    const sent = [new Date('2026-07-25T09:00:00Z'), new Date('2026-07-25T10:00:00Z')]
    expect(outcomeAt(NOON, capped, sent)).toBe('defer:DAILY_CAP_REACHED')
    expect(outcomeAt('2026-07-26T12:00:00Z', capped, sent)).toBe('send')
  })

  it('counts by the user’s local date, not the UTC date', () => {
    // 2026-07-24T19:00Z is already 00:30 on the 25th in Kolkata but still
    // 15:00 on the 24th in New York. Both users are asked at 06:00Z on the
    // 25th, which is the 25th locally for each of them.
    const sent = [new Date('2026-07-24T19:00:00Z')]
    const capOne = { quiet_hours_mode: 'OFF' as const, daily_notification_cap: 1 }
    const kolkata = night({ ...capOne, timezone: 'Asia/Kolkata' })
    const newYork = night({ ...capOne, timezone: 'America/New_York' })
    expect(outcomeAt('2026-07-25T06:00:00Z', kolkata, sent)).toBe('defer:DAILY_CAP_REACHED')
    expect(outcomeAt('2026-07-25T06:00:00Z', newYork, sent)).toBe('send')
  })

  it('spends the budget within one tick, oldest due first', () => {
    const rows = [
      overdue({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        due_at_utc: new Date('2026-07-25T10:00:00Z'),
      }),
      overdue({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        due_at_utc: new Date('2026-07-25T08:00:00Z'),
      }),
    ]
    const result = tick(
      new Date(NOON),
      rows,
      inputs({ [USER]: night({ quiet_hours_mode: 'OFF', daily_notification_cap: 1 }) }),
    )
    expect(result.send).toEqual(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'])
    expect(result.defer).toEqual([
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'DAILY_CAP_REACHED' },
    ])
  })

  it('is a per-user budget: one user at their cap does not silence another', () => {
    const capOne = night({ quiet_hours_mode: 'OFF', daily_notification_cap: 1 })
    const result = tick(
      new Date(NOON),
      [overdue(), overdue({ id: '55555555-5555-4555-8555-555555555555', user_id: OTHER_USER })],
      inputs(
        { [USER]: capOne, [OTHER_USER]: capOne },
        { [USER]: [new Date('2026-07-25T09:00:00Z')] },
      ),
    )
    expect(result.send).toEqual(['55555555-5555-4555-8555-555555555555'])
    expect(result.defer).toEqual([{ id: REMINDER, reason: 'DAILY_CAP_REACHED' }])
  })

  it('quiet hours win over the cap when both would fire', () => {
    // BR-NOT-05 cl.1 fixes the order, so the recorded reason is deterministic.
    const capped = night({ daily_notification_cap: 1 })
    expect(outcomeAt('2026-07-25T23:30:00Z', capped, [new Date('2026-07-25T09:00:00Z')])).toBe(
      'defer:QUIET_HOURS',
    )
  })

  it('does not mutate the rows it is given', () => {
    const rows = [overdue({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }), overdue()]
    const before = rows.map((r) => r.id)
    const args = inputs({ [USER]: night({ quiet_hours_mode: 'OFF' }) })
    expect(tick(new Date(NOON), rows, args)).toEqual(tick(new Date(NOON), rows, args))
    expect(rows.map((r) => r.id)).toEqual(before)
  })
})
