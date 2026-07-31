/**
 * Plant-detail wrappers over /api/v1/plants/:id — the mobile mirror of the
 * detail slice of apps/web/src/lib/plantsApi.ts. List/create/log-care live in
 * src/api/endpoints.ts; this module adds only what the detail screen needs.
 */

import { apiRequest } from '../api/client'
import type { Plant } from '../api/endpoints'

export interface CareEvent {
  id: string
  plant_id: string
  action_type: string
  note: string | null
  logged_at_utc: string
  local_date_str: string
}

export const getPlant = (id: string) => apiRequest<Plant>(`/v1/plants/${id}`)

export const getCareHistory = (plantId: string) =>
  apiRequest<CareEvent[]>(`/v1/plants/${plantId}/care`)

export const deletePlant = (id: string) =>
  apiRequest<{ status: string }>(`/v1/plants/${id}`, { method: 'DELETE' })
