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
