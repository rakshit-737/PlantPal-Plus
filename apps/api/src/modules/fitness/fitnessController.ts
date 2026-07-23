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

import { badRequest, notFound } from '../../http/errors.js'
import { authenticate } from '../auth/authController.js'
import {
  listWorkouts,
  getWorkout,
  createWorkout,
  getWeeklySummary,
  listExercises,
  getPersonalRecords,
  type CreateWorkoutData,
} from './fitnessRepo.js'

export { authenticate }

function userId(req: Request): string {
  return (req as unknown as Record<string, unknown>).userId as string
}

export async function listWorkoutsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20), 100)
    const offset = Number(req.query.offset ?? 0)
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

    // MET energy estimate (FR-FIT-05) when the frozen inputs are all present.
    const metValue = body.met_value_at_log as number | undefined
    const bodyMassKg = body.body_mass_at_log_kg as number | undefined
    let caloriesBurned = body.calories_burned as number | undefined
    if (
      caloriesBurned === undefined &&
      typeof metValue === 'number' &&
      typeof bodyMassKg === 'number' &&
      typeof durationMins === 'number' &&
      durationMins > 0
    ) {
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
      client_idempotency_key: body.client_idempotency_key as string | undefined,
      sets: sets.length > 0 ? sets : undefined,
    })

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
