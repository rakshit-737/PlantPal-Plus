/**
 * Reminder service tests: the wiring between the pure engine and the
 * repository — that the dispatch pass actually READS the two preferences the
 * engine honours (quiet hours, BR-NOT-08; the daily cap, BR-NOT-13) and that a
 * deferred row is written nowhere.
 *
 * No PostgreSQL here, so the repo and the push transport are mocked; the rules
 * themselves are asserted in reminderEngine.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/plantpal_test'
process.env['JWT_ACCESS_SECRET'] ??= 'test-secret-that-is-at-least-32-characters-long'

vi.mock('./remindersRepo.ts', () => ({
  findPlantsNeedingReminder: vi.fn(async () => []),
  insertReminders: vi.fn(async () => 0),
  findDuePending: vi.fn(async () => []),
  findNotificationSettings: vi.fn(async () => new Map()),
  findRecentSentAt: vi.fn(async () => new Map()),
  markSent: vi.fn(async () => undefined),
  markFailed: vi.fn(async () => undefined),
  markDelivered: vi.fn(async () => undefined),
}))

vi.mock('../notifications/devicesRepo.ts', () => ({
  activeTokensForUsers: vi.fn(async () => new Map()),
  revokeTokens: vi.fn(async () => undefined),
}))

vi.mock('../notifications/expoPush.ts', () => ({
  sendPushMessages: vi.fn(async () => ({ delivered: [], notRegistered: [] })),
}))

const repo = await import('./remindersRepo.ts')
const devices = await import('../notifications/devicesRepo.ts')
const { runReminderPass } = await import('./reminderService.ts')
const { DEFAULT_NOTIFICATION_SETTINGS } = await import('./reminderEngine.ts')

const USER = '22222222-2222-4222-8222-222222222222'
const REMINDER = '33333333-3333-4333-8333-333333333333'
const NOW = new Date('2026-07-25T23:30:00Z')

function duePending() {
  return [
    {
      id: REMINDER,
      user_id: USER,
      title: 'Water Monstera',
      body: 'Monstera is due for watering.',
      due_at_utc: new Date('2026-07-25T22:30:00Z'),
      attempts: 0,
    },
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(repo.findPlantsNeedingReminder).mockResolvedValue([])
  vi.mocked(repo.insertReminders).mockResolvedValue(0)
  vi.mocked(repo.findDuePending).mockResolvedValue(duePending())
  vi.mocked(repo.findNotificationSettings).mockResolvedValue(new Map())
  vi.mocked(repo.findRecentSentAt).mockResolvedValue(new Map())
  vi.mocked(devices.activeTokensForUsers).mockResolvedValue(new Map())
})

describe('runReminderPass', () => {
  it('reads both preferences for exactly the users being dispatched', async () => {
    await runReminderPass(NOW)
    expect(repo.findNotificationSettings).toHaveBeenCalledWith([USER])
    expect(repo.findRecentSentAt).toHaveBeenCalledWith([USER], NOW)
  })

  it('sends when no preference blocks the reminder', async () => {
    const result = await runReminderPass(NOW)
    expect(repo.markSent).toHaveBeenCalledWith([REMINDER])
    expect(result).toMatchObject({ sent: 1, deferred: 0 })
  })

  it('defers inside quiet hours without writing the row or attempting push', async () => {
    vi.mocked(repo.findNotificationSettings).mockResolvedValue(
      new Map([
        [
          USER,
          {
            ...DEFAULT_NOTIFICATION_SETTINGS,
            quiet_hours_mode: 'WINDOW' as const,
            quiet_start_time: '22:00',
            quiet_end_time: '07:00',
          },
        ],
      ]),
    )

    const result = await runReminderPass(NOW)

    expect(result).toMatchObject({ sent: 0, failed: 0, deferred: 1 })
    // Deferral is the absence of a write: PENDING, same due instant, same
    // attempt count, re-evaluated next tick (BR-NOT-08 cl.2).
    expect(repo.markSent).toHaveBeenCalledWith([])
    expect(repo.markFailed).toHaveBeenCalledWith([])
    expect(devices.activeTokensForUsers).not.toHaveBeenCalled()
  })

  it('defers once the user has spent their daily cap', async () => {
    vi.mocked(repo.findNotificationSettings).mockResolvedValue(
      new Map([
        [USER, { ...DEFAULT_NOTIFICATION_SETTINGS, quiet_hours_mode: 'OFF' as const, daily_notification_cap: 1 }],
      ]),
    )
    vi.mocked(repo.findRecentSentAt).mockResolvedValue(
      new Map([[USER, [new Date('2026-07-25T09:00:00Z')]]]),
    )

    const result = await runReminderPass(NOW)

    expect(result).toMatchObject({ sent: 0, deferred: 1 })
    expect(repo.markSent).toHaveBeenCalledWith([])
  })

  it('asks for no user when nothing is due (both repo calls short-circuit)', async () => {
    vi.mocked(repo.findDuePending).mockResolvedValue([])
    await runReminderPass(NOW)
    expect(repo.findNotificationSettings).toHaveBeenCalledWith([])
    expect(repo.findRecentSentAt).toHaveBeenCalledWith([], NOW)
  })
})
