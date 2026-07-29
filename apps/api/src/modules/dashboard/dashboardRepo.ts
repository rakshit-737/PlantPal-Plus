/**
 * Dashboard repository — aggregates streak, plant, fitness, and nutrition data
 * for the home screen summary.
 *
 * All queries use local_date_str comparisons so day boundaries match the user's
 * wall clock without server-timezone math (§1).
 */

import { getPool } from '../../db/pool.ts'

export interface DashboardData {
  streak: { current: number; longest: number }
  plants: { due_today: number; overdue: number }
  fitness: { steps: number; goal: number }
  nutrition: { calories_consumed: number; target: number }
  today_list: { type: string; id: string; title: string }[]
}

const FITNESS_STEPS_GOAL = 10000
const NUTRITION_CALORIE_TARGET = 2000

export async function getDashboard(
  userId: string,
  localDateStr: string,
): Promise<DashboardData> {
  const pool = getPool()

  const [streakRes, plantsDueRes, plantsOverdueRes, stepsRes, caloriesRes] =
    await Promise.all([
      pool.query<{ current_length: number; longest_length: number }>(
        `select current_length, longest_length
         from streaks
         where user_id = $1 and streak_type = 'OVERALL'
         limit 1`,
        [userId],
      ),
      pool.query<{ id: string; nickname: string }>(
        `select id, nickname
         from plants
         where user_id = $1
           and deleted_at is null
           and next_water_due_at::date = $2::date`,
        [userId, localDateStr],
      ),
      pool.query<{ count: string }>(
        `select count(*)::text as count
         from plants
         where user_id = $1
           and deleted_at is null
           and next_water_due_at < now()
           and next_water_due_at::date < $2::date`,
        [userId, localDateStr],
      ),
      pool.query<{ steps: string }>(
        `select coalesce(sum(steps), 0)::text as steps
         from workouts
         where user_id = $1 and local_date_str = $2 and deleted_at is null`,
        [userId, localDateStr],
      ),
      pool.query<{ calories: string }>(
        `select coalesce(sum(total_kcal), 0)::text as calories
         from meals
         where user_id = $1 and local_date_str = $2 and deleted_at is null`,
        [userId, localDateStr],
      ),
    ])

  const streakRow = streakRes.rows[0]
  const steps = Number(stepsRes.rows[0]?.steps ?? 0)
  const caloriesConsumed = Number(caloriesRes.rows[0]?.calories ?? 0)

  const today_list: { type: string; id: string; title: string }[] = [
    ...plantsDueRes.rows.map((p) => ({
      type: 'PLANT_WATER',
      id: p.id,
      title: p.nickname,
    })),
  ]

  if (caloriesConsumed < NUTRITION_CALORIE_TARGET) {
    today_list.push({
      type: 'LOG_MEAL',
      id: 'log_meal',
      title: 'Log a meal',
    })
  }

  return {
    streak: {
      current: streakRow?.current_length ?? 0,
      longest: streakRow?.longest_length ?? 0,
    },
    plants: {
      due_today: plantsDueRes.rows.length,
      overdue: Number(plantsOverdueRes.rows[0]?.count ?? 0),
    },
    fitness: {
      steps,
      goal: FITNESS_STEPS_GOAL,
    },
    nutrition: {
      calories_consumed: caloriesConsumed,
      target: NUTRITION_CALORIE_TARGET,
    },
    today_list,
  }
}
