import { describe, expect, it } from 'vitest'

import { Hemisphere, IndoorClimate, LightExposure, Placement, PotMaterial, Season, SoilType } from './enums.js'
import { seasonForLocalDate, seasonForMonth, type MonthNumber } from './season.js'
import { computeWateringInterval, potDiameterFactor, drainageFactor } from './watering.js'

/**
 * The canonical vector is taken directly from the factor snapshot published in
 * BR-PLT-08 clause 4, so a change in behaviour here is a change against the
 * requirement, not against a test the implementation invented for itself.
 */
describe('computeWateringInterval — BR-PLT-08 canonical vector', () => {
  it('reproduces the documented snapshot: 7 x 0.80 x 1.10 x 0.80 x 1.00 = 4.928 -> 5 days', () => {
    const result = computeWateringInterval({
      baseIntervalDays: 7,
      minIntervalDays: 3,
      maxIntervalDays: 21,
      season: Season.SUMMER,
      lightExposure: LightExposure.MEDIUM,
      placement: Placement.INDOOR,
      potMaterial: PotMaterial.TERRACOTTA,
      potDiameterCm: 16,
      hasDrainage: true,
      soilType: SoilType.STANDARD_POTTING,
      indoorClimate: IndoorClimate.NONE,
    })

    expect(result.fSeason).toBe(0.8)
    expect(result.fLight).toBe(1.1)
    expect(result.fPot).toBeCloseTo(0.8, 10)
    expect(result.fEnv).toBe(1.0)
    expect(result.rawInterval).toBeCloseTo(4.928, 10)
    expect(result.effectiveIntervalDays).toBe(5)
    expect(result.clamped).toBeNull()
  })
})

describe('computeWateringInterval — direction of each factor', () => {
  const base = {
    baseIntervalDays: 10,
    minIntervalDays: 1,
    maxIntervalDays: 365,
    lightExposure: LightExposure.BRIGHT_INDIRECT,
    placement: Placement.INDOOR,
  } as const

  it('waters more often in summer than in winter', () => {
    const summer = computeWateringInterval({ ...base, season: Season.SUMMER })
    const winter = computeWateringInterval({ ...base, season: Season.WINTER })
    expect(summer.effectiveIntervalDays).toBeLessThan(winter.effectiveIntervalDays)
  })

  it('waters less often in low light than in direct sun', () => {
    const low = computeWateringInterval({ ...base, season: Season.SPRING, lightExposure: LightExposure.LOW })
    const sun = computeWateringInterval({ ...base, season: Season.SPRING, lightExposure: LightExposure.DIRECT_SUN })
    expect(low.effectiveIntervalDays).toBeGreaterThan(sun.effectiveIntervalDays)
  })

  it('forces the indoor climate factor to neutral outdoors, since a microclimate cannot apply there', () => {
    const outdoorHumid = computeWateringInterval({
      ...base,
      season: Season.SPRING,
      placement: Placement.OUTDOOR,
      indoorClimate: IndoorClimate.HUMID_ROOM,
    })
    expect(outdoorHumid.fClimate).toBe(1.0)
  })
})

describe('computeWateringInterval — clamping to species safe bounds', () => {
  it('clamps to MIN and reports it when stacked shortening factors go too low', () => {
    const result = computeWateringInterval({
      baseIntervalDays: 4,
      minIntervalDays: 3,
      maxIntervalDays: 30,
      season: Season.SUMMER,
      lightExposure: LightExposure.DIRECT_SUN,
      placement: Placement.OUTDOOR,
      potMaterial: PotMaterial.FABRIC,
      potDiameterCm: 8,
      soilType: SoilType.ORCHID_BARK,
    })
    expect(result.effectiveIntervalDays).toBe(3)
    expect(result.clamped).toBe('MIN')
  })

  it('clamps to MAX so a plant cannot be forgotten for months', () => {
    const result = computeWateringInterval({
      baseIntervalDays: 30,
      minIntervalDays: 7,
      maxIntervalDays: 45,
      season: Season.WINTER,
      lightExposure: LightExposure.LOW,
      placement: Placement.INDOOR,
      potMaterial: PotMaterial.PLASTIC,
      potDiameterCm: 45,
      hasDrainage: false,
      soilType: SoilType.SEMI_HYDRO_LECA,
      indoorClimate: IndoorClimate.HUMID_ROOM,
    })
    expect(result.effectiveIntervalDays).toBe(45)
    expect(result.clamped).toBe('MAX')
  })

  it('never returns an interval below the absolute floor of one day', () => {
    const result = computeWateringInterval({
      baseIntervalDays: 1,
      minIntervalDays: 0,
      maxIntervalDays: 2,
      season: Season.SUMMER,
      lightExposure: LightExposure.DIRECT_SUN,
      placement: Placement.OUTDOOR,
      potMaterial: PotMaterial.FABRIC,
      potDiameterCm: 5,
      soilType: SoilType.ORCHID_BARK,
    })
    expect(result.effectiveIntervalDays).toBeGreaterThanOrEqual(1)
  })
})

