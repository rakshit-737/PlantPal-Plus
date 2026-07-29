import { apiRequest } from './apiClient'

export interface UserSettings {
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

export const getSettings = () => apiRequest<UserSettings>('/v1/settings')
export const updateSettings = (patch: Partial<UserSettings>) =>
  apiRequest<UserSettings>('/v1/settings', { method: 'PUT', body: patch })
