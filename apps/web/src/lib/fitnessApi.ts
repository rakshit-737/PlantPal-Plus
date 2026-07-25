import { apiRequest } from './apiClient'

export interface WorkoutSet {
  set_index: number
  reps: number
  weight_kg: number
  volume_kg: number
  estimated_1rm_kg: number | null
}

export interface Workout {
  id: string
  activity_type: string
  duration_mins: number | null
  perceived_intensity: string | null
  calories_burned: number | null
  total_volume_kg: number
  steps: number | null
  note: string | null
  local_date_str: string
  logged_at_utc: string
  sets: WorkoutSet[]
}

export interface Exercise {
  id: string
  name: string
  activity_type: string
  met_value: number
  is_strength: boolean
  muscle_group: string | null
}

export interface WeeklySummary {
  total_workouts: number
  total_duration_mins: number
  total_calories: number
  total_steps: number
  by_day: { date: string; workouts: number; steps: number; calories: number }[]
}

// List endpoints wrap their arrays ({ workouts }, { exercises }, …) per the
// fitness controller; unwrap here so pages deal in plain arrays.
export const listWorkouts = () =>
  apiRequest<{ workouts: Workout[] }>('/v1/fitness').then((r) => r.workouts)
export const logWorkout = (data: Partial<Workout>) =>
  apiRequest<Workout>('/v1/fitness', { method: 'POST', body: data })
export const getSummary = (week?: string) =>
  apiRequest<WeeklySummary>(`/v1/fitness/summary${week ? `?week=${week}` : ''}`)
export const searchExercises = (q: string) =>
  apiRequest<{ exercises: Exercise[] }>(`/v1/fitness/exercises?q=${encodeURIComponent(q)}`).then(
    (r) => r.exercises,
  )
export const getPersonalRecords = () =>
  apiRequest<{ personal_records: unknown[] }>('/v1/fitness/personal-records').then(
    (r) => r.personal_records,
  )
