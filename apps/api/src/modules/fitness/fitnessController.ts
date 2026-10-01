/**
 * Fitness controller — list/log workouts, weekly summary, exercises, personal records.
 *
 * Derived figures (per-set volume, Epley e1RM, MET energy) are computed here from
 * @plantpal/shared rather than trusted from the client, so BR-FIT-14/15 and
 * FR-FIT-05 hold identically regardless of what a client sends (NFR-MAIN-03).
 */

import type { NextFunction, Request, Response } from 'express'

import {
  workoutEnergyKcal,
  estimatedOneRepMax,
  isEligibleForOneRepMaxRecord,
  setVolumeKg,
  totalVolumeKg,
} from '@plantpal/shared'

import { badRequest, notFound } from '../../http/errors.ts'
import { authenticate } from '../auth/authController.ts'
import { getUserId } from '../../http/requestUser.ts'
import { recordDailyLogSafe } from '../engagement/engagementService.ts'
import {
  listWorkouts,
  getWorkout,
  createWorkout,
  getWeeklySummary,
  listExercises,
  getPersonalRecords,
  type CreateWorkoutData,
} from './fitnessRepo.ts'
import { activityMet, resolveBodyMassKg } from './energy.ts'

export { authenticate }

const userId = getUserId

export async function listWorkoutsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // NaN from a non-numeric query param must not reach the SQL layer.
    const rawLimit = Number(req.query.limit ?? 20)
    const rawOffset = Number(req.query.offset ?? 0)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.trunc(rawLimit)), 100) : 20
    const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.trunc(rawOffset)) : 0
    const rows = await listWorkouts(userId(req), limit, offset)
    res.json({ workouts: rows })
  } catch (err) {
    next(err)
  }
}

export async function getWorkoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await getWorkout(req.params.id!, userId(req))
    if (!row) throw notFound()
    res.json(row)
  } catch (err) {
    next(err)
  }
}

const VALID_ACTIVITY_TYPES = new Set([
  'WALK', 'RUN', 'CYCLE', 'SWIM', 'STRENGTH', 'YOGA', 'HIIT', 'SPORT', 'OTHER',
])

/** Mirrors workouts.perceived_intensity's CHECK constraint (003-fitness-schema.sql). */
const VALID_INTENSITIES = new Set(['LOW', 'MODERATE', 'VIGOROUS'])

interface RawSet {
  set_index?: number
  reps?: number
  weight_kg?: number
}

