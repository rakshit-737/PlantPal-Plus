import { ApiError, apiRequest } from './apiClient'

/**
 * The serving units the API's enum accepts, in the order the create form offers
 * them (nutritionController.VALID_SERVING_UNITS).
 */
export const SERVING_UNITS = [
  'GRAM',
  'MILLILITRE',
  'PIECE',
  'CUP',
  'TABLESPOON',
  'SLICE',
  'CUSTOM',
] as const
export type ServingUnit = (typeof SERVING_UNITS)[number]

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
  /**
   * True for a food this account created (FR-NUT-10), false for a catalogue row.
   *
   * Read it as an *ownership* flag, which is what makes it safe to hang a delete
   * button on. The payload carries no `created_by` and needs none: the API's
   * search only ever returns catalogue rows plus the caller's own custom rows
   * (nutritionRepo.searchFoods scopes custom rows to `created_by = caller`), so
   * another user's custom food cannot appear in this list at all — there is no
   * "someone else's custom food" case left for the client to tell apart. If that
   * predicate ever widened, this flag would stop meaning "mine" and the delete
   * affordance would need a real owner field.
   */
  is_custom: boolean
}

/**
 * Postgres `numeric` reaches the client as a string unless the query casts it.
 * The nutrition repo casts to float8 today, but formatting a string as a number
 * fails silently if that ever regresses — so coerce once, at the boundary.
 */
