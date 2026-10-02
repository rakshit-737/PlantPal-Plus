import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { AppError, notFound } from '../../http/errors.ts'
import { getUserId } from '../../http/requestUser.ts'
import { evaluateAchievementsSafe, recordDailyLogSafe } from '../engagement/engagementService.ts'
import {
  searchFoods,
  createCustomFood,
  softDeleteCustomFood,
  getDailySummary,
  logMeal,
  logWater,
  CUSTOM_FOOD_RETENTION_DAYS,
} from './nutritionRepo.ts'

const VALID_MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const
const VALID_SERVING_UNITS = ['GRAM', 'MILLILITRE', 'PIECE', 'CUP', 'TABLESPOON', 'SLICE', 'CUSTOM'] as const

function todayUtcDateStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function isValidDateStr(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

/**
 * Route parameters reach Postgres as `uuid` bind values. A malformed one is
 * SQLSTATE 22P02 from the driver, which the terminal handler can only classify
 * as INTERNAL_ERROR — a 500 for what is plainly a client mistake. Reject the
 * shape before it becomes a query parameter.
 *
 * This does not weaken the not-found rule below. The decision is made from the
 * *syntax of the string the caller sent*, before any query runs, so it says
 * nothing whatever about which ids exist; every well-formed id — catalogue,
 * stranger's, or absent — still comes back as the same 404.
 */
function requireUuidParam(value: string | undefined, field: string): string {
  const parsed = z.string().uuid().safeParse(value)
  if (!parsed.success) {
    throw new AppError('VALIDATION_FAILED', `${field} must be a UUID.`, {
      details: [{ field, issue: 'invalid' }],
    })
  }
  return parsed.data
}

export async function searchFoodsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // An absent/empty q means "browse the catalogue" — the repo's ILIKE with an
    // empty needle matches every non-deleted food, alphabetically.
    const q = req.query.q
    if (q !== undefined && typeof q !== 'string') {
      throw new AppError('VALIDATION_FAILED', 'Query parameter q must be a string.')
    }
    const userId = getUserId(req)
    const results = await searchFoods((q ?? '').trim(), userId)
    res.status(200).json({ foods: results })
  } catch (err) {
    next(err)
  }
}

/**
 * Custom food body — FR-NUT-10.
 *
 * Every bound mirrors a CHECK constraint in 004-nutrition-schema.sql, so a body
 * that passes here cannot be rejected by the database: a constraint violation
 * would surface as an opaque INTERNAL_ERROR (the handler never leaks SQL text),
 * which tells the user nothing about which field to fix.
 *
 * `.strict()` — the ownership columns (`is_custom`, `created_by`, `source`) are
 * server-derived, so a body that mentions them is an attempt to set them and is
 * refused loudly rather than silently ignored. Stripping would hide the attempt
 * from the caller and from the logs.
 *
 * Not enforced here: BR-NUT-09's macro-sum plausibility rule (protein + carbs +
 * fat <= 100.5 g per 100 g) and BR-NUT-08's Atwater cross-check, which
 * FR-NUT-10 clause 2 wants surfaced as a *non-blocking* confirmation in the
 * editor. Both need UI that does not exist yet; this endpoint's contract is the
 * database's own constraint set.
 */
const customFoodSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    brand: z.string().trim().max(80).optional(),
    kcal_per_100g: z.number().min(0).max(9000),
    // Macros default to 0 exactly as the columns do, so a water-like food needs
    // only a name and an energy value.
    protein_per_100g: z.number().min(0).max(100).default(0),
    carbs_per_100g: z.number().min(0).max(100).default(0),
    fat_per_100g: z.number().min(0).max(100).default(0),
    default_serving_unit: z.enum(VALID_SERVING_UNITS).default('GRAM'),
    default_serving_grams: z.number().min(0.1).max(5000).optional(),
    // EAN-8 through GTIN-14; the column's regex is the same '^\d{8,14}$'.
    barcode: z.string().regex(/^\d{8,14}$/, 'must be 8 to 14 digits').optional(),
  })
  .strict()

