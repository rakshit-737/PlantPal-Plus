/**
 * Fitness repository — database operations for ENT-12 through ENT-15.
 */

import { getPool, transaction } from '../../db/pool.js'

/* -----------------------------------------------------------------------
 * Types
 * --------------------------------------------------------------------- */

export interface WorkoutSetRow {
  id: string
  set_index: number
  reps: number
  weight_kg: string
  volume_kg: string
  estimated_1rm_kg: string | null
}

export interface WorkoutRow {
  id: string
  user_id: string
  exercise_id: string | null
  activity_type: string
  duration_mins: number | null
  perceived_intensity: string | null
  met_value_at_log: string | null
  body_mass_at_log_kg: string | null
  calories_burned: string | null
  total_volume_kg: string
  steps: number | null
  note: string | null
  logged_at_utc: Date
  local_date_str: string
  client_idempotency_key: string | null
  sets: WorkoutSetRow[]
}

export interface CreateWorkoutData {
  exercise_id?: string | undefined
  activity_type: string
  duration_mins?: number | undefined
  perceived_intensity?: string | undefined
  met_value_at_log?: number | undefined
  body_mass_at_log_kg?: number | undefined
  calories_burned?: number | undefined
  total_volume_kg: number
  steps?: number | undefined
  note?: string | undefined
  local_date_str: string
  client_idempotency_key?: string | undefined
  sets?:
    | {
        set_index: number
        reps: number
        weight_kg: number
        volume_kg: number
        estimated_1rm_kg?: number | undefined
      }[]
    | undefined
}

export interface WeeklySummary {
  total_workouts: number
  total_duration_mins: number
  total_calories: number
  total_steps: number
  by_day: { date: string; workouts: number; steps: number; calories: number }[]
}

export interface ExerciseRow {
  id: string
  name: string
  activity_type: string
  met_value: string
  is_strength: boolean
  muscle_group: string | null
  is_custom: boolean
}

export interface PersonalRecordRow {
  id: string
  exercise_id: string
  exercise_name: string
  record_type: string
  value: string
  source_workout_id: string | null
  achieved_at: Date
}

/* -----------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------- */

async function fetchSetsForWorkouts(workoutIds: string[]): Promise<Map<string, WorkoutSetRow[]>> {
  if (workoutIds.length === 0) return new Map()
  const pool = getPool()
  const { rows } = await pool.query<WorkoutSetRow & { workout_id: string }>(
    `select workout_id, id, set_index, reps, weight_kg, volume_kg, estimated_1rm_kg
     from workout_sets
     where workout_id = any($1)
     order by workout_id, set_index`,
    [workoutIds],
  )
  const map = new Map<string, WorkoutSetRow[]>()
  for (const row of rows) {
    const { workout_id, ...set } = row
    const arr = map.get(workout_id) ?? []
    arr.push(set)
    map.set(workout_id, arr)
  }
  return map
}

/* -----------------------------------------------------------------------
 * Queries
 * --------------------------------------------------------------------- */

