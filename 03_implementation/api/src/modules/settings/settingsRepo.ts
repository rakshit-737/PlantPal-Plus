import { getPool } from '../../db/pool.ts'

export interface UserSettingsRow {
  timezone: string
  hemisphere: string
  locale: string
  unit_system: string
  theme: string
  week_start_day: string
  plant_care_enabled: boolean
  fitness_enabled: boolean
  nutrition_enabled: boolean
  quiet_hours_mode: string
  /** Wall-clock `HH:MM` in the user's own zone, or null. FR-SET-16 / FR-NOT-06. */
  quiet_start_time: string | null
  quiet_end_time: string | null
  daily_notification_cap: number
  reduce_motion: boolean
  larger_text: boolean
  high_contrast: boolean
  analytics_opt_in: boolean
}

const SETTINGS_COLUMNS = `timezone, hemisphere, locale, unit_system, theme, week_start_day,
  plant_care_enabled, fitness_enabled, nutrition_enabled, quiet_hours_mode,
  quiet_start_time, quiet_end_time,
  daily_notification_cap, reduce_motion, larger_text, high_contrast, analytics_opt_in`

/**
 * node-postgres registers no parser for OID 1083 (`time`) — pg-types covers
 * 1082/1114/1184 only — so `quiet_start_time` arrives as the raw text
 * PostgreSQL emits for a `time` value: 'HH:MM:SS' ('22:00:00'), plus a
 * fractional part if the stored value ever carries sub-second precision.
 *
 * Both clients write and render 'HH:MM' (FR-SET-16 configures at five-minute
 * granularity), so the seconds are noise that would otherwise round-trip
 * through every PUT body and make "what I sent" differ from "what I read
 * back". Truncating here keeps that one shape decision in one place, on the
 * only path either column leaves the database by.
 */
function normaliseTimeOfDay(value: string | null): string | null {
  if (value === null) return null
  const match = /^(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value)
  // An unrecognised shape passes through untouched rather than being sliced:
  // a visibly wrong value is debuggable, a silently truncated one is not.
  return match?.[1] ?? value
}

/**
 * Applied to every row leaving this module, read path and write path alike, so
 * a PUT response and a subsequent GET cannot disagree. Exported because the
 * normalisation is the client-facing contract and is worth asserting without a
 * live database.
 */
export function normaliseSettingsRow(row: UserSettingsRow): UserSettingsRow {
  return {
    ...row,
    quiet_start_time: normaliseTimeOfDay(row.quiet_start_time),
    quiet_end_time: normaliseTimeOfDay(row.quiet_end_time),
  }
}

/**
 * Settings row is created lazily: registration predates this module, so many
 * users have no row yet. INSERT … ON CONFLICT DO NOTHING then SELECT keeps the
 * read path a single round trip past the first call and is race-safe.
 */
export async function getSettings(userId: string): Promise<UserSettingsRow> {
  const pool = getPool()
  await pool.query(
    `insert into user_settings (user_id) values ($1) on conflict (user_id) do nothing`,
    [userId],
  )
  const { rows } = await pool.query<UserSettingsRow>(
    `select ${SETTINGS_COLUMNS} from user_settings where user_id = $1`,
    [userId],
  )
  return normaliseSettingsRow(rows[0]!)
}

/**
 * The only columns a PUT may touch. Identifier interpolation is restricted to
 * this set (NFR-SEC-10) — request-derived keys never reach SQL directly.
 */
const UPDATABLE_SETTINGS_COLUMNS = new Set([
  'timezone',
  'hemisphere',
  'locale',
  'unit_system',
  'theme',
  'week_start_day',
  'plant_care_enabled',
  'fitness_enabled',
  'nutrition_enabled',
  'quiet_hours_mode',
  'quiet_start_time',
  'quiet_end_time',
  'daily_notification_cap',
  'reduce_motion',
  'larger_text',
  'high_contrast',
  'analytics_opt_in',
])

export async function updateSettings(
  userId: string,
  patch: Partial<UserSettingsRow>,
): Promise<UserSettingsRow> {
  // `undefined` means "not in the patch"; `null` is a deliberate write that
  // clears a nullable column (the quiet-hours boundaries are the only ones a
  // client can clear today), so the filter must distinguish the two.
  const fields = Object.entries(patch).filter(
    ([k, v]) => v !== undefined && UPDATABLE_SETTINGS_COLUMNS.has(k),
  )
  if (fields.length === 0) return getSettings(userId)

  // Ensure the row exists before UPDATE (same lazy-create as getSettings).
  const pool = getPool()
  await pool.query(
    `insert into user_settings (user_id) values ($1) on conflict (user_id) do nothing`,
    [userId],
  )
  const setClauses = fields.map(([k], i) => `${k}=$${i + 2}`).join(', ')
  const values = fields.map(([, v]) => v)
  const { rows } = await pool.query<UserSettingsRow>(
    `update user_settings set ${setClauses}, updated_at=now()
     where user_id=$1
     returning ${SETTINGS_COLUMNS}`,
    [userId, ...values],
  )
  return normaliseSettingsRow(rows[0]!)
}
