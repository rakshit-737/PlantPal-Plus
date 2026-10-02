/**
 * Write-through logging: try the network first, fall back to the outbox.
 *
 * Every log action in the app goes through one of the four functions below
 * instead of calling the endpoint directly, and they all follow the same rule:
 *
 *   - the online POST carries the idempotency key
 *   - a transport failure (ApiError.status === 0 — no response at all) queues
 *     the SAME key and reports success to the user, because the write is not
 *     lost, it is deferred
 *   - anything the server actually answered — a 4xx validation error, a 404,
 *     a 5xx — throws. Queueing a rejected payload would just replay a rejection
 *     forever while telling the user it was saved.
 *
 * The requests are issued with apiRequest rather than the wrappers in
 * src/api/endpoints.ts because those wrappers do not carry
 * client_idempotency_key. Paths and bodies are otherwise identical; the extra
 * field is optional on all four endpoints (plantsController.logCare,
 * fitnessController.create, nutritionController.logMealHandler /
 * logWaterHandler) and is what lets the online row and a later replay collapse
 * onto one database row.
 */

import { ApiError, apiRequest } from '../api/client'
import type { Meal, Workout } from '../api/endpoints'
import { createOutboxItem, drainOutbox, enqueueOutboxItem, isOfflineError } from './outbox'
import type { OutboxEntityType } from './types'

/** What the user is told when a write lands in the outbox instead of the API. */
export const QUEUED_MESSAGE = "Saved on this device. It will sync when you're back online."

export type WriteResult<T> =
  /** The server has it. */
  | { queued: false; data: T }
  /** The device has it; the drain will deliver it. */
  | { queued: true; message: string }

async function writeThrough<T>(
  entityType: OutboxEntityType,
  label: string,
  payload: Record<string, unknown>,
  send: (idempotencyKey: string) => Promise<T>,
): Promise<WriteResult<T>> {
  // Minted first, used by both paths: this single value is what makes a
  // partially-succeeded write safe to replay.
  const item = createOutboxItem(entityType, payload, label)
  try {
    const data = await send(item.client_idempotency_key)
    // A round trip just proved there is a network. If anything is waiting,
    // this is the cheapest moment to send it.
    void drainOutbox()
    return { queued: false, data }
  } catch (err) {
    if (!isOfflineError(err)) throw err
    await enqueueOutboxItem(item)
    return { queued: true, message: QUEUED_MESSAGE }
  }
}

/**
 * The message to show for a write that failed for a reason other than being
 * offline. The API's error envelope already carries a sentence written for
 * users, so prefer it and keep the caller's fallback for the rest.
 */
export function describeWriteError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.message) {
    const detail = err.details[0]
    return detail ? `${err.message} (${detail.field}: ${detail.issue})` : err.message
  }
  return fallback
}

/* ------------------------------------------------------------ plant care */

export interface CareInput {
  action_type: string
  note?: string
  local_date_str: string
}

export function logCareWriteThrough(
  plantId: string,
  input: CareInput,
  label = 'A care entry',
): Promise<WriteResult<{ status: string }>> {
  const payload: Record<string, unknown> = {
    plant_id: plantId,
    action_type: input.action_type,
    ...(input.note ? { note: input.note } : {}),
    local_date_str: input.local_date_str,
  }
  return writeThrough('PLANT_CARE_EVENT', label, payload, (key) =>
    apiRequest<{ status: string }>(`/v1/plants/${plantId}/care`, {
      method: 'POST',
      body: {
        action_type: input.action_type,
        ...(input.note ? { note: input.note } : {}),
        local_date_str: input.local_date_str,
        client_idempotency_key: key,
      },
    }),
  )
}

/* --------------------------------------------------------------- fitness */

export interface WorkoutInput {
  activity_type: string
  duration_mins?: number
  steps?: number
  note?: string
  local_date_str: string
}

export function logWorkoutWriteThrough(
  input: WorkoutInput,
  label = 'A workout',
): Promise<WriteResult<Workout>> {
  const payload: Record<string, unknown> = {
    activity_type: input.activity_type,
    ...(input.duration_mins !== undefined ? { duration_mins: input.duration_mins } : {}),
    ...(input.steps !== undefined ? { steps: input.steps } : {}),
    ...(input.note ? { note: input.note } : {}),
    local_date_str: input.local_date_str,
  }
  return writeThrough('WORKOUT', label, payload, (key) =>
    apiRequest<Workout>('/v1/fitness', {
      method: 'POST',
      body: { ...payload, client_idempotency_key: key },
    }),
  )
}

/* ------------------------------------------------------------- nutrition */

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

export interface MealInput {
  meal_type: string
  note?: string
  local_date_str: string
  items: MealItemInput[]
}

export function logMealWriteThrough(
  input: MealInput,
  label = 'A meal',
): Promise<WriteResult<Meal>> {
  const payload: Record<string, unknown> = {
    meal_type: input.meal_type,
    ...(input.note ? { note: input.note } : {}),
    local_date_str: input.local_date_str,
    // Rebuilt key by key: the queued payload is validated by a strict schema
    // server-side, so an unexpected field would fail the whole event.
    items: input.items.map((i) => ({
      ...(i.food_id ? { food_id: i.food_id } : {}),
      food_name_at_log: i.food_name_at_log,
      quantity: i.quantity,
      serving_unit: i.serving_unit,
      grams: i.grams,
      kcal: i.kcal,
      protein_g: i.protein_g,
      carbs_g: i.carbs_g,
      fat_g: i.fat_g,
    })),
  }
  return writeThrough('MEAL', label, payload, (key) =>
    apiRequest<Meal>('/v1/nutrition/meals', {
      method: 'POST',
      body: { ...payload, client_idempotency_key: key },
    }),
  )
}

export function logWaterWriteThrough(
  amountMl: number,
  localDateStr: string,
  label = 'A water entry',
): Promise<WriteResult<{ id: string; amount_ml: number }>> {
  const payload: Record<string, unknown> = {
    amount_ml: amountMl,
    local_date_str: localDateStr,
  }
  return writeThrough('WATER_LOG', label, payload, (key) =>
    apiRequest<{ id: string; amount_ml: number }>('/v1/nutrition/water', {
      method: 'POST',
      body: { ...payload, client_idempotency_key: key },
    }),
  )
}
