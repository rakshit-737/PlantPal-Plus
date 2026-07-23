import { apiRequest } from './apiClient'

export interface Food {
  id: string
  name: string
  brand: string | null
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  default_serving_unit: string
  default_serving_grams: number | null
}

export interface MealItem {
  id: string
  food_name_at_log: string
  quantity: number
  serving_unit: string
  grams: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface Meal {
  id: string
  meal_type: string
  total_kcal: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  items: MealItem[]
}

export interface DailySummary {
  meals: Meal[]
  water_ml_total: number
  water_goal_ml: number
  totals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }
}

export const searchFoods = (q: string) =>
  apiRequest<Food[]>(`/v1/nutrition/foods/search?q=${encodeURIComponent(q)}`)
export const getDailySummary = (date?: string) =>
  apiRequest<DailySummary>(`/v1/nutrition/summary${date ? `?date=${date}` : ''}`)
export const logMeal = (data: {
  meal_type: string
  note?: string
  local_date_str: string
  items: Partial<MealItem>[]
}) => apiRequest<Meal>('/v1/nutrition/meals', { method: 'POST', body: data })
export const logWater = (amount_ml: number) =>
  apiRequest<{ id: string; amount_ml: number }>('/v1/nutrition/water', {
    method: 'POST',
    body: { amount_ml, local_date_str: new Date().toISOString().slice(0, 10) },
  })
