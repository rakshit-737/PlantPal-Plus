/**
 * Reminder engine — the pure heart of the node-cron tick (RSK-01).
 *
 * References: modules/notifications.md, migrations/005-engagement-schema.sql.
 *
 * Everything here is a pure function of (now, due rows, settings): no clock
 * reads, no database, no scheduler. The cron wiring in reminderService.ts
 * feeds it and applies its decisions, which is what makes the tick testable
 * without a scheduler — the design promise recorded in 005-engagement-schema.sql.
 *
 * The dispatcher honours two user preferences, both read here and never
 * fetched here: quiet hours (BR-NOT-08) and the daily notification cap
 * (BR-NOT-13). remindersRepo supplies the settings row and the day's sends;
 * this file decides. NOTE: the comment in 005-engagement-schema.sql saying the
 * dispatcher consults neither is now out of date — it predates this rule and
 * the migration is immutable once applied.
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
  /** Owner: quiet hours and the daily cap are both per-user rules. */
  user_id: string
  due_at_utc: Date
  attempts: number
}

/** Why a due row was held back. Both names are the reasons of BR-NOT-05 cl.1. */
export type DeferReason = 'QUIET_HOURS' | 'DAILY_CAP_REACHED'

export interface DeferredReminder {
  id: string
  reason: DeferReason
}

export interface TickDecision {
  /** Rows to mark SENT (delivery for v1.0 is in-app: the client fetches them). */
  send: string[]
  /** Rows to mark FAILED (exhausted their attempts). */
  fail: string[]
  /**
   * Rows held back this tick. BR-NOT-08 cl.2: a reminder inside quiet hours is
   * DEFERRED, never dropped. Deferral here is the absence of a write — the row
   * keeps status PENDING, keeps its due_at_utc and its attempt count, and is
   * re-evaluated by the next tick, which is exactly the "re-evaluate from
   * durable state" property the service header depends on. The caller applies
   * nothing for these; the list exists so a pass can be observed (and
   * asserted) rather than looking idle.
   *
   * Two parts of BR-NOT-08 are deliberately NOT implemented here, both because
   * the v1.0 reminders table has no column to carry them:
   *  - cl.2's rewrite of due_at to the window end plus a per-user jitter. The
   *    5-minute tick already re-evaluates from durable state, so a rewrite
   *    would buy nothing but a second source of truth about when a reminder was
   *    meant to fire. The burst the jitter exists to flatten is instead flattened
   *    by the daily cap, which is what limits an overnight backlog released at
   *    07:00 to `daily_notification_cap` deliveries.
   *  - cl.4's escalation from deferral to suppression when the deferred instant
   *    would breach the category staleness cut-off. That needs `original_due_at`
   *    and a per-category cut-off; neither exists on this table, and there is no
   *    honest way to measure the breach without them. Nothing is suppressed.
   */
  defer: DeferredReminder[]
}

export const MAX_DELIVERY_ATTEMPTS = 5

/* ------------------------------------------------------ quiet hours + cap */

/** The `quiet_hours_mode` domain of user_settings (001-auth-schema.sql). */
export type QuietHoursMode = 'OFF' | 'WINDOW' | 'SCHEDULED_ONLY'

/**
 * The slice of ENT-03 UserSettings the dispatcher needs. Times are the user's
 * own wall clock as 'HH:MM' (the shape settingsRepo normalises to; 'HH:MM:SS'
 * straight off the `time` column is accepted too), and never carry a zone —
 * `timezone` is the IANA name they are read against, per BR-NOT-10 cl.1.
 */
export interface UserNotificationSettings {
  timezone: string
  quiet_hours_mode: QuietHoursMode
  quiet_start_time: string | null
  quiet_end_time: string | null
  daily_notification_cap: number
}

/**
 * The column defaults of user_settings, used for a user with no settings row.
 * That is a normal state, not an error: the settings row is created lazily on
 * first read (settingsRepo.getSettings), so a user who has never opened
 * settings has no row and must dispatch exactly as the defaults describe.
 * Default mode WINDOW with both times null is deliberately NOT quiet — see
 * isWithinQuietHours.
 */
export const DEFAULT_NOTIFICATION_SETTINGS: UserNotificationSettings = {
  timezone: 'UTC',
  quiet_hours_mode: 'WINDOW',
  quiet_start_time: null,
  quiet_end_time: null,
  daily_notification_cap: 12,
}

