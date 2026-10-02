/**
 * The smart watering algorithm — BR-PLT-04 through BR-PLT-08.
 *
 * This is the product's signature feature: the interval a plant actually needs,
 * derived from its species baseline adjusted for season, light, pot and
 * environment, then clamped to the species' safe bounds.
 *
 * Every multiplier below is quoted verbatim from the requirements. A factor
 * BELOW 1.00 shortens the interval (water more often); a factor ABOVE 1.00
 * lengthens it. Winter carries the largest deviation because winter
 * over-watering is the single most common houseplant killer.
 */

import {
  IndoorClimate,
  LightExposure,
  Placement,
  PotMaterial,
  Season,
  SoilType,
} from './enums.js'
import { clamp, roundHalfUp } from './rounding.js'

/* ---------------------------------------------------------- factor tables */

/** BR-PLT-04 */
export const SEASON_FACTOR: Readonly<Record<Season, number>> = Object.freeze({
  [Season.SPRING]: 0.95,
  [Season.SUMMER]: 0.8,
  [Season.AUTUMN]: 1.15,
  [Season.WINTER]: 1.4,
  [Season.YEAR_ROUND]: 1.0,
})

/** BR-PLT-05. BRIGHT_INDIRECT is the reference: seeded base intervals assume it. */
export const LIGHT_FACTOR: Readonly<Record<LightExposure, number>> = Object.freeze({
  [LightExposure.LOW]: 1.25,
  [LightExposure.MEDIUM]: 1.1,
  [LightExposure.BRIGHT_INDIRECT]: 1.0,
  [LightExposure.DIRECT_SUN]: 0.85,
})

/** BR-PLT-06 clause 1. CERAMIC_GLAZED is the reference material. */
export const POT_MATERIAL_FACTOR: Readonly<Record<PotMaterial, number>> = Object.freeze({
  [PotMaterial.FABRIC]: 0.75,
  [PotMaterial.TERRACOTTA]: 0.8,
  [PotMaterial.CONCRETE]: 0.9,
  [PotMaterial.CERAMIC_GLAZED]: 1.0,
  [PotMaterial.OTHER]: 1.0,
  [PotMaterial.METAL]: 1.05,
  [PotMaterial.PLASTIC]: 1.1,
})

/** BR-PLT-07 clause 2. STANDARD_POTTING is the reference soil. */
export const SOIL_FACTOR: Readonly<Record<SoilType, number>> = Object.freeze({
  [SoilType.ORCHID_BARK]: 0.75,
  [SoilType.CACTUS_SUCCULENT]: 0.85,
  [SoilType.GARDEN_SOIL]: 0.95,
  [SoilType.STANDARD_POTTING]: 1.0,
  [SoilType.OTHER]: 1.0,
  [SoilType.PEAT_BASED]: 1.1,
  [SoilType.COCO_COIR]: 1.1,
  [SoilType.SEMI_HYDRO_LECA]: 1.3,
})

/** BR-PLT-07 clause 1 */
export const PLACEMENT_FACTOR: Readonly<Record<Placement, number>> = Object.freeze({
  [Placement.INDOOR]: 1.0,
  [Placement.OUTDOOR]: 0.85,
})

/** BR-PLT-07 clause 3 */
export const CLIMATE_FACTOR: Readonly<Record<IndoorClimate, number>> = Object.freeze({
  [IndoorClimate.HEATED_DRY_WINTER]: 0.85,
  [IndoorClimate.AIR_CONDITIONED]: 0.9,
  [IndoorClimate.NONE]: 1.0,
  [IndoorClimate.HUMID_ROOM]: 1.2,
})

/**
 * BR-PLT-06 clause 2 — pot diameter.
 *
 * The requirement states bands as "10.0 to 14.9", "15.0 to 19.9" and so on.
 * Those are inclusive decimal bands with an apparent gap between 14.9 and 15.0;
 * they are implemented here as continuous half-open intervals so that a
 * real-world value such as 14.95 cm cannot fall through unhandled.
 */
export function potDiameterFactor(diameterCm: number | null | undefined): number {
  if (diameterCm === null || diameterCm === undefined) return 1.0
  if (!Number.isFinite(diameterCm) || diameterCm <= 0) {
    throw new RangeError(`potDiameterFactor expected a positive diameter, received ${diameterCm}`)
  }
  if (diameterCm < 10) return 0.8
  if (diameterCm < 15) return 0.9
  if (diameterCm < 20) return 1.0
  if (diameterCm < 30) return 1.15
  if (diameterCm < 40) return 1.3
  return 1.45
}