describe('pot factors', () => {
  it('applies the documented diameter bands', () => {
    expect(potDiameterFactor(9.9)).toBe(0.8)
    expect(potDiameterFactor(10)).toBe(0.9)
    expect(potDiameterFactor(15)).toBe(1.0)
    expect(potDiameterFactor(20)).toBe(1.15)
    expect(potDiameterFactor(30)).toBe(1.3)
    expect(potDiameterFactor(40)).toBe(1.45)
  })

  it('treats an unsupplied diameter as neutral rather than guessing', () => {
    expect(potDiameterFactor(null)).toBe(1.0)
    expect(potDiameterFactor(undefined)).toBe(1.0)
  })

  it('covers the 14.9-to-15.0 boundary the requirement states as separate bands', () => {
    expect(potDiameterFactor(14.95)).toBe(0.9)
  })

  it('lengthens the interval only when drainage is explicitly absent', () => {
    expect(drainageFactor(false)).toBe(1.15)
    expect(drainageFactor(true)).toBe(1.0)
    expect(drainageFactor(null)).toBe(1.0)
  })
})

describe('seasonForMonth — BR-PLT-03', () => {
  const northern: Record<number, Season> = {
    1: Season.WINTER, 2: Season.WINTER, 3: Season.SPRING, 4: Season.SPRING,
    5: Season.SPRING, 6: Season.SUMMER, 7: Season.SUMMER, 8: Season.SUMMER,
    9: Season.AUTUMN, 10: Season.AUTUMN, 11: Season.AUTUMN, 12: Season.WINTER,
  }
  const southern: Record<number, Season> = {
    1: Season.SUMMER, 2: Season.SUMMER, 3: Season.AUTUMN, 4: Season.AUTUMN,
    5: Season.AUTUMN, 6: Season.WINTER, 7: Season.WINTER, 8: Season.WINTER,
    9: Season.SPRING, 10: Season.SPRING, 11: Season.SPRING, 12: Season.SUMMER,
  }

  it('maps all twelve northern months', () => {
    for (let m = 1; m <= 12; m++) {
      expect(seasonForMonth(m as MonthNumber, Hemisphere.NORTHERN)).toBe(northern[m])
    }
  })

  it('maps all twelve southern months as the inverse', () => {
    for (let m = 1; m <= 12; m++) {
      expect(seasonForMonth(m as MonthNumber, Hemisphere.SOUTHERN)).toBe(southern[m])
    }
  })

  it('applies no seasonal adjustment at the equator', () => {
    for (let m = 1; m <= 12; m++) {
      expect(seasonForMonth(m as MonthNumber, Hemisphere.EQUATORIAL)).toBe(Season.YEAR_ROUND)
    }
  })

  it('reads the month from a local date string, never a UTC-shifted Date', () => {
    expect(seasonForLocalDate('2026-01-15', Hemisphere.NORTHERN)).toBe(Season.WINTER)
    expect(seasonForLocalDate('2026-01-15', Hemisphere.SOUTHERN)).toBe(Season.SUMMER)
  })

  it('rejects a malformed date rather than silently defaulting', () => {
    expect(() => seasonForLocalDate('15/01/2026', Hemisphere.NORTHERN)).toThrow(RangeError)
  })
})
