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
  /**
   * Whether this row is one the caller created (FR-NUT-10).
   *
   * `created_by` is deliberately NOT projected alongside it. Every query that
   * produces this shape already restricts custom rows to `created_by = caller`,
   * so within a response `is_custom = true` *means* "yours" — a second column
   * repeating the caller's own id would add no information and would put user
   * ids on the wire for nothing. A client may therefore treat this flag as an
   * ownership flag, which is exactly what the delete affordance needs.
   */
  is_custom: boolean
}

/**
 * The columns every food projection returns, in one place.
 *
 * searchFoods and createCustomFood must agree exactly: FR-NUT-10's outputs
 * promise a created food is loggable without a second round-trip through
 * search, which is only true while the two shapes are identical. Numeric
 * columns are cast to float in SQL because node-postgres returns `numeric` as a
 * string by default, which would otherwise surface as strings on the wire.
 */
const FOOD_COLUMNS = `id, name, brand,
       kcal_per_100g::float8    as kcal_per_100g,
       protein_per_100g::float8 as protein_per_100g,
       carbs_per_100g::float8   as carbs_per_100g,
       fat_per_100g::float8     as fat_per_100g,
       default_serving_unit,
       default_serving_grams::float8 as default_serving_grams,
       is_custom`

/**
 * Search live foods by name (case-insensitive substring).
 *
 * Catalogue rows (is_custom = false) are visible to everyone; custom rows are
 * scoped to their owner so one user's private foods never leak into another's
 * search.
 *
 * `deleted_at is null` is what makes softDeleteCustomFood take effect here: a
 * removed food stops being findable the moment it is tombstoned, without this
 * predicate changing. It also matches idx_foods_name, the partial index on
 * exactly that condition.
 */
