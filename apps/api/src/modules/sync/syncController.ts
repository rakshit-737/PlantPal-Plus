/**
 * Sync controller — POST /api/v1/sync/outbox (FR-SYS-02/03, D-04).
 *
 * The offline outbox drains here in one batch. Only the four append-only log
 * event types may appear; each carries a client-generated UUID idempotency key
 * and is applied exactly once. Append-only ⇒ conflict-free by construction ⇒
 * deliberately no merge algorithm of any kind (BR-SYS-11).
 *
 * Events are processed strictly in array order (FR-SYS-04 drain ordering) and
 * a failure is per-event, never per-batch: one TERMINAL item must not strand
 * the rest of the queue behind it (FR-SYS-05).
 */

import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import {
  setVolumeKg,
  totalVolumeKg,
  estimatedOneRepMax,
  isEligibleForOneRepMaxRecord,
  workoutEnergyKcal,
} from '@plantpal/shared'

import { AppError } from '../../http/errors.js'
import { getUserId } from '../../http/requestUser.js'
import { logger } from '../../logging.js'
import { recordDailyLogSafe, type ModuleScope } from '../engagement/engagementService.js'
import { logCareEvent } from '../plants/plantsRepo.js'
import { createWorkout } from '../fitness/fitnessRepo.js'
import { logMeal, logWater } from '../nutrition/nutritionRepo.js'
import { findEntityIdByKey, markFailed, markProcessed, recordEvent } from './syncRepo.js'

const MAX_BATCH = 50

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const plantCarePayload = z
  .object({
    plant_id: z.string().uuid(),
    action_type: z.enum(['WATER', 'FERTILIZE', 'PRUNE', 'REPOT', 'MIST', 'ROTATE', 'TREAT']),
    note: z.string().max(500).optional(),
    local_date_str: dateStr,
  })
  .strict()

const workoutSetPayload = z
  .object({
    set_index: z.number().int().min(1).max(200).optional(),
    reps: z.number().int().min(0).max(1000),
    weight_kg: z.number().min(0).max(1000),
  })
  .strict()

const workoutPayload = z
  .object({
    activity_type: z.string().min(1).max(40),
    duration_mins: z.number().int().min(1).max(1440).optional(),
    perceived_intensity: z.enum(['LOW', 'MODERATE', 'VIGOROUS']).optional(),
    met_value_at_log: z.number().min(1).max(23).optional(),
    body_mass_at_log_kg: z.number().min(20).max(400).optional(),
    steps: z.number().int().min(0).max(200000).optional(),
    note: z.string().max(500).optional(),
    local_date_str: dateStr,
    sets: z.array(workoutSetPayload).max(200).optional(),
  })
  .strict()

const mealItemPayload = z
  .object({
    food_id: z.string().uuid().optional(),
    food_name_at_log: z.string().min(1).max(200),
    quantity: z.number().positive().max(100000),
    serving_unit: z.string().min(1).max(20),
    grams: z.number().positive().max(100000),
    kcal: z.number().min(0).max(100000),
    protein_g: z.number().min(0).max(10000),
    carbs_g: z.number().min(0).max(10000),
    fat_g: z.number().min(0).max(10000),
  })
  .strict()

const mealPayload = z
  .object({
    meal_type: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
    note: z.string().max(500).optional(),
    local_date_str: dateStr,
    items: z.array(mealItemPayload).min(1).max(50),
  })
  .strict()

const waterPayload = z
  .object({
    amount_ml: z.number().int().min(1).max(5000),
    goal_ml_at_log: z.number().int().min(1).max(20000).optional(),
    local_date_str: dateStr,
  })
  .strict()

const eventSchema = z
  .object({
    client_idempotency_key: z
      .string()
      .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    entity_type: z.enum(['PLANT_CARE_EVENT', 'WORKOUT', 'MEAL', 'WATER_LOG']),
    payload: z.unknown(),
  })
  .strict()

const batchSchema = z
  .object({
    events: z.array(eventSchema).min(1).max(MAX_BATCH),
  })
  .strict()

export interface SyncResult {
  client_idempotency_key: string
  status: 'PROCESSED' | 'FAILED'
  /** True when this key had been ingested before; the stored outcome is returned. */
  replay: boolean
  entity_id: string | null
  error_code: string | null
}

/** node-postgres surfaces a unique violation as SQLSTATE 23505. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505'
}

const DESTINATION_TABLE = {
  PLANT_CARE_EVENT: 'plant_care_events',
  WORKOUT: 'workouts',
  MEAL: 'meals',
  WATER_LOG: 'water_logs',
} as const

/** Which engagement scope a synced event feeds; water feeds none (BR-GAM-04). */
const ENGAGEMENT_SCOPE: Record<keyof typeof DESTINATION_TABLE, ModuleScope | null> = {
  PLANT_CARE_EVENT: 'PLANT_CARE',
  WORKOUT: 'FITNESS',
  MEAL: 'NUTRITION',
  WATER_LOG: null,
}

