import { apiRequest } from './apiClient'

export interface Plant {
  id: string
  nickname: string
  species_id: string | null
  status: string
  next_water_due_at: string | null
  effective_interval_days: number | null
  photo_url: string | null
  light_exposure: string
  placement: string
  pot_material: string | null
  soil_type: string | null
  base_interval_days: number
  min_interval_days: number
  max_interval_days: number
  last_watered_at: string | null
  room: string | null
  acquisition_date: string | null
  created_at: string
}

export interface Species {
  id: string
  scientific_name: string
  common_name: string
  base_interval_days: number
  min_interval_days: number
  max_interval_days: number
  default_light: string
  default_soil: string
}

export interface CareEvent {
  id: string
  plant_id: string
  action_type: string
  note: string | null
  logged_at_utc: string
  local_date_str: string
}

/**
 * One photo in a plant's growth timeline (FR-PLT-20/21).
 *
 * `height_cm` is a Postgres `numeric`, which node-postgres hands back as a
 * STRING to keep the exact decimal it stored. It is typed that way here on
 * purpose — the boundary reports what the wire actually carries, and callers
 * parse with Number() before formatting rather than trusting a lie in the type.
 */
export interface GrowthEntry {
  id: string
  plant_id: string
  user_id: string
  photo_url: string
  photo_storage_key: string
  height_cm: string | null
  note: string | null
  logged_at_utc: string
  local_date_str: string
  created_at: string
}

/**
 * The POST body. Optionals are `| undefined` explicitly so a caller can pass a
 * cleared field straight through under exactOptionalPropertyTypes; JSON.stringify
 * drops undefined keys, and the API's schema is `.strict()` — an explicit null
 * would be a 422, an absent key is "the user left it blank".
 */
export interface NewGrowthEntry {
  photo_url: string
  photo_storage_key?: string | undefined
  height_cm?: number | undefined
  note?: string | undefined
  local_date_str: string
}

export const listPlants = () => apiRequest<Plant[]>('/v1/plants')
export const getPlant = (id: string) => apiRequest<Plant>(`/v1/plants/${id}`)
export const createPlant = (data: Partial<Plant>) =>
  apiRequest<Plant>('/v1/plants', { method: 'POST', body: data })
export const updatePlant = (id: string, data: Partial<Plant>) =>
  apiRequest<Plant>(`/v1/plants/${id}`, { method: 'PUT', body: data })
export const deletePlant = (id: string) =>
  apiRequest<{ status: string }>(`/v1/plants/${id}`, { method: 'DELETE' })
export const logCare = (
  plantId: string,
  data: { action_type: string; note?: string; local_date_str: string },
) => apiRequest<CareEvent>(`/v1/plants/${plantId}/care`, { method: 'POST', body: data })
export const getCareHistory = (plantId: string) =>
  apiRequest<CareEvent[]>(`/v1/plants/${plantId}/care`)
export const searchSpecies = (q: string) =>
  apiRequest<Species[]>(`/v1/plants/species?q=${encodeURIComponent(q)}`)

/** Newest-first, max 50, soft-deleted excluded. A bare array, not an envelope. */
export const listGrowth = (plantId: string) =>
  apiRequest<GrowthEntry[]>(`/v1/plants/${plantId}/growth`)
export const addGrowthEntry = (plantId: string, data: NewGrowthEntry) =>
  apiRequest<GrowthEntry>(`/v1/plants/${plantId}/growth`, { method: 'POST', body: data })
export const deleteGrowthEntry = (plantId: string, entryId: string) =>
  apiRequest<{ status: string }>(`/v1/plants/${plantId}/growth/${entryId}`, { method: 'DELETE' })