export async function searchFoods(
  query: string,
  userId: string,
): Promise<FoodSearchResult[]> {
  const pool = getPool()
  const { rows } = await pool.query<FoodSearchResult>(
    `select ${FOOD_COLUMNS}
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
 * Create a custom food — FR-NUT-10
 * --------------------------------------------------------------------- */

/**
 * Per-user ceiling on user-created foods.
 *
 * NFR-SCAL-03 fixes this at 200 ("User-created custom foods | 200 | Server-side
 * count check at create | LIMIT_EXCEEDED"). FR-NUT-10's inputs table still says
 * 500; the NFR table is the quantified, verifiable target and is the tighter of
 * the two, so it wins — ceilings exist so one enthusiastic account cannot
 * exhaust the ~0.5 GB free-tier database (CON-07) for the whole pilot cohort.
 */
export const MAX_CUSTOM_FOODS_PER_USER = 200

/**
 * How long a soft-deleted custom food keeps occupying a ceiling slot.
 *
 * NFR-SCAL-03's conditions: "Soft-deleted records **inside their 30-day
 * retention window** count toward every ceiling above, because they still
 * occupy storage." NFR-PRIV-04's retention schedule supplies the window —
 * soft-deleted records are hard-deleted 30 days from `deleted_at` by the daily
 * purge job — so the clause has an end date and the count must honour it.
 *
 * Before deletion existed this constant could not matter: with no way to
 * tombstone a food, "counts tombstones" and "counts live rows" were the same
 * query. softDeleteCustomFood makes them differ, and the earlier count had no
 * time bound at all — it would have counted a tombstone for ever, so a full
 * account could delete a hundred foods and still be refused every one of them.
 * That is not what NFR-SCAL-03 says and it is not a limit anyone can act on.
 *
 * The window is kept rather than dropped because it is load-bearing, not
 * pedantry: with no purge job in this codebase yet (nothing sweeps `deleted_at`
 * — grep says the only purge is the account one), a ceiling that ignored
 * tombstones outright would let one account create-and-delete without bound and
 * grow `foods` for ever, which is the storage abuse the ceiling exists to stop
 * (CON-07, ~0.5 GB). Counting them for 30 days caps the churn at one ceiling's
 * worth of rows per window per user.
 */
export const CUSTOM_FOOD_RETENTION_DAYS = 30

/**
 * The rows one account's custom-food ceiling counts, as a SQL predicate.
 *
 * Written once and shared by the insert guard and the cold-path re-read below,
 * because those two must never disagree: a refusal whose count came from a
 * different predicate than the one that caused it tells the user "199 of 200"
 * on the endpoint that just turned them away.
 *
 * The arguments are $-placeholders, not values — both call sites pass string
 * literals written here in this file, and nothing from a request reaches them,
 * so every value still travels as a bind parameter.
 */
function ceilingScopeSql(ownerParam: string, retentionParam: string): string {
  return `created_by = ${ownerParam}::uuid and is_custom
            and (deleted_at is null
                 or deleted_at > now() - (${retentionParam}::int * interval '1 day'))`
}

/**
 * Fields a client may supply. `is_custom`, `created_by` and `source` are
 * deliberately absent: they are derived from the authenticated caller and
 * written as SQL constants below, so no request body can set them.
 */
export interface CreateCustomFoodInput {
  name: string
  brand?: string | undefined
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  default_serving_unit: string
  default_serving_grams?: number | undefined
  barcode?: string | undefined
}

/**
 * Discriminated outcome rather than a thrown error: hitting the ceiling is an
 * expected product state with its own HTTP mapping, and the controller owns the
 * error envelope (FR-SYS-19).
 */
export type CreateCustomFoodResult =
  | { status: 'CREATED'; food: FoodSearchResult }
  | {
      status: 'LIMIT_EXCEEDED'
      current: number
      ceiling: number
      /**
       * How many of `current` are tombstones still inside the retention window.
       *
       * NFR-SCAL-03 requires the refusal to state "the number of records
       * recoverable from trash" so the user is told exactly what to do. Custom
       * foods have no restore route, so this is not a trash the user can empty
       * early — it is the part of their count that is already deleted and will
       * clear itself. Naming it is what stops the refusal reading as a lie to
       * someone who just deleted ten foods and is still refused.
       */
      deleted: number
    }

/**
 * Insert one private food owned by `userId` (FR-NUT-10 clause 3).
 *
 * The ceiling is enforced *inside* the insert rather than by a separate count
 * round-trip: `insert ... select ... where (count) < ceiling` yields zero rows
 * when the account is full, so the check and the write share one statement and
 * one snapshot. Two creates racing at exactly the boundary can still both see
 * 199 under READ COMMITTED — closing that would need SERIALIZABLE or a counter
 * table, which is not worth it for a storage-abuse guard that may overshoot by
 * the number of genuinely simultaneous requests.
 *
 * What counts is ceilingScopeSql: live rows plus tombstones younger than
 * CUSTOM_FOOD_RETENTION_DAYS. See that constant for why the window is there and
 * why it now has an end.
 *
 * Returned columns are exactly those of searchFoods, including the ::float8
 * casts, so a freshly created food can be logged straight away without a
 * second round-trip through search.
 */
export async function createCustomFood(
  userId: string,
  data: CreateCustomFoodInput,
): Promise<CreateCustomFoodResult> {
  const pool = getPool()
  const { rows } = await pool.query<FoodSearchResult>(
    `insert into foods
       (name, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
        default_serving_unit, default_serving_grams, barcode, source, is_custom, created_by)
     select $1::text, $2::text, $3::numeric, $4::numeric, $5::numeric, $6::numeric,
            $7::text, $8::numeric, $9::text, 'CUSTOM', true, $10::uuid
     where (select count(*) from foods
             where ${ceilingScopeSql('$10', '$12')}) < $11::int
     returning ${FOOD_COLUMNS}`,
    [
      data.name,
      data.brand ?? null,
      data.kcal_per_100g,
      data.protein_per_100g,
      data.carbs_per_100g,
      data.fat_per_100g,
      data.default_serving_unit,
      data.default_serving_grams ?? null,
      data.barcode ?? null,
      userId,
      MAX_CUSTOM_FOODS_PER_USER,
      CUSTOM_FOOD_RETENTION_DAYS,
    ],
  )

  const food = rows[0]
  if (food) return { status: 'CREATED', food }

  // Zero rows means the guard predicate was false. The count is re-read only on
  // this cold path, because NFR-SCAL-03 requires the refusal to state the
  // current count and the ceiling rather than just saying no (NFR-USAB-03).
  // `deleted` rides along from the same scan so the two figures describe one
  // snapshot rather than two.
  const { rows: [countRow] } = await pool.query<{ current: number; deleted: number }>(
    `select count(*)::int                                        as current,
            count(*) filter (where deleted_at is not null)::int  as deleted
     from foods
     where ${ceilingScopeSql('$1', '$2')}`,
    [userId, CUSTOM_FOOD_RETENTION_DAYS],
  )
  return {
    status: 'LIMIT_EXCEEDED',
    current: countRow?.current ?? MAX_CUSTOM_FOODS_PER_USER,
    ceiling: MAX_CUSTOM_FOODS_PER_USER,
    deleted: countRow?.deleted ?? 0,
  }
}

/* -----------------------------------------------------------------------
 * Delete a custom food — FR-NUT-10, BR-ACC-01
 * --------------------------------------------------------------------- */

/**
 * Remove one of the caller's own custom foods.
 *
 * **Soft, not hard.** Both survive the diary, and that was checked rather than
 * assumed: `meal_items.food_id` is `references foods(id) on delete set null`
 * and `food_name_at_log` is a NOT NULL snapshot taken at log time, while
 * getDailySummary reads `meal_items` alone and never joins `foods` — so a hard
 * delete would leave every historical entry rendering exactly as before. Soft
 * wins on the other three counts. It keeps `food_id` intact, so the link from
 * an entry back to the food it came from survives for anything that later wants
 * to group or re-log by food; NFR-PRIV-04 gives soft-deleted records a 30-day
 * recovery window that a hard delete would silently opt this one table out of;
 * and it is what every other user-owned table here does (plants, growth
 * entries, meals), which is what makes one purge job able to sweep them all.
 *
 * The predicate is the whole authorisation check, on the write itself rather
 * than in a read before it: `created_by = $2 and is_custom` admits only a
 * custom food the caller owns, so a catalogue row and a stranger's food both
 * match nothing — and the caller cannot tell either of those apart from an id
 * that never existed (BR-ACC-01: a distinguishable response is an enumeration
 * oracle). `is_custom` is redundant against the table's own CHECK, which forces
 * `created_by is null` on catalogue rows, but it is cheap, it states the intent,
 * and it matches idx_foods_custom_owner, the partial index on exactly that.
 *
 * `deleted_at is null` makes a repeat delete match nothing and report false, so
 * the caller answers 404 instead of quietly re-stamping the tombstone with a
 * later date — which would silently restart the retention window and push the
 * ceiling slot another 30 days away.
 */
export async function softDeleteCustomFood(foodId: string, userId: string): Promise<boolean> {
  const pool = getPool()
  const { rowCount } = await pool.query(
    `update foods
        set deleted_at = now(), updated_at = now()
      where id = $1 and created_by = $2 and is_custom and deleted_at is null`,
    [foodId, userId],
  )
  return (rowCount ?? 0) > 0
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