/**
 * POST /api/v1/nutrition/foods — create a private custom food (FR-NUT-10).
 *
 * Ownership is taken from the authenticated subject and never from the body,
 * and the repo writes `is_custom = true` / `source = 'CUSTOM'` as SQL constants.
 * The created row is returned in the searchFoods shape so the client can log it
 * without a follow-up search (FR-NUT-10 outputs).
 */
export async function createCustomFoodHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // Resolved before validation: an unauthenticated caller must not learn the
    // shape of the payload from a field-level 422.
    const userId = getUserId(req)

    const parsed = customFoodSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_FAILED', 'The request failed validation.', {
        details: parsed.error.issues.slice(0, 20).map((i) => ({
          field: i.path.join('.') || '(root)',
          issue: i.message,
        })),
      })
    }

    const input = parsed.data
    const result = await createCustomFood(userId, {
      ...input,
      // An empty brand is legal under the CHECK but stores a meaningless empty
      // string; keep the column null so "no brand" has one representation.
      brand: input.brand ? input.brand : undefined,
    })

    if (result.status === 'LIMIT_EXCEEDED') {
      // NFR-SCAL-03 names this LIMIT_EXCEEDED at HTTP 409; the closed code
      // registry (FR-SYS-19) has no such member, and CONFLICT is its 409. The
      // count and ceiling ride in the details so the client can say exactly how
      // full the account is (NFR-USAB-03: never refuse without a recovery route).
      //
      // `deleted` is the third figure NFR-SCAL-03's conditions ask for. It is
      // what keeps the recovery route honest now that DELETE exists: without it
      // a user who has just deleted twenty foods and is still refused has been
      // told to do the thing they already did.
      throw new AppError(
        'CONFLICT',
        `You have reached your limit of ${result.ceiling} custom foods. ` +
          `Deleting one frees its slot ${CUSTOM_FOOD_RETENTION_DAYS} days later, ` +
          'when its retention window closes.',
        {
          details: [
            {
              field: 'foods',
              issue: 'limit_exceeded',
              current: result.current,
              ceiling: result.ceiling,
              deleted: result.deleted,
              retention_days: CUSTOM_FOOD_RETENTION_DAYS,
            },
          ],
        },
      )
    }

    res.status(201).json(result.food)
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/nutrition/foods/:id — remove one of the caller's own custom
 * foods (FR-NUT-10).
 *
 * One repo predicate decides ownership, kind and already-deleted together, and
 * all three answer the same 404: a catalogue food, another user's food, an id
 * that never existed and one deleted a minute ago are indistinguishable from
 * out here, so the endpoint cannot be walked to find out which ids are real
 * (BR-ACC-01). The message is deliberately the generic one — naming "custom
 * food" in the 404 for a catalogue id would itself be a hint.
 */
export async function deleteCustomFoodHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // Resolved first, as in create: an unauthenticated caller must not reach
    // the repo at all, let alone learn anything from its answer.
    const userId = getUserId(req)
    const foodId = requireUuidParam(req.params.id, 'id')

    const deleted = await softDeleteCustomFood(foodId, userId)
    if (!deleted) throw notFound()

    // Matches the plants and growth-entry deletes, which answer 200 with a
    // status body rather than 204 — the web client's apiRequest decodes a JSON
    // body on every response and an empty one is the special case, not this.
    res.json({ status: 'deleted' })
  } catch (err) {
    next(err)
  }
}

export async function getDailySummaryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const date = req.query.date ?? todayUtcDateStr()
    if (!isValidDateStr(date)) {
      throw new AppError('VALIDATION_FAILED', 'date must be YYYY-MM-DD.')
    }
    const userId = getUserId(req)
    const summary = await getDailySummary(userId, date)
    res.status(200).json(summary)
  } catch (err) {
    next(err)
  }
}