function normalizeFood(food: Food): Food {
  return {
    ...food,
    kcal_per_100g: Number(food.kcal_per_100g),
    protein_per_100g: Number(food.protein_per_100g),
    carbs_per_100g: Number(food.carbs_per_100g),
    fat_per_100g: Number(food.fat_per_100g),
    default_serving_grams:
      food.default_serving_grams == null ? null : Number(food.default_serving_grams),
  }
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

/** Input for one meal item — mirrors the API's logMeal contract, which also
 * accepts the optional catalogue food_id the view type does not carry. */
export interface MealItemInput {
  food_id?: string
  food_name_at_log: string
  quantity: number
  serving_unit: string
  grams: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

// The API wraps the list as { foods } (nutritionController.searchFoodsHandler).
export const searchFoods = (q: string) =>
  apiRequest<{ foods: Food[] }>(`/v1/nutrition/foods/search?q=${encodeURIComponent(q)}`).then(
    (r) => r.foods.map(normalizeFood),
  )

/* ------------------------------------------------------ custom foods */

/** Body accepted by POST /v1/nutrition/foods (customFoodSchema, `.strict()`). */
export interface CreateCustomFoodInput {
  /** 1–120 characters after trimming. */
  name: string
  /** Up to 80 characters. */
  brand?: string | undefined
  /** 0–9000. */
  kcal_per_100g: number
  /** 0–100, defaults to 0 server-side. */
  protein_per_100g?: number | undefined
  /** 0–100, defaults to 0 server-side. */
  carbs_per_100g?: number | undefined
  /** 0–100, defaults to 0 server-side. */
  fat_per_100g?: number | undefined
  /** Defaults to GRAM server-side. */
  default_serving_unit?: ServingUnit | undefined
  /** 0.1–5000. */
  default_serving_grams?: number | undefined
  /** 8 to 14 digits. */
  barcode?: string | undefined
}

/** The per-user ceiling the API enforces (NFR-SCAL-03), used as a fallback. */
export const CUSTOM_FOOD_CEILING = 200

/**
 * How long a deleted custom food keeps occupying its slot, as a fallback for
 * when the API's detail row omits the figure.
 *
 * A deleted food leaves the search at once but keeps counting toward the ceiling
 * until it is purged: NFR-SCAL-03 counts soft-deleted records "inside their
 * 30-day retention window" because they still occupy storage, and NFR-PRIV-04
 * sets that window at 30 days from deletion. It is the one thing about deleting
 * a food that is not obvious from the UI, so every message that mentions the
 * ceiling has to mention this too.
 */
export const CUSTOM_FOOD_RETENTION_DAYS = 30

/**
 * The account already holds as many custom foods as it may. The API answers 409
 * CONFLICT with a `foods / limit_exceeded` detail carrying the current count,
 * the ceiling, how many of that count are already deleted, and the retention
 * window; this is its own type so callers can say something specific instead of
 * matching on status codes at the call site.
 */
export class CustomFoodLimitError extends Error {
  readonly ceiling: number
  /** The account's current custom-food count, when the API reported it. */
  readonly current: number | null
  /**
   * How many of `current` are already deleted and waiting out the retention
   * window. Zero means every counted food is still live, so "delete one" is
   * advice the user has not already taken.
   */
  readonly deleted: number
  /** Days a deleted food keeps its slot before the purge reclaims it. */
  readonly retentionDays: number

  constructor(
    ceiling: number,
    current: number | null,
    deleted = 0,
    retentionDays = CUSTOM_FOOD_RETENTION_DAYS,
  ) {
    super(`Custom food limit of ${ceiling} reached.`)
    this.name = 'CustomFoodLimitError'
    this.ceiling = ceiling
    this.current = current
    this.deleted = deleted
    this.retentionDays = retentionDays
  }
}

function toLimitError(err: ApiError): CustomFoodLimitError {
  // The limit row carries numeric members the shared envelope type does not
  // model, so read them defensively.
  const row = err.details.find((d) => d.issue === 'limit_exceeded') as
    | { current?: unknown; ceiling?: unknown; deleted?: unknown; retention_days?: unknown }
    | undefined
  return new CustomFoodLimitError(
    typeof row?.ceiling === 'number' ? row.ceiling : CUSTOM_FOOD_CEILING,
    typeof row?.current === 'number' ? row.current : null,
    typeof row?.deleted === 'number' ? row.deleted : 0,
    typeof row?.retention_days === 'number' ? row.retention_days : CUSTOM_FOOD_RETENTION_DAYS,
  )
}

/**
 * Create a private custom food (FR-NUT-10).
 *
 * Resolves with the created row in the *search* shape, so the caller can log it
 * immediately without a second round-trip. Rejects with CustomFoodLimitError at
 * the per-user ceiling; anything else propagates as a normal ApiError.
 *
 * The body is assembled key by key rather than spread from form state: the
 * endpoint validates with `.strict()`, so one stray key (`is_custom`, an empty
 * `brand`) turns a good submission into a 422.
 */
export async function createCustomFood(input: CreateCustomFoodInput): Promise<Food> {
  const body: Record<string, unknown> = {
    name: input.name,
    kcal_per_100g: input.kcal_per_100g,
  }
  if (input.brand !== undefined) body.brand = input.brand
  if (input.protein_per_100g !== undefined) body.protein_per_100g = input.protein_per_100g
  if (input.carbs_per_100g !== undefined) body.carbs_per_100g = input.carbs_per_100g
  if (input.fat_per_100g !== undefined) body.fat_per_100g = input.fat_per_100g
  if (input.default_serving_unit !== undefined) {
    body.default_serving_unit = input.default_serving_unit
  }
  if (input.default_serving_grams !== undefined) {
    body.default_serving_grams = input.default_serving_grams
  }
  if (input.barcode !== undefined) body.barcode = input.barcode

  try {
    const food = await apiRequest<Food>('/v1/nutrition/foods', { method: 'POST', body })
    return normalizeFood(food)
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) throw toLimitError(err)
    throw err
  }
}

/**
 * Delete one of this account's own custom foods (FR-NUT-10).
 *
 * The deletion is soft server-side: the food leaves every search immediately,
 * meals already logged keep reading exactly as before (they snapshot the name
 * and the macros at log time), and the row is purged — freeing its ceiling slot
 * — after CUSTOM_FOOD_RETENTION_DAYS.
 *
 * A catalogue food, another account's food and an id that never existed all
 * answer the same 404 (`ApiError`, status 404) by design, so a failure here
 * carries no information about which of those it was. Callers should say "that
 * food is no longer in your list" rather than guess.
 */
export const deleteCustomFood = (id: string) =>
  apiRequest<{ status: string }>(`/v1/nutrition/foods/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
export const getDailySummary = (date?: string) =>
  apiRequest<DailySummary>(`/v1/nutrition/summary${date ? `?date=${date}` : ''}`)
export const logMeal = (data: {
  meal_type: string
  note?: string
  local_date_str: string
  items: MealItemInput[]
}) => apiRequest<Meal>('/v1/nutrition/meals', { method: 'POST', body: data })
/**
 * Log a water entry. `goal_ml_at_log` optionally snapshots the user's daily
 * goal onto this entry (nutritionController.logWaterHandler accepts it); the
 * summary's water_goal_ml is derived from the day's logged goals server-side.
 */
export const logWater = (
  amount_ml: number,
  local_date_str: string,
  goal_ml_at_log?: number,
) =>
  apiRequest<{ id: string; amount_ml: number }>('/v1/nutrition/water', {
    method: 'POST',
    body:
      goal_ml_at_log != null
        ? { amount_ml, local_date_str, goal_ml_at_log }
        : { amount_ml, local_date_str },
  })
