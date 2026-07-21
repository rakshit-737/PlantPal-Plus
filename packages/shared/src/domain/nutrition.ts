/**
 * Nutrition mathematics — BR-NUT-08 (Atwater), BR-NUT-11 (basal metabolic
 * rate), BR-NUT-12 and BR-NUT-13 (total daily energy expenditure).
 *
 * Every figure produced here is an estimate for a wellness tracker. PlantPal+ is
 * not a medical device (decision D-07, NFR-LEGL-03): any screen presenting a BMR
 * or TDEE number must also show the not-medical-advice disclaimer, and no target
 * may be set below the clinical safety floor.
 */

import { ActivityLevel, BiologicalSex } from './enums.js'
import { roundHalfUp, roundTo } from './rounding.js'

/* ---------------------------------------------------------------- Atwater */

/**
 * BR-NUT-08 — Atwater factors, kilocalories per gram.
 *
 * Alcohol at 7 kcal/g is deliberately not modelled in v1.0: doing so correctly
 * would mean a fourth macro target, progress bar, rounding path and split
 * percentage across every nutrition surface, for a nutrient the seeded catalogue
 * does not carry.
 */
export const ATWATER_KCAL_PER_GRAM = Object.freeze({
  protein: 4,
  carbohydrate: 4,
  fat: 9,
})

export interface Macros {
  proteinG: number
  carbohydrateG: number
  fatG: number
}

/** Energy in kilocalories implied by a macronutrient triple. */
export function energyFromMacros(macros: Macros): number {
  const { proteinG, carbohydrateG, fatG } = macros
  for (const [name, value] of Object.entries({ proteinG, carbohydrateG, fatG })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`energyFromMacros expected a non-negative ${name}, received ${value}`)
    }
  }
  return roundTo(
    proteinG * ATWATER_KCAL_PER_GRAM.protein +
      carbohydrateG * ATWATER_KCAL_PER_GRAM.carbohydrate +
      fatG * ATWATER_KCAL_PER_GRAM.fat,
    1,
  )
}

/* ------------------------------------------------------ basal metabolic rate */

/**
 * BR-NUT-11 — the sex-dependent constant in Mifflin-St Jeor.
 *
 * PREFER_NOT_TO_SAY resolves to -78, the exact midpoint of the male +5 and
 * female -161 constants. That matters: the privacy-preserving option has to
 * degrade to a defensible estimate rather than silently defaulting to one sex.
 */
const SEX_CONSTANT: Readonly<Record<BiologicalSex, number>> = Object.freeze({
  [BiologicalSex.MALE]: 5,
  [BiologicalSex.FEMALE]: -161,
  [BiologicalSex.PREFER_NOT_TO_SAY]: -78,
})

/** BR-NUT-12 — activity factors applied to BMR to reach TDEE. */
export const ACTIVITY_FACTOR: Readonly<Record<ActivityLevel, number>> = Object.freeze({
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHTLY_ACTIVE]: 1.375,
  [ActivityLevel.MODERATELY_ACTIVE]: 1.55,
  [ActivityLevel.VERY_ACTIVE]: 1.725,
  [ActivityLevel.EXTRA_ACTIVE]: 1.9,
})

export interface BmrInput {
  bodyMassKg: number
  heightCm: number
  ageYears: number
  biologicalSex: BiologicalSex
}

/** Validation bounds from BR-NUT-12. The age floor follows the minimum age of 16 (BR-ACC-13, OQ-09 closed 2026-07-21). */
export const NUTRITION_BOUNDS = Object.freeze({
  bodyMassKg: { min: 30, max: 400 },
  heightCm: { min: 100, max: 250 },
  ageYears: { min: 16, max: 120 },
})

/**
 * BR-NUT-11 — Mifflin-St Jeor, written out in full.
 *
 *   BMR = (10 x mass_kg) + (6.25 x height_cm) - (5 x age_years) + sex_constant
 *
 * Chosen because it is the best-validated predictive equation for the general
 * adult population and needs only fields the accounts module already collects.
 */
export function basalMetabolicRate(input: BmrInput): number {
  const { bodyMassKg, heightCm, ageYears, biologicalSex } = input

  assertInRange('bodyMassKg', bodyMassKg, NUTRITION_BOUNDS.bodyMassKg)
  assertInRange('heightCm', heightCm, NUTRITION_BOUNDS.heightCm)
  assertInRange('ageYears', ageYears, NUTRITION_BOUNDS.ageYears)

  const raw = 10 * bodyMassKg + 6.25 * heightCm - 5 * ageYears + SEX_CONSTANT[biologicalSex]
  return roundHalfUp(raw)
}

/** BR-NUT-13 — TDEE = round(BMR x activity factor). */
export function totalDailyEnergyExpenditure(
  bmrKcal: number,
  activityLevel: ActivityLevel,
): number {
  if (!Number.isFinite(bmrKcal) || bmrKcal <= 0) {
    throw new RangeError(`totalDailyEnergyExpenditure expected a positive BMR, received ${bmrKcal}`)
  }
  return roundHalfUp(bmrKcal * ACTIVITY_FACTOR[activityLevel])
}

/* -------------------------------------------------------------- hydration */

/** Default daily hydration goal in millilitres: 35 ml per kilogram of body mass. */
export function defaultHydrationGoalMl(bodyMassKg: number): number {
  assertInRange('bodyMassKg', bodyMassKg, NUTRITION_BOUNDS.bodyMassKg)
  return roundHalfUp(bodyMassKg * 35)
}

/* ---------------------------------------------------------------- helpers */

function assertInRange(name: string, value: number, range: { min: number; max: number }): void {
  if (!Number.isFinite(value) || value < range.min || value > range.max) {
    throw new RangeError(
      `${name} must be between ${range.min} and ${range.max}, received ${value}`,
    )
  }
}
