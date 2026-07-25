/**
 * Reminder engine — the pure heart of the node-cron tick (RSK-01).
 *
 * References: modules/notifications.md, migrations/005-engagement-schema.sql.
 *
 * Everything here is a pure function of (now, rows): no clock reads, no
 * database, no scheduler. The cron wiring in reminderService.ts feeds it and
 * applies its decisions, which is what makes the tick testable without a
 * scheduler — the design promise recorded in 005-engagement-schema.sql.
 */

export interface DuePlantRow {
  plant_id: string
  user_id: string
  nickname: string
  next_water_due_at: Date
}

export interface ReminderInsert {
  user_id: string
  reminder_type: 'WATER_PLANT'
  target_entity_id: string
  target_entity_type: 'PLANT'
  title: string
  body: string
  due_at_utc: Date
}

/**
 * Decide which watering reminders to create for plants that are due within
 * the horizon. One live PENDING reminder per plant is the invariant — the
 * partial unique index idx_reminders_unique_pending enforces it in the
 * database; this function keeps the tick from even attempting duplicates by
 * being fed only plants with no live reminder.
 */
export function planWateringReminders(
  now: Date,
  duePlants: DuePlantRow[],
  horizonHours = 24,
): ReminderInsert[] {
  const horizonMs = horizonHours * 3_600_000
  return duePlants
    .filter((p) => p.next_water_due_at.getTime() - now.getTime() <= horizonMs)
    .map((p) => ({
      user_id: p.user_id,
      reminder_type: 'WATER_PLANT' as const,
      target_entity_id: p.plant_id,
      target_entity_type: 'PLANT' as const,
      title: `Water ${p.nickname}`,
      body:
        p.next_water_due_at.getTime() <= now.getTime()
          ? `${p.nickname} is due for watering.`
          : `${p.nickname} needs water soon.`,
      // Never schedule in the past: an already-overdue plant fires immediately.
      due_at_utc: p.next_water_due_at.getTime() < now.getTime() ? now : p.next_water_due_at,
    }))
}

export interface PendingReminderRow {
  id: string
  due_at_utc: Date
  attempts: number
}

export interface TickDecision {
  /** Rows to mark SENT (delivery for v1.0 is in-app: the client fetches them). */
  send: string[]
  /** Rows to mark FAILED (exhausted their attempts). */
  fail: string[]
}

export const MAX_DELIVERY_ATTEMPTS = 5

/**
 * One dispatcher tick: partition the due PENDING rows into deliveries and
 * terminal failures. Pure — the caller supplies the rows and applies the
 * decision transactionally.
 */
export function tick(now: Date, pending: PendingReminderRow[]): TickDecision {
  const decision: TickDecision = { send: [], fail: [] }
  for (const row of pending) {
    if (row.due_at_utc.getTime() > now.getTime()) continue
    if (row.attempts >= MAX_DELIVERY_ATTEMPTS) decision.fail.push(row.id)
    else decision.send.push(row.id)
  }
  return decision
}