export interface TickInputs {
  /** user_id → settings. A user absent from the map gets the column defaults. */
  settings?: ReadonlyMap<string, UserNotificationSettings> | undefined
  /**
   * user_id → instants at which that user's reminders were already sent,
   * covering at least their current local day. The engine buckets them by the
   * user's local date itself (BR-NOT-13 cl.2) rather than being handed a
   * pre-computed count, so the local-midnight reset is a property of this pure
   * function and is testable without a database or a clock.
   */
  sentAt?: ReadonlyMap<string, readonly Date[]> | undefined
}

const LOCAL_PARTS: Intl.DateTimeFormatOptions = {
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}

/**
 * Memoised because constructing an Intl.DateTimeFormat is the expensive part
 * and a pass evaluates up to 200 rows over a handful of zones. Caching the
 * result of a deterministic constructor keyed by its only argument observes
 * nothing and changes no answer, so the functions below stay pure.
 */
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone)
  if (cached) return cached
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('en-US', { ...LOCAL_PARTS, timeZone })
  } catch {
    // BR-NOT-10 cl.6: an unresolvable zone falls back to UTC. An offset is
    // never guessed, and the pass is never skipped — the alternative (throwing)
    // would let one bad row stop every other user's reminders.
    formatter = new Intl.DateTimeFormat('en-US', { ...LOCAL_PARTS, timeZone: 'UTC' })
  }
  formatters.set(timeZone, formatter)
  return formatter
}

interface LocalClock {
  /** 'YYYY-MM-DD' in the user's zone — the key the daily cap counts by. */
  dateKey: string
  /** Minutes since local midnight — the `t` of the BR-NOT-08 cl.1 predicate. */
  minutes: number
}

/**
 * The user's wall clock at `instant`. Intl carries the full IANA rules, so
 * daylight saving and half-hour zones need no arithmetic here and no
 * dependency — BR-NOT-10 cl.1 forbids offset arithmetic precisely because it
 * cannot express a DST rule.
 */
function localClock(instant: Date, timeZone: string): LocalClock {
  const parts = formatterFor(timeZone).formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '00'
  // 'h23' should never emit 24, but some ICU builds render midnight as 24:00;
  // without the modulo that reads as 1440 minutes and lands outside every window.
  const hour = Number(part('hour')) % 24
  return {
    dateKey: `${part('year')}-${part('month')}-${part('day')}`,
    minutes: hour * 60 + Number(part('minute')),
  }
}

const MINUTES_PER_DAY = 24 * 60

/** 'HH:MM' or 'HH:MM:SS' → minutes since local midnight; null if unusable. */
function wallClockMinutes(value: string | null): number | null {
  if (value === null) return null
  const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value.trim())
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes >= 0 && minutes < MINUTES_PER_DAY ? minutes : null
}

/**
 * BR-NOT-08 cl.1 — is `now` inside the user's quiet window, in THEIR zone?
 *
 * Non-crossing (s < e): `t >= s AND t < e`.
 * Cross-midnight (e < s): `t >= s OR t < e` — 22:00–07:00 is the common case
 * and the one a naive `s <= t && t < e` gets wrong for every hour of it.
 * Start inclusive, end exclusive: 07:00 against a window ending 07:00 delivers
 * (E-05).
 *
 * Two shapes are deliberately NOT quiet:
 *  - mode WINDOW with a null start or end. Rows are created with mode WINDOW
 *    and no times (see settingsController), so treating that as "quiet" would
 *    mute every user who has never opened the settings screen.
 *  - s === e. Ambiguous between "never quiet" and "always quiet"; the write
 *    path rejects it (window_start_equals_end, E-33), so a stored pair can only
 *    predate that check, and the reading that keeps a legacy row deliverable is
 *    the one that does not silently mute an account forever.
 *
 * SCHEDULED_ONLY is treated as ALWAYS QUIET. BR-NOT-08 cl.1 enumerates OFF,
 * WINDOW and ALWAYS; the shipped column enumerates OFF, WINDOW and
 * SCHEDULED_ONLY, and no rule text anywhere defines the third value — so the
 * requirement is genuinely ambiguous here. Per the "send less" tie-break this
 * takes the strictest reading available: the do-not-disturb row of the table
 * (gate 8 of BR-NOT-05), i.e. every reminder defers while the mode is set.
 * Nothing is lost by it — deferral keeps the row PENDING, and listForUser
 * surfaces PENDING rows, so the in-app record survives exactly as BR-NOT-08
 * cl.5 requires; only the push interruption is withheld.
 */
