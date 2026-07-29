/**
 * Nutrition repository — database operations for ENT-16 (Food), ENT-17 (Meal),
 * ENT-18 (MealItem), ENT-19 (WaterLog).
 *
 * References: modules/nutrition.md, migrations/004-nutrition-schema.sql.
 *
 * Meals and water logs are append-only and carry a client_idempotency_key so a
 * replay from the offline queue cannot double-insert. Meal totals are summed
 * from the items and frozen onto the meal row (denormalised) so the daily
 * summary does not re-sum every item on every dashboard read.
 */

import { getPool, transaction } from '../../db/pool.ts'

/* -----------------------------------------------------------------------
 * Food search — FR-NUT search
 * --------------------------------------------------------------------- */

export interface FoodSearchResult {
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

/**
 * Search live foods by name (case-insensitive substring).
 *
 * Catalogue rows (is_custom = false) are visible to everyone; custom rows are
 * scoped to their owner so one user's private foods never leak into another's
 * search. Numeric columns are cast to float in SQL because node-postgres returns
 * `numeric` as a string by default, which would otherwise surface as strings on
 * the wire.
 */
export async function searchFoods(
  query: string,
  userId: string,
): Promise<FoodSearchResult[]> {
  const pool = getPool()
  const { rows } = await pool.query<FoodSearchResult>(
    `select id, name, brand,
            kcal_per_100g::float8    as kcal_per_100g,
            protein_per_100g::float8 as protein_per_100g,
            carbs_per_100g::float8   as carbs_per_100g,
            fat_per_100g::float8     as fat_per_100g,
            default_serving_unit,
            default_serving_grams::float8 as default_serving_grams
     from foods
     where deleted_at is null
       and name ilike '%' || $1 || '%'
       and (is_custom = false or created_by = $2)
     order by (lower(name) = lower($1)) desc,
              (lower(name) like lower($1) || '%') desc,
              name asc
     limit 200`,
    [query, userId],
  )
  return rows
}

/* -----------------------------------------------------------------------
 * Daily summary — FR-NUT diary read
 * --------------------------------------------------------------------- */

export interface MealItemView {
  id: string
  food_id: string | null
  food_name_at_log: string
  quantity: number
  serving_unit: string
  grams: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MealView {
  id: string
  meal_type: string
  total_kcal: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  note: string | null
  items: MealItemView[]
}

export interface DailySummary {
  meals: MealView[]
  water_ml_total: number
  water_goal_ml: number | null
  totals: {
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
}

/**
 * Default hydration goal used when no per-day goal was stored on any water log
 * for the day (FR-NUT-20). The per-day goal is preferred: it is frozen on the
 * log so a mid-day body-mass edit does not retroactively move a met target.
 */
export const DEFAULT_WATER_GOAL_ML = 2000

/**
 * The full nutrition diary for one local calendar day.
 *
 * `local_date_str` is compared as-is rather than derived from a UTC instant, so
 * the day boundary matches the user's wall clock without server-timezone math
 * (§1). Meals and their items are fetched together and stitched in memory: a
 * single scan of the day's items keyed by meal_id avoids an N+1 query per meal.
 */
export async function getDailySummary(
  userId: string,
  localDateStr: string,
): Promise<DailySummary> {
  const pool = getPool()

  const { rows: mealRows } = await pool.query<MealView>(
    `select id, meal_type,
            total_kcal::float8      as total_kcal,
            total_protein_g::float8 as total_protein_g,
            total_carbs_g::float8   as total_carbs_g,
            total_fat_g::float8     as total_fat_g,
            note
     from meals
     where user_id = $1 and local_date_str = $2 and deleted_at is null
     order by logged_at_utc asc`,
    [userId, localDateStr],
  )

  const meals: MealView[] = mealRows.map((m) => ({ ...m, items: [] }))

  if (meals.length > 0) {
    const mealIds = meals.map((m) => m.id)
    const { rows: itemRows } = await pool.query<MealItemView & { meal_id: string }>(
      `select mi.meal_id, mi.id, mi.food_id, mi.food_name_at_log,
              mi.quantity::float8  as quantity,
              mi.serving_unit,
              mi.grams::float8     as grams,
              mi.kcal::float8      as kcal,
              mi.protein_g::float8 as protein_g,
              mi.carbs_g::float8   as carbs_g,
              mi.fat_g::float8     as fat_g
       from meal_items mi
       where mi.meal_id = any ($1::uuid[])
       order by mi.created_at asc`,
      [mealIds],
    )

    const byMeal = new Map<string, MealItemView[]>()
    for (const { meal_id, ...item } of itemRows) {
      const list = byMeal.get(meal_id)
      if (list) list.push(item)
      else byMeal.set(meal_id, [item])
    }
    for (const meal of meals) {
      meal.items = byMeal.get(meal.id) ?? []
    }
  }

  const { rows: [waterRow] } = await pool.query<{
    water_ml_total: string
    water_goal_ml: number | null
  }>(
    `select coalesce(sum(amount_ml), 0)::text as water_ml_total,
            max(goal_ml_at_log)               as water_goal_ml
     from water_logs
     where user_id = $1 and local_date_str = $2`,
    [userId, localDateStr],
  )

  const totals = meals.reduce(
    (acc, m) => {
      acc.kcal += m.total_kcal
      acc.protein_g += m.total_protein_g
      acc.carbs_g += m.total_carbs_g
      acc.fat_g += m.total_fat_g
      return acc
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )

  return {
    meals,
    water_ml_total: Number(waterRow?.water_ml_total ?? 0),
    water_goal_ml: waterRow?.water_goal_ml ?? DEFAULT_WATER_GOAL_ML,
    totals,
  }
}

/* -----------------------------------------------------------------------
 * Log meal — FR-NUT diary write
 * --------------------------------------------------------------------- */

export interface LogMealItemInput {
  food_id?: string | undefined
  food_name_at_log: string
  quantity: number
  serving_unit: string
  grams: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface LogMealInput {
  meal_type: string
  note?: string | undefined
  local_date_str: string
  client_idempotency_key?: string | undefined
  items: LogMealItemInput[]
}

export interface LoggedMeal {
  id: string
  meal_type: string
  total_kcal: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
}

/**
 * Insert a meal and its items in a single transaction.
 *
 * Meal totals are computed from the items and frozen onto the meal row so the
 * daily summary query can SUM the meal-level columns without re-scanning items.
 * The client_idempotency_key unique constraint blocks duplicate offline replays.
 */
export async function logMeal(userId: string, data: LogMealInput): Promise<LoggedMeal> {
  return transaction(async (client) => {
    const total_kcal = data.items.reduce((s, i) => s + i.kcal, 0)
    const total_protein_g = data.items.reduce((s, i) => s + i.protein_g, 0)
    const total_carbs_g = data.items.reduce((s, i) => s + i.carbs_g, 0)
    const total_fat_g = data.items.reduce((s, i) => s + i.fat_g, 0)

    const { rows: mealRows } = await client.query<LoggedMeal>(
      `insert into meals
         (user_id, meal_type, total_kcal, total_protein_g, total_carbs_g, total_fat_g,
          note, local_date_str, client_idempotency_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id, meal_type,
                 total_kcal::float8      as total_kcal,
                 total_protein_g::float8 as total_protein_g,
                 total_carbs_g::float8   as total_carbs_g,
                 total_fat_g::float8     as total_fat_g`,
      [
        userId,
        data.meal_type,
        total_kcal,
        total_protein_g,
        total_carbs_g,
        total_fat_g,
        data.note ?? null,
        data.local_date_str,
        data.client_idempotency_key ?? null,
      ],
    )
    const meal = mealRows[0]
    if (!meal) throw new Error('meal insert returned no row')

    for (const item of data.items) {
      await client.query(
        `insert into meal_items
           (meal_id, food_id, food_name_at_log, quantity, serving_unit, grams,
            kcal, protein_g, carbs_g, fat_g)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          meal.id,
          item.food_id ?? null,
          item.food_name_at_log,
          item.quantity,
          item.serving_unit,
          item.grams,
          item.kcal,
          item.protein_g,
          item.carbs_g,
          item.fat_g,
        ],
      )
    }

    return meal
  })
}

/* -----------------------------------------------------------------------
 * Log water — FR-NUT-20
 * --------------------------------------------------------------------- */

export interface LogWaterInput {
  amount_ml: number
  local_date_str: string
  goal_ml_at_log?: number | undefined
  client_idempotency_key?: string | undefined
}

export interface LoggedWater {
  id: string
  amount_ml: number
}

export async function logWater(userId: string, data: LogWaterInput): Promise<LoggedWater> {
  const pool = getPool()
  const { rows } = await pool.query<LoggedWater>(
    `insert into water_logs (user_id, amount_ml, goal_ml_at_log, local_date_str, client_idempotency_key)
     values ($1, $2, $3, $4, $5)
     returning id, amount_ml`,
    [
      userId,
      data.amount_ml,
      data.goal_ml_at_log ?? null,
      data.local_date_str,
      data.client_idempotency_key ?? null,
    ],
  )
  const row = rows[0]
  if (!row) throw new Error('water_logs insert returned no row')
  return row
}

/* -----------------------------------------------------------------------
 * Water today — convenience for dashboard
 * --------------------------------------------------------------------- */

export async function getWaterToday(userId: string, localDateStr: string): Promise<number> {
  const pool = getPool()
  const { rows: [row] } = await pool.query<{ total: string }>(
    `select coalesce(sum(amount_ml), 0)::text as total
     from water_logs
     where user_id = $1 and local_date_str = $2`,
    [userId, localDateStr],
  )
  return Number(row?.total ?? 0)
}
