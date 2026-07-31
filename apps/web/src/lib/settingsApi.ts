/**
 * Typed wrappers over /api/v1/settings. The enum unions mirror the server's
 * validation table in apps/api settingsController (ENUMS) exactly — the API
 * rejects anything outside these values, so the types encode the contract.
 */
import { apiRequest } from './apiClient'

export type Hemisphere = 'NORTHERN' | 'SOUTHERN' | 'EQUATORIAL'
export type UnitSystem = 'METRIC' | 'IMPERIAL'
export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM'
export type WeekStartDay = 'SUNDAY' | 'MONDAY'
export type QuietHoursMode = 'OFF' | 'WINDOW' | 'SCHEDULED_ONLY'

export interface UserSettings {
  timezone: string
  hemisphere: Hemisphere
  locale: string
  unit_system: UnitSystem
  theme: ThemePreference
  week_start_day: WeekStartDay
  plant_care_enabled: boolean
  fitness_enabled: boolean
  nutrition_enabled: boolean
  quiet_hours_mode: QuietHoursMode
  /**
   * Wall-clock "HH:MM" (24-hour) in the user's own timezone, or null when the
   * boundary is unset. Rows created lazily start as WINDOW with both times
   * null, so null is a state the UI must render, not an impossible case.
   *
   * The server validates the triple as a unit: with quiet_hours_mode WINDOW
   * both times are required (details[].issue 'window_requires_start_and_end')
   * and they must differ ('window_start_equals_end'). Send the mode and both
   * times in one PUT so a switch to WINDOW never lands mid-edit.
   */
  quiet_start_time: string | null
  quiet_end_time: string | null
  /** Integer 1–20, enforced server-side. */
  daily_notification_cap: number
  reduce_motion: boolean
  larger_text: boolean
  high_contrast: boolean
  analytics_opt_in: boolean
}

export const getSettings = () => apiRequest<UserSettings>('/v1/settings')
export const updateSettings = (patch: Partial<UserSettings>) =>
  apiRequest<UserSettings>('/v1/settings', { method: 'PUT', body: patch })
