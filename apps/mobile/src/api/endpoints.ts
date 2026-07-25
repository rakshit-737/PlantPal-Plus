/**
 * Typed wrappers over the PlantPal+ REST API, mirroring the contracts in
 * docs/architecture/03-api-specification.md and the web client's lib/ modules.
 * Response shapes must stay in lock-step with the Express controllers.
 */

import { apiRequest, getRefreshToken, setAccessToken, setRefreshToken } from './client'

/* ---------------------------------------------------------------- auth */

export interface AuthUser {
  id: string
  email: string
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'LOCKED' | 'PENDING_DELETION'
}

export interface LoginResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  user: AuthUser
  /** Mobile variant (BR-ACC-07 clause 7): refresh token arrives in the body. */
  refresh_token?: string
  account_pending_deletion?: boolean
  deletion_scheduled_at?: string
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipRefresh: true,
  })
  setAccessToken(res.access_token)
  if (res.refresh_token) await setRefreshToken(res.refresh_token)
  return res
}

export interface RegisterResponse {
  status: 'registered'
  message: string
}

export function register(
  email: string,
  password: string,
  dateOfBirth: string,
): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, date_of_birth: dateOfBirth },
    skipRefresh: true,
  })
}

export async function logout(): Promise<void> {
  try {
    // Mobile has no cookie jar; the server accepts the token in the body.
    const refresh_token = await getRefreshToken()
    await apiRequest('/auth/logout', {
      method: 'POST',
      body: refresh_token ? { refresh_token } : {},
      skipRefresh: true,
    })
  } catch {
    // Revoking a session that is already gone is not a failure worth surfacing.
  } finally {
    setAccessToken(null)
    await setRefreshToken(null)
  }
}

/* -------------------------------------------------------------- plants */

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
  base_interval_days: number
  last_watered_at: string | null
  room: string | null
  created_at: string
}

export const listPlants = () => apiRequest<Plant[]>('/v1/plants')
export const createPlant = (data: Partial<Plant>) =>
  apiRequest<Plant>('/v1/plants', { method: 'POST', body: data })
export const logCare = (
  plantId: string,
  data: { action_type: string; note?: string; local_date_str: string },
) => apiRequest<{ status: string }>(`/v1/plants/${plantId}/care`, { method: 'POST', body: data })

/* ------------------------------------------------------------- fitness */

export interface Workout {
  id: string
  activity_type: string
  duration_mins: number | null
  calories_burned: number | null
  total_volume_kg: number
  steps: number | null
  local_date_str: string
  logged_at_utc: string
}

export const listWorkouts = () =>
  apiRequest<{ workouts: Workout[] }>('/v1/fitness').then((r) => r.workouts)
export const logWorkout = (data: {
  activity_type: string
  duration_mins?: number
  steps?: number
  local_date_str: string
}) => apiRequest<Workout>('/v1/fitness', { method: 'POST', body: data })

/* ----------------------------------------------------------- nutrition */

export interface Food {
  id: string
  name: string
  brand: string | null
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

export interface MealItem {
  id: string
  food_name_at_log: string
  grams: number
  kcal: number
}

export interface Meal {
  id: string
  meal_type: string
  total_kcal: number
  items: MealItem[]
}

export interface DailySummary {
  meals: Meal[]
  water_ml_total: number
  water_goal_ml: number | null
  totals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }
}

export const searchFoods = (q: string) =>
  apiRequest<{ foods: Food[] }>(`/v1/nutrition/foods/search?q=${encodeURIComponent(q)}`).then(
    (r) => r.foods,
  )
export const getDailySummary = (date?: string) =>
  apiRequest<DailySummary>(`/v1/nutrition/summary${date ? `?date=${date}` : ''}`)
export const logMeal = (data: {
  meal_type: string
  local_date_str: string
  items: {
    food_id?: string
    food_name_at_log: string
    quantity: number
    serving_unit: string
    grams: number
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }[]
}) => apiRequest<Meal>('/v1/nutrition/meals', { method: 'POST', body: data })
export const logWater = (amount_ml: number, local_date_str: string) =>
  apiRequest<{ id: string; amount_ml: number }>('/v1/nutrition/water', {
    method: 'POST',
    body: { amount_ml, local_date_str },
  })

/* ----------------------------------------------------------- dashboard */

export interface DashboardData {
  streak: { current: number; longest: number }
  plants: { due_today: number; overdue: number }
  fitness: { steps: number; goal: number }
  nutrition: { calories_consumed: number; target: number }
  today_list: { type: string; id: string; title: string }[]
}

export const getDashboard = (date?: string) =>
  apiRequest<DashboardData>(`/v1/dashboard${date ? `?date=${date}` : ''}`)

/* -------------------------------------------------------- achievements */

export interface Achievement {
  id: string
  code: string
  name: string
  description: string
  module: string
  icon: string | null
  tier: string
  points: number
}

export interface UserAchievement {
  id: string
  achievement_id: string
  unlocked_at: string | null
  progress_pct: number
  achievement: Achievement
}

export const getAchievements = () => apiRequest<UserAchievement[]>('/v1/achievements')
