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
import { planWateringReminders, tick } from './reminderEngine.js'
import {
  findDuePending,
  findPlantsNeedingReminder,
  insertReminders,
  markFailed,
  markSent,
} from './remindersRepo.js'

export const REMINDER_HORIZON_HOURS = 24

/** One full pass: schedule new watering reminders, then dispatch what is due. */
export async function runReminderPass(now = new Date()): Promise<{
  scheduled: number
  sent: number
  failed: number
}> {
  const duePlants = await findPlantsNeedingReminder(REMINDER_HORIZON_HOURS)
  const inserts = planWateringReminders(now, duePlants, REMINDER_HORIZON_HOURS)
  const scheduled = await insertReminders(inserts)

  const pending = await findDuePending()
  const decision = tick(now, pending)
  await markSent(decision.send)
  await markFailed(decision.fail)

  return { scheduled, sent: decision.send.length, failed: decision.fail.length }
}

let task: ReturnType<typeof cron.schedule> | null = null

/** Every 5 minutes — frequent enough for daily-cadence habits, cheap enough for a free tier. */
export const REMINDER_CRON = '*/5 * * * *'

export function startReminderEngine(): void {
  if (task) return
  task = cron.schedule(REMINDER_CRON, () => {
    void runReminderPass()
      .then((r) => {
        if (r.scheduled || r.sent || r.failed) {
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
