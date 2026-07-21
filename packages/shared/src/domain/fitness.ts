/**
 * Fitness mathematics — BR-FIT-14 (volume), BR-FIT-15 (estimated one-repetition
 * maximum) and the MET-based energy estimate of FR-FIT-05.
 *
 * Energy figures are estimates carrying a stated error band and are never
 * presented as medically accurate (decision D-07).
 */

import { roundTo } from './rounding.js'

/* ------------------------------------------------------ energy expenditure */

/**
 * Estimated energy expenditure for a workout.
 *
 *   kcal = MET x body_mass_kg x duration_minutes / 60
 *
 * Dimensionally this is MET x kg x hours, which is the standard compendium
 * form. The MET value used is frozen onto the workout row at save time
 * (FR-FIT-05), so revising the catalogue later never rewrites historical
 * estimates.
 */
export function workoutEnergyKcal(
  metValue: number,
  bodyMassKg: number,
  durationMinutes: number,
): number {
  if (!Number.isFinite(metValue) || metValue < 1 || metValue > 23) {
    throw new RangeError(`metValue must be between 1.0 and 23.0, received ${metValue}`)
  }
  if (!Number.isFinite(bodyMassKg) || bodyMassKg <= 0) {
    throw new RangeError(`bodyMassKg must be positive, received ${bodyMassKg}`)
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new RangeError(`durationMinutes must be positive, received ${durationMinutes}`)
  }
  return roundTo((metValue * bodyMassKg * durationMinutes) / 60, 1)
}

/* ------------------------------------------------ one-repetition maximum */

/** BR-FIT-15 — the repetition range over which an Epley estimate is treated as valid. */
export const E1RM_VALID_REP_RANGE = Object.freeze({ min: 1, max: 12 })

/**
 * BR-FIT-15 — estimated one-repetition maximum, Epley.
 *
 *   reps > 1  ->  e1rm = weight x (1 + reps / 30)
 *   reps = 1  ->  e1rm = weight exactly
 *
 * The single-repetition special case is not cosmetic. Unmodified Epley returns
 * weight x (1 + 1/30) at one repetition, inflating a true 1RM by 3.3 percent —
 * so a lifter's actual max would be recorded as a number they never lifted.
 */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    throw new RangeError(`weightKg must be non-negative, received ${weightKg}`)
  }
  if (!Number.isInteger(reps) || reps < 1) {
    throw new RangeError(`reps must be a positive integer, received ${reps}`)
  }
  if (weightKg === 0) return 0
  const raw = reps === 1 ? weightKg : weightKg * (1 + reps / 30)
  return roundTo(raw, 1)
}

/**
 * Whether an Epley estimate from this set may set a BEST_ESTIMATED_1RM record.
 *
 * Sets above 12 repetitions still display an estimate, labelled low confidence,
 * but are excluded from record detection. Bodyweight sets (weight 0) are
 * excluded because the estimate carries no load information.
 */
export function isEligibleForOneRepMaxRecord(weightKg: number, reps: number): boolean {
  return (
    weightKg > 0 &&
    Number.isInteger(reps) &&
    reps >= E1RM_VALID_REP_RANGE.min &&
    reps <= E1RM_VALID_REP_RANGE.max
  )
}

/* ------------------------------------------------------------------ volume */

/** BR-FIT-14 — set volume in kilograms: reps x weight. */
export function setVolumeKg(reps: number, weightKg: number): number {
  if (!Number.isInteger(reps) || reps < 0) {
    throw new RangeError(`reps must be a non-negative integer, received ${reps}`)
  }
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    throw new RangeError(`weightKg must be non-negative, received ${weightKg}`)
  }
  return roundTo(reps * weightKg, 1)
}

/**
 * BR-FIT-14 — total volume across sets, rounded once at the end.
 *
 * Returns 0.0 rather than null for activity types that carry no sets, so no
 * chart series contains a gap.
 */
export function totalVolumeKg(sets: readonly { reps: number; weightKg: number }[]): number {
  const total = sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0)
  return roundTo(total, 1)
}
