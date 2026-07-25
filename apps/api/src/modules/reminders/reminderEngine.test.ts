import { describe, expect, it } from 'vitest'

import {
  MAX_DELIVERY_ATTEMPTS,
  planWateringReminders,
  tick,
  type DuePlantRow,
  type PendingReminderRow,
} from './reminderEngine.js'

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

function pending(overrides: Partial<PendingReminderRow> = {}): PendingReminderRow {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    due_at_utc: new Date('2026-07-25T11:00:00Z'),
    attempts: 0,
    ...overrides,
  }
}

describe('tick', () => {
  it('sends a due pending reminder', () => {
    expect(tick(NOW, [pending()])).toEqual({
      send: ['33333333-3333-4333-8333-333333333333'],
      fail: [],
    })
  })

  it('leaves a not-yet-due reminder untouched', () => {
    const result = tick(NOW, [pending({ due_at_utc: new Date('2026-07-25T12:00:01Z') })])
    expect(result).toEqual({ send: [], fail: [] })
  })

  it('fails a reminder that exhausted its delivery attempts', () => {
    const result = tick(NOW, [pending({ attempts: MAX_DELIVERY_ATTEMPTS })])
    expect(result).toEqual({ send: [], fail: ['33333333-3333-4333-8333-333333333333'] })
  })

  it('a reminder due exactly now is sent, not deferred', () => {
    const result = tick(NOW, [pending({ due_at_utc: NOW })])
    expect(result.send).toHaveLength(1)
  })
})