/** BR-PLT-06 clause 3 — a pot with no drainage hole retains water, so the interval lengthens. */
export function drainageFactor(hasDrainage: boolean | null | undefined): number {
  return hasDrainage === false ? 1.15 : 1.0
}

/* ------------------------------------------------------------------ input */

export interface WateringIntervalInput {
  /** Species baseline, stated for BRIGHT_INDIRECT light in a standard pot. */
  baseIntervalDays: number
  /** Species safe lower bound; protects against stacked shortening factors. */
  minIntervalDays: number
  /** Species safe upper bound; protects a plant from being forgotten for months. */
  maxIntervalDays: number
  season: Season
  lightExposure: LightExposure
  placement: Placement
  potMaterial?: PotMaterial | null
  potDiameterCm?: number | null
  hasDrainage?: boolean | null
  soilType?: SoilType | null
  indoorClimate?: IndoorClimate | null
}

/** The persisted explanation of a computation — BR-PLT-08 clause 4. */
export interface WateringFactorSnapshot {
  baseIntervalDays: number
  season: Season
  fSeason: number
  lightExposure: LightExposure
  fLight: number
  fPot: number
  fMaterial: number
  fDiameter: number
  fDrainage: number
  fEnv: number
  fPlacement: number
  fSoil: number
  fClimate: number
  rawInterval: number
  effectiveIntervalDays: number
  clamped: 'MIN' | 'MAX' | null
}

/**
 * Compute the effective watering interval in whole days.
 *
 * BR-PLT-08 clause 2 requires the multiplication to happen in exactly this
 * left-to-right order at full double precision, rounded once at the very end, so
 * that the mobile, web and server consumers of this function agree bit for bit.
 * Do not "simplify" this by rounding intermediates.
 *
 * The snapshot is returned alongside the number so the interface can explain the
 * result without recomputing it, and so adherence reporting can later use the
 * interval that was actually in force.
 */
export function computeWateringInterval(input: WateringIntervalInput): WateringFactorSnapshot {
  const {
    baseIntervalDays,
    minIntervalDays,
    maxIntervalDays,
    season,
    lightExposure,
    placement,
  } = input

  if (!Number.isFinite(baseIntervalDays) || baseIntervalDays <= 0) {
    throw new RangeError(`baseIntervalDays must be positive, received ${baseIntervalDays}`)
  }
  if (minIntervalDays > maxIntervalDays) {
    throw new RangeError(
      `species bounds are inverted: min ${minIntervalDays} exceeds max ${maxIntervalDays}`,
    )
  }

  const fSeason = SEASON_FACTOR[season]
  const fLight = LIGHT_FACTOR[lightExposure]

  const fMaterial = input.potMaterial ? POT_MATERIAL_FACTOR[input.potMaterial] : 1.0
  const fDiameter = potDiameterFactor(input.potDiameterCm)
  const fDrainage = drainageFactor(input.hasDrainage)
  const fPot = fMaterial * fDiameter * fDrainage

  const fPlacement = PLACEMENT_FACTOR[placement]
  const fSoil = input.soilType ? SOIL_FACTOR[input.soilType] : 1.0
  // An indoor microclimate cannot apply outdoors, so it is forced neutral there
  // regardless of the stored value (BR-PLT-07 clause 3).
  const fClimate =
    placement === Placement.OUTDOOR
      ? 1.0
      : input.indoorClimate
        ? CLIMATE_FACTOR[input.indoorClimate]
        : 1.0
  const fEnv = fPlacement * fSoil * fClimate

  const rawInterval = baseIntervalDays * fSeason * fLight * fPot * fEnv
  const rounded = roundHalfUp(rawInterval)
  const clampedValue = clamp(rounded, minIntervalDays, maxIntervalDays)
  const effectiveIntervalDays = Math.max(clampedValue, 1)

  let clamped: 'MIN' | 'MAX' | null = null
  if (rounded < minIntervalDays) clamped = 'MIN'
  else if (rounded > maxIntervalDays) clamped = 'MAX'

  return {
    baseIntervalDays,
    season,
    fSeason,
    lightExposure,
    fLight,
    fPot,
    fMaterial,
    fDiameter,
    fDrainage,
    fEnv,
    fPlacement,
    fSoil,
    fClimate,
    rawInterval,
    effectiveIntervalDays,
    clamped,
  }
}
