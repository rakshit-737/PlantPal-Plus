/**
 * Black-box verification of FR-PLT-08 / BR-PLT-04..08: every multiplier in the
 * specification tables, the six normative worked examples (BR-PLT-08 clause 5),
 * rounding, clamping and the absolute floor.
 *
 * Expected values are transcribed from 01_requirements/modules/plant-care.md.
 * Test IDs: TC-PLT-011 ..
 */
import { describe, expect, it } from 'vitest'

import {
  CLIMATE_FACTOR,
  computeWateringInterval,
  drainageFactor,
  LIGHT_FACTOR,
  PLACEMENT_FACTOR,
  POT_MATERIAL_FACTOR,
  potDiameterFactor,
  SOIL_FACTOR,
  type WateringIntervalInput,
} from '../index.js'

describe('BR-PLT-05 light factor table', () => {
  it.each([
    ['LOW', 1.25],
    ['MEDIUM', 1.1],
    ['BRIGHT_INDIRECT', 1.0],
    ['DIRECT_SUN', 0.85],
  ] as const)('TC-PLT-011 %s = %f', (k, v) => expect(LIGHT_FACTOR[k]).toBe(v))
})

describe('BR-PLT-06 clause 1 pot material table', () => {
  it.each([
    ['FABRIC', 0.75],
    ['TERRACOTTA', 0.8],
    ['CONCRETE', 0.9],
    ['CERAMIC_GLAZED', 1.0],
    ['OTHER', 1.0],
    ['METAL', 1.05],
    ['PLASTIC', 1.1],
  ] as const)('TC-PLT-012 %s = %f', (k, v) => expect(POT_MATERIAL_FACTOR[k]).toBe(v))
})

describe('BR-PLT-06 clause 2 pot diameter bands and their edges', () => {
  it.each([
    [0.1, 0.8],
    [9.9, 0.8],
    [10.0, 0.9],
    [14.9, 0.9],
    [15.0, 1.0],
    [19.9, 1.0],
    [20.0, 1.15],
    [29.9, 1.15],
    [30.0, 1.3],
    [39.9, 1.3],
    [40.0, 1.45],
    [500, 1.45],
  ])('TC-PLT-013 %f cm -> %f', (cm, f) => expect(potDiameterFactor(cm)).toBe(f))

  it('TC-PLT-014 null or undefined diameter is neutral (1.00)', () => {
    expect(potDiameterFactor(null)).toBe(1)
    expect(potDiameterFactor(undefined)).toBe(1)
  })

  it.each([0, -1, -0.1, NaN, Infinity])('TC-PLT-015 rejects the invalid diameter %f', (cm) => {
    expect(() => potDiameterFactor(cm)).toThrow(RangeError)
  })
})

describe('BR-PLT-06 clause 3 drainage', () => {
  it('TC-PLT-016 true -> 1.00, null -> 1.00, undefined -> 1.00, false -> 1.15', () => {
    expect(drainageFactor(true)).toBe(1)
    expect(drainageFactor(null)).toBe(1)
    expect(drainageFactor(undefined)).toBe(1)
    expect(drainageFactor(false)).toBe(1.15)
  })
})

describe('BR-PLT-07 environment factor tables', () => {
  it.each([
    ['INDOOR', 1.0],
    ['OUTDOOR', 0.85],
  ] as const)('TC-PLT-017 placement %s = %f', (k, v) => expect(PLACEMENT_FACTOR[k]).toBe(v))

  it.each([
    ['ORCHID_BARK', 0.75],
    ['CACTUS_SUCCULENT', 0.85],
    ['GARDEN_SOIL', 0.95],
    ['STANDARD_POTTING', 1.0],
    ['OTHER', 1.0],
    ['PEAT_BASED', 1.1],
    ['COCO_COIR', 1.1],
    ['SEMI_HYDRO_LECA', 1.3],
  ] as const)('TC-PLT-018 soil %s = %f', (k, v) => expect(SOIL_FACTOR[k]).toBe(v))

  it.each([
    ['HEATED_DRY_WINTER', 0.85],
    ['AIR_CONDITIONED', 0.9],
    ['NONE', 1.0],
    ['HUMID_ROOM', 1.2],
  ] as const)('TC-PLT-019 climate %s = %f', (k, v) => expect(CLIMATE_FACTOR[k]).toBe(v))
})

