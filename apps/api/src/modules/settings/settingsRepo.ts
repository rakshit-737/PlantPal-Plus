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
  daily_notification_cap: number
  reduce_motion: boolean
  larger_text: boolean
  high_contrast: boolean
  analytics_opt_in: boolean
}

const SETTINGS_COLUMNS = `timezone, hemisphere, locale, unit_system, theme, week_start_day,
  plant_care_enabled, fitness_enabled, nutrition_enabled, quiet_hours_mode,
  daily_notification_cap, reduce_motion, larger_text, high_contrast, analytics_opt_in`

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
  return rows[0]!
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
  return rows[0]!
}
