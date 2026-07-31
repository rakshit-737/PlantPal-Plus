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
