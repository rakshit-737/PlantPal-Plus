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
  /** numeric(x,1) in Postgres — arrives as a string over JSON; Number() before math. */
  met_value: number | string
  is_strength: boolean
  muscle_group: string | null
}

/** BR-FIT-15: one row per user × exercise × record type; only the current best. */
export interface PersonalRecord {
  id: string
  exercise_id: string
  exercise_name: string
  record_type: 'HEAVIEST_WEIGHT' | 'BEST_ESTIMATED_1RM' | 'BEST_REP_COUNT' | string
  /** numeric(9,2) in Postgres — arrives as a string over JSON. */
  value: number | string
  source_workout_id: string | null
  achieved_at: string
}

export interface WeeklySummary {
  total_workouts: number
  total_duration_mins: number
  total_calories: number
  total_steps: number
  by_day: { date: string; workouts: number; steps: number; calories: number }[]
}

/**
 * POST /v1/fitness body. The server derives per-set volume and Epley e1RM from
 * reps + weight_kg (BR-FIT-14/15) — clients never send computed figures.
 */
export interface LogWorkoutSetInput {
  /** Optional; the server defaults to the array position (1-based). */
  set_index?: number
  reps: number
  weight_kg: number
}

export interface LogWorkoutInput {
  activity_type: string
  local_date_str: string
  duration_mins?: number | null
  perceived_intensity?: string | null
  steps?: number | null
  note?: string | null
  /** Catalogue exercise this workout was logged against. */
  exercise_id?: string
  /** FR-FIT-05: MET frozen at save time so catalogue edits never rewrite history. */
  met_value_at_log?: number
  sets?: LogWorkoutSetInput[]
}

// List endpoints wrap their arrays ({ workouts }, { exercises }, …) per the
// fitness controller; unwrap here so pages deal in plain arrays.
export const listWorkouts = () =>
  apiRequest<{ workouts: Workout[] }>('/v1/fitness').then((r) => r.workouts)
export const logWorkout = (data: LogWorkoutInput) =>
  apiRequest<Workout>('/v1/fitness', { method: 'POST', body: data })
export const getSummary = (week?: string) =>
  apiRequest<WeeklySummary>(`/v1/fitness/summary${week ? `?week=${week}` : ''}`)
export const searchExercises = (q: string) =>
  apiRequest<{ exercises: Exercise[] }>(`/v1/fitness/exercises?q=${encodeURIComponent(q)}`).then(
    (r) => r.exercises,
  )
export const getPersonalRecords = () =>
  apiRequest<{ personal_records: PersonalRecord[] }>('/v1/fitness/personal-records').then(
    (r) => r.personal_records,
  )