export async function listWorkouts(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<WorkoutRow[]> {
  const pool = getPool()
  const { rows } = await pool.query<Omit<WorkoutRow, 'sets'>>(
    `select id, user_id, exercise_id, activity_type, duration_mins, perceived_intensity,
            met_value_at_log, body_mass_at_log_kg, calories_burned, total_volume_kg,
            steps, note, logged_at_utc, local_date_str, client_idempotency_key
     from workouts
     where user_id = $1 and deleted_at is null
     order by logged_at_utc desc
     limit $2 offset $3`,
    [userId, limit, offset],
  )
  const setsMap = await fetchSetsForWorkouts(rows.map((r) => r.id))
  return rows.map((r) => ({ ...r, sets: setsMap.get(r.id) ?? [] }))
}

export async function getWorkout(id: string, userId: string): Promise<WorkoutRow | null> {
  const pool = getPool()
  const { rows } = await pool.query<Omit<WorkoutRow, 'sets'>>(
    `select id, user_id, exercise_id, activity_type, duration_mins, perceived_intensity,
            met_value_at_log, body_mass_at_log_kg, calories_burned, total_volume_kg,
            steps, note, logged_at_utc, local_date_str, client_idempotency_key
     from workouts
     where id = $1 and user_id = $2 and deleted_at is null`,
    [id, userId],
  )
  if (!rows[0]) return null
  const setsMap = await fetchSetsForWorkouts([rows[0].id])
  return { ...rows[0], sets: setsMap.get(rows[0].id) ?? [] }
}

export async function createWorkout(userId: string, data: CreateWorkoutData): Promise<WorkoutRow> {
  return await transaction(async (client) => {
    const { rows: workoutRows } = await client.query<Omit<WorkoutRow, 'sets'>>(
      `insert into workouts
         (user_id, exercise_id, activity_type, duration_mins, perceived_intensity,
          met_value_at_log, body_mass_at_log_kg, calories_burned, total_volume_kg,
          steps, note, local_date_str, client_idempotency_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning id, user_id, exercise_id, activity_type, duration_mins, perceived_intensity,
                 met_value_at_log, body_mass_at_log_kg, calories_burned, total_volume_kg,
                 steps, note, logged_at_utc, local_date_str, client_idempotency_key`,
      [
        userId,
        data.exercise_id ?? null,
        data.activity_type,
        data.duration_mins ?? null,
        data.perceived_intensity ?? null,
        data.met_value_at_log ?? null,
        data.body_mass_at_log_kg ?? null,
        data.calories_burned ?? null,
        data.total_volume_kg,
        data.steps ?? null,
        data.note ?? null,
        data.local_date_str,
        data.client_idempotency_key ?? null,
      ],
    )
    const workout = workoutRows[0]
    if (!workout) throw new Error('workout insert returned no row')

    const sets: WorkoutSetRow[] = []
    if (data.sets && data.sets.length > 0) {
      for (const s of data.sets) {
        const { rows: setRows } = await client.query<WorkoutSetRow>(
          `insert into workout_sets (workout_id, set_index, reps, weight_kg, volume_kg, estimated_1rm_kg)
           values ($1,$2,$3,$4,$5,$6)
           returning id, set_index, reps, weight_kg, volume_kg, estimated_1rm_kg`,
          [workout.id, s.set_index, s.reps, s.weight_kg, s.volume_kg, s.estimated_1rm_kg ?? null],
        )
        const setRow = setRows[0]
        if (!setRow) throw new Error('workout_sets insert returned no row')
        sets.push(setRow)
      }
    }

    return { ...workout, sets }
  })
}

export async function getWeeklySummary(userId: string, weekStart: string): Promise<WeeklySummary> {
  const pool = getPool()
  const { rows } = await pool.query<{
    date: string
    workouts: string
    steps: string
    calories: string
    duration_mins: string
  }>(
    `select local_date_str as date,
            count(*)::text as workouts,
            coalesce(sum(steps), 0)::text as steps,
            coalesce(sum(calories_burned), 0)::text as calories,
            coalesce(sum(duration_mins), 0)::text as duration_mins
     from workouts
     where user_id = $1
       and deleted_at is null
       and local_date_str >= $2
       and local_date_str < ($2::date + interval '7 days')::text
     group by local_date_str
     order by local_date_str`,
    [userId, weekStart],
  )

  const by_day = rows.map((r) => ({
    date: r.date,
    workouts: Number(r.workouts),
    steps: Number(r.steps),
    calories: Number(r.calories),
  }))

  return {
    total_workouts: by_day.reduce((s, d) => s + d.workouts, 0),
    total_duration_mins: rows.reduce((s, r) => s + Number(r.duration_mins), 0),
    total_calories: by_day.reduce((s, d) => s + d.calories, 0),
    total_steps: by_day.reduce((s, d) => s + d.steps, 0),
    by_day,
  }
}

export async function listExercises(search?: string): Promise<ExerciseRow[]> {
  const pool = getPool()
  const { rows } = await pool.query<ExerciseRow>(
    `select id, name, activity_type, met_value, is_strength, muscle_group, is_custom
     from exercises
     where ($1::text is null or lower(name) like '%' || lower($1) || '%')
       and (not is_custom or created_by is null)
     order by name
     limit 100`,
    [search ?? null],
  )
  return rows
}

export async function getPersonalRecords(userId: string): Promise<PersonalRecordRow[]> {
  const pool = getPool()
  const { rows } = await pool.query<PersonalRecordRow>(
    `select pr.id, pr.exercise_id, e.name as exercise_name, pr.record_type,
            pr.value, pr.source_workout_id, pr.achieved_at
     from personal_records pr
     join exercises e on e.id = pr.exercise_id
     where pr.user_id = $1
     order by e.name, pr.record_type`,
    [userId],
  )
  return rows
}