export async function logMealHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as Record<string, unknown>
    const errors: { field: string; issue: string }[] = []

    if (!body.meal_type || !VALID_MEAL_TYPES.includes(body.meal_type as typeof VALID_MEAL_TYPES[number])) {
      errors.push({ field: 'meal_type', issue: `must be one of ${VALID_MEAL_TYPES.join(', ')}` })
    }
    if (!isValidDateStr(body.local_date_str)) {
      errors.push({ field: 'local_date_str', issue: 'required, must be YYYY-MM-DD' })
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      errors.push({ field: 'items', issue: 'must be a non-empty array' })
    } else {
      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i] as Record<string, unknown>
        if (!item.food_name_at_log || typeof item.food_name_at_log !== 'string') {
          errors.push({ field: `items[${i}].food_name_at_log`, issue: 'required' })
        }
        if (typeof item.quantity !== 'number' || item.quantity <= 0) {
          errors.push({ field: `items[${i}].quantity`, issue: 'must be a positive number' })
        }
        if (!VALID_SERVING_UNITS.includes(item.serving_unit as typeof VALID_SERVING_UNITS[number])) {
          errors.push({ field: `items[${i}].serving_unit`, issue: `must be one of ${VALID_SERVING_UNITS.join(', ')}` })
        }
        if (typeof item.grams !== 'number' || item.grams <= 0) {
          errors.push({ field: `items[${i}].grams`, issue: 'must be a positive number' })
        }
        if (typeof item.kcal !== 'number' || item.kcal < 0) {
          errors.push({ field: `items[${i}].kcal`, issue: 'must be a non-negative number' })
        }
      }
    }

    if (errors.length) {
      throw new AppError('VALIDATION_FAILED', 'The request failed validation.', { details: errors })
    }

    const userId = getUserId(req)
    const meal = await logMeal(userId, {
      meal_type: body.meal_type as string,
      note: typeof body.note === 'string' ? body.note : undefined,
      local_date_str: body.local_date_str as string,
      client_idempotency_key: typeof body.client_idempotency_key === 'string' ? body.client_idempotency_key : undefined,
      items: (body.items as Record<string, unknown>[]).map((item) => ({
        food_id: typeof item.food_id === 'string' ? item.food_id : undefined,
        food_name_at_log: item.food_name_at_log as string,
        quantity: item.quantity as number,
        serving_unit: item.serving_unit as string,
        grams: item.grams as number,
        kcal: item.kcal as number,
        protein_g: typeof item.protein_g === 'number' ? item.protein_g : 0,
        carbs_g: typeof item.carbs_g === 'number' ? item.carbs_g : 0,
        fat_g: typeof item.fat_g === 'number' ? item.fat_g : 0,
      })),
    })

    // BR-GAM-04: the second de-duplicated meal of the day completes it.
    await recordDailyLogSafe(userId, 'NUTRITION', body.local_date_str as string)

    res.status(201).json(meal)
  } catch (err) {
    next(err)
  }
}

export async function logWaterHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as Record<string, unknown>
    const errors: { field: string; issue: string }[] = []

    if (typeof body.amount_ml !== 'number' || body.amount_ml < 1 || body.amount_ml > 5000) {
      errors.push({ field: 'amount_ml', issue: 'must be a number between 1 and 5000' })
    }
    if (!isValidDateStr(body.local_date_str)) {
      errors.push({ field: 'local_date_str', issue: 'required, must be YYYY-MM-DD' })
    }

    if (errors.length) {
      throw new AppError('VALIDATION_FAILED', 'The request failed validation.', { details: errors })
    }

    const userId = getUserId(req)
    const entry = await logWater(userId, {
      amount_ml: body.amount_ml as number,
      local_date_str: body.local_date_str as string,
      goal_ml_at_log: typeof body.goal_ml_at_log === 'number' ? body.goal_ml_at_log : undefined,
      client_idempotency_key: typeof body.client_idempotency_key === 'string' ? body.client_idempotency_key : undefined,
    })

    // Water feeds no streak scope (BR-GAM-04), but hydration achievements move.
    await evaluateAchievementsSafe(userId)

    res.status(201).json(entry)
  } catch (err) {
    next(err)
  }
}