export async function logWorkout(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as Record<string, unknown>

    if (!body.activity_type || !VALID_ACTIVITY_TYPES.has(body.activity_type as string)) {
      throw badRequest('activity_type is required and must be a valid type.', [
        { field: 'activity_type', issue: 'required_or_invalid' },
      ])
    }

    const durationMins = body.duration_mins as number | undefined | null
    if (
      durationMins !== undefined &&
      durationMins !== null &&
      (typeof durationMins !== 'number' ||
        !Number.isInteger(durationMins) ||
        durationMins < 1 ||
        durationMins > 1440)
    ) {
      throw badRequest('duration_mins must be an integer between 1 and 1440.', [
        { field: 'duration_mins', issue: 'out_of_range' },
      ])
    }

    if (!body.local_date_str || !/^\d{4}-\d{2}-\d{2}$/.test(body.local_date_str as string)) {
      throw badRequest('local_date_str is required in YYYY-MM-DD format.', [
        { field: 'local_date_str', issue: 'required_or_invalid' },
      ])
    }

    // Validated here rather than left to the table's CHECK constraints, which
    // turn a client mistake into a 500 and an alarming log line instead of the
    // 422 the client can act on.
    if (
      body.perceived_intensity !== undefined &&
      body.perceived_intensity !== null &&
      !VALID_INTENSITIES.has(body.perceived_intensity as string)
    ) {
      throw badRequest('perceived_intensity must be LOW, MODERATE or VIGOROUS.', [
        { field: 'perceived_intensity', issue: 'invalid' },
      ])
    }
    if (
      body.steps !== undefined &&
      body.steps !== null &&
      (typeof body.steps !== 'number' || !Number.isInteger(body.steps) || body.steps < 0 || body.steps > 200_000)
    ) {
      throw badRequest('steps must be a whole number between 0 and 200000.', [
        { field: 'steps', issue: 'out_of_range' },
      ])
    }
    if (body.note !== undefined && body.note !== null && (typeof body.note !== 'string' || body.note.length > 500)) {
      throw badRequest('note must be text of at most 500 characters.', [
        { field: 'note', issue: 'too_long' },
      ])
    }

    // Derive per-set volume and Epley e1RM (BR-FIT-14, BR-FIT-15) server-side.
    const rawSets = Array.isArray(body.sets) ? (body.sets as RawSet[]) : []
    const sets: NonNullable<CreateWorkoutData['sets']> = rawSets.map((s, i) => {
      const reps = Number(s.reps ?? 0)
      const weightKg = Number(s.weight_kg ?? 0)
      return {
        set_index: Number(s.set_index ?? i + 1),
        reps,
        weight_kg: weightKg,
        volume_kg: setVolumeKg(reps, weightKg),
        estimated_1rm_kg: isEligibleForOneRepMaxRecord(weightKg, reps)
          ? estimatedOneRepMax(weightKg, reps)
          : undefined,
      }
    })

    // Total volume rounded once at the end (BR-FIT-14); 0.0 for set-less activities.
    const totalVolume = totalVolumeKg(
      sets.map((s) => ({ reps: s.reps, weightKg: s.weight_kg })),
    )

    // MET energy estimate (FR-FIT-05). Inputs the client sent are range-checked
    // here (the shared formula throws on an out-of-range value, which would
    // otherwise surface as a 500); inputs it left out are filled from the
    // catalogue and the BR-FIT-05 mass chain, so every timed workout gets an
    // estimate and the inputs used are frozen onto the row.
    const sentMet = body.met_value_at_log as number | undefined | null
    if (sentMet !== undefined && sentMet !== null && (typeof sentMet !== 'number' || !(sentMet >= 1 && sentMet <= 23))) {
      throw badRequest('met_value_at_log must be a number between 1 and 23.', [
        { field: 'met_value_at_log', issue: 'out_of_range' },
      ])
    }
    const sentMass = body.body_mass_at_log_kg as number | undefined | null
    if (sentMass !== undefined && sentMass !== null && (typeof sentMass !== 'number' || !(sentMass >= 20 && sentMass <= 635))) {
      throw badRequest('body_mass_at_log_kg must be a number between 20 and 635.', [
        { field: 'body_mass_at_log_kg', issue: 'out_of_range' },
      ])
    }
    const timed = typeof durationMins === 'number' && durationMins > 0
    const metValue =
      sentMet ?? (timed ? activityMet(body.activity_type as string, body.perceived_intensity as string | undefined) : undefined)
    const bodyMassKg = sentMass ?? (timed && metValue !== undefined ? await resolveBodyMassKg(userId(req)) : undefined)
    let caloriesBurned = body.calories_burned as number | undefined
    if (caloriesBurned === undefined && metValue !== undefined && bodyMassKg !== undefined && timed) {
      caloriesBurned = workoutEnergyKcal(metValue, bodyMassKg, durationMins)
    }

    const workout = await createWorkout(userId(req), {
      exercise_id: body.exercise_id as string | undefined,
      activity_type: body.activity_type as string,
      duration_mins: durationMins ?? undefined,
      perceived_intensity: body.perceived_intensity as string | undefined,
      met_value_at_log: metValue,
      body_mass_at_log_kg: bodyMassKg,
      calories_burned: caloriesBurned,
      total_volume_kg: totalVolume,
      steps: body.steps as number | undefined,
      note: body.note as string | undefined,
      local_date_str: body.local_date_str as string,
      client_idempotency_key:
        typeof body.client_idempotency_key === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3,4}-[0-9a-f]{3,4}-[0-9a-f]{12}$/i.test(
          body.client_idempotency_key,
        )
          ? body.client_idempotency_key
          : undefined,
      sets: sets.length > 0 ? sets : undefined,
    })

    // BR-GAM-03: a >= 10 min session or the step goal may complete the day.
    await recordDailyLogSafe(userId(req), 'FITNESS', body.local_date_str as string)

    res.status(201).json(workout)
  } catch (err) {
    next(err)
  }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const week = req.query.week as string | undefined
    if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
      throw badRequest('week query parameter is required in YYYY-MM-DD format.', [
        { field: 'week', issue: 'required_or_invalid' },
      ])
    }
    const summary = await getWeeklySummary(userId(req), week)
    res.json(summary)
  } catch (err) {
    next(err)
  }
}

export async function searchExercises(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query.q as string | undefined
    const rows = await listExercises(q)
    res.json({ exercises: rows })
  } catch (err) {
    next(err)
  }
}

export async function getPersonalRecordsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await getPersonalRecords(userId(req))
    res.json({ personal_records: rows })
  } catch (err) {
    next(err)
  }
}