async function applyEvent(
  userId: string,
  key: string,
  entityType: keyof typeof DESTINATION_TABLE,
  payload: unknown,
): Promise<string | null> {
  switch (entityType) {
    case 'PLANT_CARE_EVENT': {
      const p = plantCarePayload.parse(payload)
      await logCareEvent(userId, p.plant_id, p.action_type, p.note, p.local_date_str, key)
      return findEntityIdByKey('plant_care_events', userId, key)
    }
    case 'WORKOUT': {
      const p = workoutPayload.parse(payload)
      // Derived figures recomputed server-side from @plantpal/shared, exactly
      // as the online path does (BR-FIT-14/15, FR-FIT-05, NFR-MAIN-03).
      const sets = (p.sets ?? []).map((s, i) => {
        const volume = setVolumeKg(s.reps, s.weight_kg)
        const eligible = isEligibleForOneRepMaxRecord(s.weight_kg, s.reps)
        return {
          set_index: s.set_index ?? i + 1,
          reps: s.reps,
          weight_kg: s.weight_kg,
          volume_kg: volume,
          ...(eligible ? { estimated_1rm_kg: estimatedOneRepMax(s.weight_kg, s.reps) } : {}),
        }
      })
      const totalVolume = totalVolumeKg(sets.map((s) => ({ reps: s.reps, weightKg: s.weight_kg })))
      let calories: number | undefined
      if (
        p.met_value_at_log !== undefined &&
        p.body_mass_at_log_kg !== undefined &&
        p.duration_mins !== undefined
      ) {
        calories = workoutEnergyKcal(p.met_value_at_log, p.body_mass_at_log_kg, p.duration_mins)
      }
      const workout = await createWorkout(userId, {
        activity_type: p.activity_type,
        duration_mins: p.duration_mins,
        perceived_intensity: p.perceived_intensity,
        met_value_at_log: p.met_value_at_log,
        body_mass_at_log_kg: p.body_mass_at_log_kg,
        calories_burned: calories,
        total_volume_kg: totalVolume,
        steps: p.steps,
        note: p.note,
        local_date_str: p.local_date_str,
        client_idempotency_key: key,
        sets: sets.length > 0 ? sets : undefined,
      })
      return workout.id
    }
    case 'MEAL': {
      const p = mealPayload.parse(payload)
      const meal = await logMeal(userId, { ...p, client_idempotency_key: key })
      return meal.id
    }
    case 'WATER_LOG': {
      const p = waterPayload.parse(payload)
      const water = await logWater(userId, { ...p, client_idempotency_key: key })
      return water.id
    }
  }
}

export async function drainOutboxHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)

    const parsed = batchSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_FAILED', 'The request failed validation.', {
        details: parsed.error.issues.slice(0, 20).map((i) => ({
          field: i.path.join('.'),
          issue: i.message,
        })),
      })
    }

    const results: SyncResult[] = []

    for (const event of parsed.data.events) {
      const key = event.client_idempotency_key.toLowerCase()
      const { row, replay } = await recordEvent(userId, key, event.entity_type, event.payload)

      // Seen before: return the stored outcome, never reprocess (FR-SYS-03).
      if (replay) {
        results.push({
          client_idempotency_key: key,
          status: row.status === 'FAILED' ? 'FAILED' : 'PROCESSED',
          replay: true,
          entity_id: row.result_entity_id,
          error_code: row.error_code,
        })
        continue
      }

      try {
        const entityId = await applyEvent(userId, key, event.entity_type, event.payload)
        await markProcessed(row.id, entityId)
        const scope = ENGAGEMENT_SCOPE[event.entity_type]
        const localDate = (event.payload as { local_date_str?: string }).local_date_str
        if (scope && localDate) await recordDailyLogSafe(userId, scope, localDate)
        results.push({
          client_idempotency_key: key,
          status: 'PROCESSED',
          replay: false,
          entity_id: entityId,
          error_code: null,
        })
      } catch (err) {
        // The event may have reached the destination table through the online
        // path already (same key) — that is a successful replay, not a failure.
        if (isUniqueViolation(err)) {
          const entityId = await findEntityIdByKey(DESTINATION_TABLE[event.entity_type], userId, key)
          await markProcessed(row.id, entityId)
          results.push({
            client_idempotency_key: key,
            status: 'PROCESSED',
            replay: true,
            entity_id: entityId,
            error_code: null,
          })
          continue
        }

        // TERMINAL classification (FR-SYS-05): bad payloads and missing
        // parents will never succeed on retry, so the stored FAILED outcome is
        // what every future replay of this key returns.
        const isValidation = err instanceof z.ZodError
        const isMissingParent =
          typeof err === 'object' && err !== null && '__notFound' in (err as object)
        const code = isValidation
          ? 'VALIDATION_FAILED'
          : isMissingParent
            ? 'PARENT_NOT_FOUND'
            : 'INTERNAL_ERROR'
        const detail = err instanceof Error ? err.message : String(err)
        await markFailed(row.id, code, detail)
        logger.warn({ key, entity_type: event.entity_type, code }, 'sync event failed')
        results.push({
          client_idempotency_key: key,
          status: 'FAILED',
          replay: false,
          entity_id: null,
          error_code: code,
        })
      }
    }

    res.status(200).json({ results })
  } catch (err) {
    next(err)
  }
}
