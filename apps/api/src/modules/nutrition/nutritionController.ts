import type { NextFunction, Request, Response } from 'express'

import { AppError } from '../../http/errors.js'
import { getUserId } from '../../http/requestUser.js'
import { recordDailyLogSafe } from '../engagement/engagementService.js'
import {
  searchFoods,
  getDailySummary,
  logMeal,
  logWater,
} from './nutritionRepo.js'

const VALID_MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const
const VALID_SERVING_UNITS = ['GRAM', 'MILLILITRE', 'PIECE', 'CUP', 'TABLESPOON', 'SLICE', 'CUSTOM'] as const

function todayUtcDateStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function isValidDateStr(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export async function searchFoodsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query.q
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      throw new AppError('VALIDATION_FAILED', 'Query parameter q is required.')
    }
    const userId = getUserId(req)
    const results = await searchFoods(q.trim(), userId)
    res.status(200).json({ foods: results })
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

    res.status(201).json(entry)
  } catch (err) {
    next(err)
  }
}
