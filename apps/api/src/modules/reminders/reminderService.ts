/**
 * Reminder service — wires the pure engine to the database and node-cron.
 *
 * RSK-01: on a free-tier host the process sleeps and cron ticks are silently
 * lost. Mitigations, both deliberate: (1) /healthz is the keep-alive target
 * that an external pinger hits to stop the instance sleeping; (2) every tick
 * re-evaluates from durable state — a missed tick delays a reminder by one
 * interval, it never loses it.
 */

import cron from 'node-cron'

import { logger } from '../../logging.js'
import { activeTokensForUsers, revokeTokens } from '../notifications/devicesRepo.js'
import { sendPushMessages, type PushMessage } from '../notifications/expoPush.js'
import { planWateringReminders, tick } from './reminderEngine.js'
import {
  findDuePending,
  findPlantsNeedingReminder,
  insertReminders,
  markDelivered,
  markFailed,
  markSent,
  type DispatchableReminder,
} from './remindersRepo.js'

export const REMINDER_HORIZON_HOURS = 24

/**
 * Attempt Expo Push for the reminders just marked SENT. A reminder whose user
 * has a token with an ok ticket advances to DELIVERED; tokens Expo reports as
 * DeviceNotRegistered are revoked (FR-NOT-15). Users with no granted token
 * simply keep the in-app SENT row — push is an upgrade, never a requirement.
 */
async function deliverByPush(sentRows: DispatchableReminder[]): Promise<number> {
  if (sentRows.length === 0) return 0
  const tokensByUser = await activeTokensForUsers([...new Set(sentRows.map((r) => r.user_id))])
  if (tokensByUser.size === 0) return 0

  const messages: PushMessage[] = []
  const reminderIdsByToken = new Map<string, string[]>()
  for (const row of sentRows) {
    for (const token of tokensByUser.get(row.user_id) ?? []) {
      messages.push({
        to: token,
        title: row.title,
        body: row.body ?? '',
        data: { reminder_id: row.id },
      })
      const list = reminderIdsByToken.get(token)
      if (list) list.push(row.id)
      else reminderIdsByToken.set(token, [row.id])
    }
  }
  if (messages.length === 0) return 0

  const result = await sendPushMessages(messages)
  await revokeTokens(result.notRegistered, 'DEVICE_NOT_REGISTERED')

  const deliveredIds = new Set<string>()
  for (const token of result.delivered) {
    for (const id of reminderIdsByToken.get(token) ?? []) deliveredIds.add(id)
  }
  await markDelivered([...deliveredIds])
  return deliveredIds.size
}

/** One full pass: schedule new watering reminders, then dispatch what is due. */
export async function runReminderPass(now = new Date()): Promise<{
  scheduled: number
  sent: number
  delivered: number
  failed: number
}> {
  const duePlants = await findPlantsNeedingReminder(REMINDER_HORIZON_HOURS)
  const inserts = planWateringReminders(now, duePlants, REMINDER_HORIZON_HOURS)
  const scheduled = await insertReminders(inserts)

  const pending = await findDuePending()
  const decision = tick(now, pending)
  await markSent(decision.send)
  await markFailed(decision.fail)

  const sentSet = new Set(decision.send)
  const delivered = await deliverByPush(pending.filter((r) => sentSet.has(r.id)))

  return { scheduled, sent: decision.send.length, delivered, failed: decision.fail.length }
}

let task: ReturnType<typeof cron.schedule> | null = null

/** Every 5 minutes — frequent enough for daily-cadence habits, cheap enough for a free tier. */
export const REMINDER_CRON = '*/5 * * * *'

export function startReminderEngine(): void {
  if (task) return
  task = cron.schedule(REMINDER_CRON, () => {
    void runReminderPass()
      .then((r) => {
        if (r.scheduled || r.sent || r.delivered || r.failed) {
          logger.info(r, 'reminder pass complete')
        }
      })
      .catch((err) => {
        // A failed pass must never take the process down; the next tick retries.
        logger.error({ err }, 'reminder pass failed')
      })
  })
  logger.info({ cron: REMINDER_CRON }, 'reminder engine started')
}

export function stopReminderEngine(): void {
  if (task) {
    void task.stop()
    task = null
  }
}