export function isWithinQuietHours(now: Date, settings: UserNotificationSettings): boolean {
  if (settings.quiet_hours_mode === 'OFF') return false
  if (settings.quiet_hours_mode === 'SCHEDULED_ONLY') return true

  const start = wallClockMinutes(settings.quiet_start_time)
  const end = wallClockMinutes(settings.quiet_end_time)
  if (start === null || end === null || start === end) return false

  const t = localClock(now, settings.timezone).minutes
  return start < end ? t >= start && t < end : t >= start || t < end
}

/**
 * BR-NOT-13 cl.2 — how many reminders this user has already been sent on the
 * local date containing `now`. The counter key is (user_id, local date), never
 * the UTC date, so the cap resets at the user's midnight and means what they
 * think it means.
 */
function sentOnLocalDay(sentAt: readonly Date[], now: Date, timeZone: string): number {
  const today = localClock(now, timeZone).dateKey
  let count = 0
  for (const instant of sentAt) {
    if (localClock(instant, timeZone).dateKey === today) count += 1
  }
  return count
}

/** A cap outside the column's 1..20 domain is unusable; fail to the default. */
function capOf(settings: UserNotificationSettings): number {
  const cap = settings.daily_notification_cap
  // A NaN or absent cap must not read as "cap 0" and mute the account for good:
  // BR-NOT-13 cl.5 biases toward sending fewer, not toward sending never.
  if (!Number.isFinite(cap) || cap < 1) return DEFAULT_NOTIFICATION_SETTINGS.daily_notification_cap
  return Math.floor(cap)
}

/**
 * One dispatcher tick: partition the due PENDING rows into deliveries,
 * terminal failures and deferrals. Pure — the caller supplies the rows, the
 * settings and the day's sends, and applies the decision transactionally.
 *
 * Gate order follows BR-NOT-05 cl.1: attempts exhausted, then quiet hours
 * (gate 9), then the daily cap (gate 10). Order is normative because it fixes
 * which reason is recorded when two gates would both fire.
 *
 * An attempts-exhausted row is failed even inside quiet hours: failing sends
 * nothing, so it cannot interrupt anyone, and holding it back would leave dead
 * rows re-examined by every tick forever.
 */
export function tick(
  now: Date,
  pending: PendingReminderRow[],
  inputs: TickInputs = {},
): TickDecision {
  const decision: TickDecision = { send: [], fail: [], defer: [] }
  // Cap overflow must be deterministic to be reproducible in a test
  // (BR-NOT-13 cl.4). No priority_weight column exists in v1.0, so the rule is
  // the remaining tie-break: oldest due first, then id. Sorted on a copy —
  // this function does not touch its inputs.
  const due = pending
    .filter((row) => row.due_at_utc.getTime() <= now.getTime())
    .sort((a, b) => {
      const byDue = a.due_at_utc.getTime() - b.due_at_utc.getTime()
      if (byDue !== 0) return byDue
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })

  /** Remaining sends per user this local day, computed once per user. */
  const budgets = new Map<string, number>()

  for (const row of due) {
    if (row.attempts >= MAX_DELIVERY_ATTEMPTS) {
      decision.fail.push(row.id)
      continue
    }

    const settings = inputs.settings?.get(row.user_id) ?? DEFAULT_NOTIFICATION_SETTINGS

    if (isWithinQuietHours(now, settings)) {
      decision.defer.push({ id: row.id, reason: 'QUIET_HOURS' })
      continue
    }

    let budget = budgets.get(row.user_id)
    if (budget === undefined) {
      const sentAt = inputs.sentAt?.get(row.user_id) ?? []
      budget = Math.max(0, capOf(settings) - sentOnLocalDay(sentAt, now, settings.timezone))
    }
    if (budget === 0) {
      // The row keeps its place in the queue: the next local day restores the
      // budget and the same tick logic sends it then (BR-NOT-13 cl.2).
      budgets.set(row.user_id, 0)
      decision.defer.push({ id: row.id, reason: 'DAILY_CAP_REACHED' })
      continue
    }

    // Sends decided earlier in THIS pass spend the budget too, otherwise a
    // backlog draining in one tick would blow straight through the cap.
    budgets.set(row.user_id, budget - 1)
    decision.send.push(row.id)
  }

  return decision
}
