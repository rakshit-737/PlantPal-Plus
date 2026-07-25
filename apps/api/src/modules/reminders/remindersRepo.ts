/**
 * Reminders repository — ENT-20 (ScheduledReminder).
 *
 * References: migrations/005-engagement-schema.sql, modules/notifications.md.
 */

import { getPool } from '../../db/pool.js'
import type { DuePlantRow, PendingReminderRow, ReminderInsert } from './reminderEngine.js'

/**
 * Plants due for water within the horizon that have no live PENDING reminder.
 * The NOT EXISTS mirrors idx_reminders_unique_pending, so the subsequent
 * insert can only race against another tick — and the partial unique index
 * settles that race; ON CONFLICT DO NOTHING makes the loser a no-op.
 */
export async function findPlantsNeedingReminder(horizonHours: number): Promise<DuePlantRow[]> {
  const pool = getPool()
  const { rows } = await pool.query<DuePlantRow>(
    `select p.id as plant_id, p.user_id, p.nickname, p.next_water_due_at
     from plants p
     where p.deleted_at is null
       and p.next_water_due_at is not null
       and p.next_water_due_at <= now() + ($1 || ' hours')::interval
       and not exists (
         select 1 from reminders r
         where r.user_id = p.user_id
           and r.reminder_type = 'WATER_PLANT'
           and r.target_entity_id = p.id
           and r.status = 'PENDING'
       )`,
    [horizonHours],
  )
  return rows
}

export async function insertReminders(inserts: ReminderInsert[]): Promise<number> {
  if (inserts.length === 0) return 0
  const pool = getPool()
  let created = 0
  for (const r of inserts) {
    const result = await pool.query(
      `insert into reminders
         (user_id, reminder_type, target_entity_id, target_entity_type, title, body, due_at_utc)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, reminder_type, target_entity_id) where status = 'PENDING'
       do nothing`,
      [r.user_id, r.reminder_type, r.target_entity_id, r.target_entity_type, r.title, r.body, r.due_at_utc],
    )
    created += result.rowCount ?? 0
  }
  return created
}

export interface DispatchableReminder extends PendingReminderRow {
  user_id: string
  title: string
  body: string | null
}

/** The dispatcher's hot query (idx_reminders_due): pending rows now due. */
export async function findDuePending(limit = 200): Promise<DispatchableReminder[]> {
  const pool = getPool()
  const { rows } = await pool.query<DispatchableReminder>(
    `select id, user_id, title, body, due_at_utc, attempts
     from reminders
     where status = 'PENDING' and due_at_utc <= now()
     order by due_at_utc asc
     limit $1`,
    [limit],
  )
  return rows
}

/** Push ticket came back ok: SENT → DELIVERED (FR-NOT-03). */
export async function markDelivered(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const pool = getPool()
  await pool.query(
    `update reminders
     set status = 'DELIVERED', updated_at = now()
     where id = any ($1::uuid[]) and status = 'SENT'`,
    [ids],
  )
}

export async function markSent(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const pool = getPool()
  await pool.query(
    `update reminders
     set status = 'SENT', sent_at = now(), attempts = attempts + 1, updated_at = now()
     where id = any ($1::uuid[])`,
    [ids],
  )
}

export async function markFailed(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const pool = getPool()
  await pool.query(
    `update reminders
     set status = 'FAILED', last_error = 'delivery attempts exhausted', updated_at = now()
     where id = any ($1::uuid[])`,
    [ids],
  )
}

export interface ReminderView {
  id: string
  reminder_type: string
  target_entity_id: string | null
  title: string
  body: string | null
  due_at_utc: string
  status: string
  sent_at: string | null
}

/** A user's visible reminders: everything live plus the recently delivered. */
export async function listForUser(userId: string, limit = 50): Promise<ReminderView[]> {
  const pool = getPool()
  const { rows } = await pool.query<ReminderView>(
    `select id, reminder_type, target_entity_id, title, body, due_at_utc, status, sent_at
     from reminders
     where user_id = $1
       and (status in ('PENDING', 'SENT')
            or (status = 'DELIVERED' and sent_at > now() - interval '7 days'))
     order by due_at_utc desc
     limit $2`,
    [userId, limit],
  )
  return rows
}

/** Dismiss = CANCELLED; scoped to the owner so ids cannot be probed across users. */
export async function dismiss(userId: string, reminderId: string): Promise<boolean> {
  const pool = getPool()
  const result = await pool.query(
    `update reminders
     set status = 'CANCELLED', updated_at = now()
     where id = $1 and user_id = $2 and status in ('PENDING', 'SENT')`,
    [reminderId, userId],
  )
  return (result.rowCount ?? 0) > 0
}
