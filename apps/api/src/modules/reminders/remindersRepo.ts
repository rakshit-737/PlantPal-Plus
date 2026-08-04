/**
 * Reminders repository — ENT-20 (ScheduledReminder).
 *
 * References: migrations/005-engagement-schema.sql, modules/notifications.md.
 */

import { getPool } from '../../db/pool.ts'
import type {
  DuePlantRow,
  PendingReminderRow,
  QuietHoursMode,
  ReminderInsert,
  UserNotificationSettings,
} from './reminderEngine.ts'

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
           and (
             r.status = 'PENDING'
             -- A reminder already fired for the CURRENT due date must not be
             -- re-created every tick: suppress while a sent/delivered row is
             -- newer than the last watering (i.e. the nag is still standing).
             or (r.status in ('SENT', 'DELIVERED')
                 and r.created_at > coalesce(p.last_watered_at, '-infinity'::timestamptz))
           )
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
       on conflict (user_id, reminder_type, target_entity_id)
         where status = 'PENDING' and target_entity_id is not null
       do nothing`,
      [r.user_id, r.reminder_type, r.target_entity_id, r.target_entity_type, r.title, r.body, r.due_at_utc],
    )
    created += result.rowCount ?? 0
  }
  return created
}

export interface DispatchableReminder extends PendingReminderRow {
  title: string
  body: string | null
}

/* --------------------------------- dispatch preferences (BR-NOT-08 / -13) */

interface SettingsRow {
  user_id: string
  timezone: string
  quiet_hours_mode: string
  quiet_start_time: string | null
  quiet_end_time: string | null
  daily_notification_cap: number
}

const QUIET_HOURS_MODES: readonly string[] = ['OFF', 'WINDOW', 'SCHEDULED_ONLY']

/**
 * node-postgres registers no parser for OID 1083 (`time`), so these arrive as
 * the raw 'HH:MM:SS' PostgreSQL emits — the same reason settingsRepo trims
 * them on the way out. The engine accepts either shape; trimming here keeps
 * the two modules' idea of a stored wall time identical.
 */
function toWallClock(value: string | null): string | null {
  if (value === null) return null
  return /^(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value)?.[1] ?? value
}

/**
 * The dispatch preferences for the users in one pass (BR-NOT-08, BR-NOT-13).
 *
 * A user with no row is simply absent from the map: settings rows are created
 * lazily on first read, so "no row" means "column defaults", which the engine
 * already holds. Inventing a row here would be a write on the read path.
 */
export async function findNotificationSettings(
  userIds: string[],
): Promise<Map<string, UserNotificationSettings>> {
  const settings = new Map<string, UserNotificationSettings>()
  if (userIds.length === 0) return settings
  const pool = getPool()
  const { rows } = await pool.query<SettingsRow>(
    `select user_id, timezone, quiet_hours_mode, quiet_start_time, quiet_end_time,
            daily_notification_cap
     from user_settings
     where user_id = any ($1::uuid[])`,
    [userIds],
  )
  for (const row of rows) {
    settings.set(row.user_id, {
      timezone: row.timezone,
      // The check constraint guarantees the domain; the guard keeps an
      // unexpected value from reading as "always quiet" and muting an account.
      quiet_hours_mode: (QUIET_HOURS_MODES.includes(row.quiet_hours_mode)
        ? row.quiet_hours_mode
        : 'OFF') as QuietHoursMode,
      quiet_start_time: toWallClock(row.quiet_start_time),
      quiet_end_time: toWallClock(row.quiet_end_time),
      daily_notification_cap: row.daily_notification_cap,
    })
  }
  return settings
}

/**
 * Instants at which these users were already sent a reminder, recent enough to
 * cover every one of their current local days.
 *
 * BR-NOT-13 cl.2 counts per (user_id, LOCAL date), and no counter column
 * exists — deliberately: the reminders table already records every send, and a
 * counter column would be a second source of truth to keep consistent. sent_at
 * is the record, so it is what the cap is derived from.
 *
 * The lookback is a window, not the user's local day, because the local day
 * boundary depends on a zone this query would otherwise have to join and
 * convert against; the engine buckets the instants by local date instead, which
 * keeps all timezone reasoning in one pure, testable place. 48 hours covers any
 * zone's current local day with room to spare (offsets run -12..+14, a local day
 * is at most 25 hours and started at most 25 hours ago).
 *
 * Cost: one extra round trip per pass. idx_reminders_user (user_id, status,
 * due_at_utc) serves the user_id + status prefix and sent_at filters the
 * remainder. The result is self-limiting — once this cap is enforced a user
 * cannot have more than `daily_notification_cap` (max 20) sends per local day,
 * so the window returns at most ~40 rows per user, and findDuePending caps a
 * pass at 200 distinct users.
 */
export async function findRecentSentAt(
  userIds: string[],
  now: Date,
  lookbackHours = 48,
): Promise<Map<string, Date[]>> {
  const byUser = new Map<string, Date[]>()
  if (userIds.length === 0) return byUser
  const pool = getPool()
  const { rows } = await pool.query<{ user_id: string; sent_at: Date }>(
    `select user_id, sent_at
     from reminders
     where user_id = any ($1::uuid[])
       and status in ('SENT', 'DELIVERED')
       and sent_at is not null
       -- Bounded by the caller's now(), not the database's, so the count the
       -- engine sees is the count for the instant it is deciding about.
       and sent_at > $2::timestamptz - ($3 || ' hours')::interval
       and sent_at <= $2::timestamptz`,
    [userIds, now, lookbackHours],
  )
  for (const row of rows) {
    const list = byUser.get(row.user_id)
    if (list) list.push(row.sent_at)
    else byUser.set(row.user_id, [row.sent_at])
  }
  return byUser
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
     where id = any ($1::uuid[]) and status = 'PENDING'`,
    [ids],
  )
}

export async function markFailed(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const pool = getPool()
  await pool.query(
    `update reminders
     set status = 'FAILED', last_error = 'delivery attempts exhausted', updated_at = now()
     where id = any ($1::uuid[]) and status = 'PENDING'`,
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

/**
 * Cancel live reminders for one target entity — called when the task they
 * nag about is resolved (a watering logged) or the subject disappears (plant
 * soft-deleted). FR-NOT-22: a reminder for a done or deleted task must not
 * fire, and a fired one must not linger in the client list.
 */
export async function cancelForTarget(userId: string, targetEntityId: string): Promise<number> {
  const pool = getPool()
  const result = await pool.query(
    `update reminders
     set status = 'CANCELLED', updated_at = now()
     where user_id = $1 and target_entity_id = $2 and status in ('PENDING', 'SENT')`,
    [userId, targetEntityId],
  )
  return result.rowCount ?? 0
}