describe('BR-PLT-08 clause 5: the six normative worked examples', () => {
  const cases: Array<{
    id: string
    name: string
    input: WateringIntervalInput
    raw: number
    days: number
    clamped: 'MIN' | 'MAX' | null
  }> = [
    {
      id: 'E1',
      name: 'typical (Monstera)',
      input: {
        baseIntervalDays: 7, minIntervalDays: 4, maxIntervalDays: 14,
        season: 'SUMMER', lightExposure: 'MEDIUM', placement: 'INDOOR',
        potMaterial: 'TERRACOTTA', potDiameterCm: 17.0, hasDrainage: true,
        soilType: 'STANDARD_POTTING', indoorClimate: 'NONE',
      },
      raw: 4.928, days: 5, clamped: null,
    },
    {
      id: 'E2',
      name: 'stacked lengthening (Snake Plant)',
      input: {
        baseIntervalDays: 21, minIntervalDays: 10, maxIntervalDays: 45,
        season: 'WINTER', lightExposure: 'LOW', placement: 'INDOOR',
        potMaterial: 'PLASTIC', potDiameterCm: 24.0, hasDrainage: false,
        soilType: 'CACTUS_SUCCULENT', indoorClimate: 'HEATED_DRY_WINTER',
      },
      raw: 38.6263, days: 39, clamped: null,
    },
    {
      id: 'E3',
      name: 'clamp at MAX (Golden Barrel Cactus)',
      input: {
        baseIntervalDays: 28, minIntervalDays: 7, maxIntervalDays: 60,
        season: 'WINTER', lightExposure: 'DIRECT_SUN', placement: 'INDOOR',
        potMaterial: 'PLASTIC', potDiameterCm: 32.0, hasDrainage: false,
        soilType: 'SEMI_HYDRO_LECA', indoorClimate: 'NONE',
      },
      raw: 71.2332, days: 60, clamped: 'MAX',
    },
    {
      id: 'E4',
      name: 'clamp at MIN (Boston Fern)',
      input: {
        baseIntervalDays: 3, minIntervalDays: 2, maxIntervalDays: 7,
        season: 'SUMMER', lightExposure: 'DIRECT_SUN', placement: 'OUTDOOR',
        potMaterial: 'TERRACOTTA', potDiameterCm: 9.0, hasDrainage: true,
        soilType: 'GARDEN_SOIL', indoorClimate: 'AIR_CONDITIONED', // forced to 1.00 outdoors
      },
      raw: 1.0543, days: 2, clamped: 'MIN',
    },
    {
      id: 'E5',
      name: 'equatorial (Heartleaf Philodendron)',
      input: {
        baseIntervalDays: 7, minIntervalDays: 3, maxIntervalDays: 14,
        season: 'YEAR_ROUND', lightExposure: 'BRIGHT_INDIRECT', placement: 'INDOOR',
        potMaterial: 'CERAMIC_GLAZED', potDiameterCm: 15.0, hasDrainage: true,
        soilType: 'STANDARD_POTTING', indoorClimate: 'NONE',
      },
      raw: 7.0, days: 7, clamped: null,
    },
    {
      id: 'E6',
      name: 'rounding boundary (Peace Lily)',
      input: {
        baseIntervalDays: 5, minIntervalDays: 3, maxIntervalDays: 10,
        season: 'SPRING', lightExposure: 'BRIGHT_INDIRECT', placement: 'INDOOR',
        potMaterial: 'CERAMIC_GLAZED', potDiameterCm: 20.0, hasDrainage: true,
        soilType: 'STANDARD_POTTING', indoorClimate: 'NONE',
      },
      raw: 5.4625, days: 5, clamped: null,
    },
  ]

  it.each(cases)('TC-PLT-020 $id $name -> $days days (clamped: $clamped)', (c) => {
    const r = computeWateringInterval(c.input)
    expect(r.rawInterval).toBeCloseTo(c.raw, 4)
    expect(r.effectiveIntervalDays).toBe(c.days)
    expect(r.clamped).toBe(c.clamped)
  })

  it('TC-PLT-021 E4: the indoor climate is forced to 1.00 outdoors, whatever is stored', () => {
    const r = computeWateringInterval(cases[3]!.input)
    expect(r.fClimate).toBe(1)
    expect(r.fEnv).toBeCloseTo(0.8075, 10)
  })

  it('TC-PLT-022 E2: sub-factors multiply to the documented products', () => {
    const r = computeWateringInterval(cases[1]!.input)
    expect(r.fPot).toBeCloseTo(1.45475, 5)
    expect(r.fEnv).toBeCloseTo(0.7225, 4)
  })
})

describe('BR-PLT-08 rounding, clamping and floor', () => {
  const base: WateringIntervalInput = {
    baseIntervalDays: 10, minIntervalDays: 1, maxIntervalDays: 100,
    season: 'YEAR_ROUND', lightExposure: 'BRIGHT_INDIRECT', placement: 'INDOOR',
  }

  it('TC-PLT-023 with every optional input absent, the result is the unmodified base (all neutral)', () => {
    const r = computeWateringInterval(base)
    expect(r.rawInterval).toBe(10)
    expect(r.effectiveIntervalDays).toBe(10)
    expect(r.clamped).toBeNull()
  })

  it('TC-PLT-024 rounds half up: raw 4.5 -> 5 and raw 4.4999 -> 4', () => {
    expect(computeWateringInterval({ ...base, baseIntervalDays: 4.5 }).effectiveIntervalDays).toBe(5)
    expect(computeWateringInterval({ ...base, baseIntervalDays: 4.4999 }).effectiveIntervalDays).toBe(4)
  })

  it('TC-PLT-025 a result exactly on a species bound is not reported as clamped', () => {
    const atMin = computeWateringInterval({ ...base, baseIntervalDays: 5, minIntervalDays: 5, maxIntervalDays: 20 })
    const atMax = computeWateringInterval({ ...base, baseIntervalDays: 20, minIntervalDays: 5, maxIntervalDays: 20 })
    expect(atMin.clamped).toBeNull()
    expect(atMax.clamped).toBeNull()
  })

  it('TC-PLT-026 one day beyond a bound is clamped and reported', () => {
    expect(computeWateringInterval({ ...base, baseIntervalDays: 4, minIntervalDays: 5, maxIntervalDays: 20 })).toMatchObject({ effectiveIntervalDays: 5, clamped: 'MIN' })
    expect(computeWateringInterval({ ...base, baseIntervalDays: 21, minIntervalDays: 5, maxIntervalDays: 20 })).toMatchObject({ effectiveIntervalDays: 20, clamped: 'MAX' })
  })

  it('TC-PLT-027 the absolute floor of 1 day holds even when the species minimum is 0', () => {
    const r = computeWateringInterval({ ...base, baseIntervalDays: 0.4, minIntervalDays: 0, maxIntervalDays: 10 })
    expect(r.effectiveIntervalDays).toBe(1)
  })

  it.each([0, -1, NaN, Infinity])('TC-PLT-028 rejects the base interval %f', (bad) => {
    expect(() => computeWateringInterval({ ...base, baseIntervalDays: bad })).toThrow(RangeError)
  })

  it('TC-PLT-029 rejects inverted species bounds (min > max)', () => {
    expect(() => computeWateringInterval({ ...base, minIntervalDays: 10, maxIntervalDays: 5 })).toThrow(RangeError)
  })

  it('TC-PLT-030 the snapshot records every factor needed to explain the number (BR-PLT-08 clause 4)', () => {
    const r = computeWateringInterval(base)
    for (const key of ['fSeason', 'fLight', 'fPot', 'fMaterial', 'fDiameter', 'fDrainage', 'fEnv', 'fPlacement', 'fSoil', 'fClimate', 'rawInterval', 'effectiveIntervalDays', 'clamped'] as const) {
      expect(r).toHaveProperty(key)
    }
  })

  it('TC-PLT-031 is deterministic: identical inputs give bit-identical output (NFR-MAIN-04)', () => {
    const input: WateringIntervalInput = { ...base, season: 'SUMMER', lightExposure: 'MEDIUM', potMaterial: 'TERRACOTTA', potDiameterCm: 17 }
    expect(computeWateringInterval(input)).toEqual(computeWateringInterval({ ...input }))
  })

  it('TC-PLT-032 does not mutate its input', () => {
    const input: WateringIntervalInput = Object.freeze({ ...base })
    expect(() => computeWateringInterval(input)).not.toThrow()
  })
})
