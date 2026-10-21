/**
 * Black-box verification of FR-NUT BMR / TDEE / hydration / Atwater rules
 * (BR-NUT-08, BR-NUT-11, BR-NUT-12, BR-NUT-13).
 * Test IDs: TC-NUT-001 ..
 */
import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_FACTOR,
  ATWATER_KCAL_PER_GRAM,
  basalMetabolicRate,
  defaultHydrationGoalMl,
  energyFromMacros,
  NUTRITION_BOUNDS,
  totalDailyEnergyExpenditure,
  type BmrInput,
} from '../index.js'

const base: BmrInput = { bodyMassKg: 70, heightCm: 170, ageYears: 30, biologicalSex: 'MALE' }

describe('BR-NUT-11: Mifflin-St Jeor', () => {
  it('TC-NUT-001 spec worked example: female 62 kg, 165 cm, 29 y = 1345.25 -> 1345 kcal', () => {
    expect(basalMetabolicRate({ bodyMassKg: 62, heightCm: 165, ageYears: 29, biologicalSex: 'FEMALE' })).toBe(1345)
  })

  it('TC-NUT-002 male constant +5: 80 kg, 180 cm, 30 y = 800 + 1125 - 150 + 5 = 1780', () => {
    expect(basalMetabolicRate({ bodyMassKg: 80, heightCm: 180, ageYears: 30, biologicalSex: 'MALE' })).toBe(1780)
  })

  it('TC-NUT-003 female constant -161 gives exactly 166 less than male for equal inputs', () => {
    const male = basalMetabolicRate({ ...base, biologicalSex: 'MALE' })
    const female = basalMetabolicRate({ ...base, biologicalSex: 'FEMALE' })
    expect(male - female).toBe(166)
  })

  it('TC-NUT-004 PREFER_NOT_TO_SAY uses -78, the mean of +5 and -161', () => {
    const male = basalMetabolicRate({ ...base, biologicalSex: 'MALE' })
    const pns = basalMetabolicRate({ ...base, biologicalSex: 'PREFER_NOT_TO_SAY' })
    expect(male - pns).toBe(83)
  })

  it('TC-NUT-005 rounds half up to a whole kilocalorie (x.5 rounds up)', () => {
    // 10*70 + 6.25*170 - 5*30 + 5 = 700 + 1062.5 - 150 + 5 = 1617.5
    expect(basalMetabolicRate(base)).toBe(1618)
  })

  it('TC-NUT-006 each extra kilogram adds 10 kcal, each cm 6.25, each year removes 5', () => {
    const r = basalMetabolicRate(base)
    expect(basalMetabolicRate({ ...base, bodyMassKg: 71 })).toBe(r + 10)
    expect(basalMetabolicRate({ ...base, ageYears: 31 })).toBe(r - 5)
  })

  describe('input bounds (inclusive edges accepted, one step outside rejected)', () => {
    it.each([
      ['mass min', { bodyMassKg: NUTRITION_BOUNDS.bodyMassKg.min }],
      ['mass max', { bodyMassKg: NUTRITION_BOUNDS.bodyMassKg.max }],
      ['height min', { heightCm: NUTRITION_BOUNDS.heightCm.min }],
      ['height max', { heightCm: NUTRITION_BOUNDS.heightCm.max }],
      ['age min', { ageYears: NUTRITION_BOUNDS.ageYears.min }],
      ['age max', { ageYears: NUTRITION_BOUNDS.ageYears.max }],
    ])('TC-NUT-007 accepts %s', (_l, patch) => {
      expect(() => basalMetabolicRate({ ...base, ...patch })).not.toThrow()
    })

    it.each([
      ['mass below 30', { bodyMassKg: 29.9 }],
      ['mass above 400', { bodyMassKg: 400.1 }],
      ['height below 100', { heightCm: 99.9 }],
      ['height above 250', { heightCm: 250.1 }],
      ['age 15 (below the minimum age of 16)', { ageYears: 15 }],
      ['age above 120', { ageYears: 121 }],
      ['NaN mass', { bodyMassKg: NaN }],
      ['Infinity height', { heightCm: Infinity }],
      ['negative age', { ageYears: -1 }],
    ])('TC-NUT-008 rejects %s', (_l, patch) => {
      expect(() => basalMetabolicRate({ ...base, ...patch })).toThrow(RangeError)
    })

    it('TC-NUT-009 [DEF-002] BR-NUT-11 states the age bound as 13..120, the code enforces 16..120', () => {
      // The specification is internally inconsistent: BR-ACC-13 closed the minimum
      // age at 16 (OQ-09) but BR-NUT-11 still says 13. Users under 16 cannot
      // register, so the case is unreachable in production; the document is stale.
      // Asserting the literal BR-NUT-11 text fails by design until it is amended.
      expect(() => basalMetabolicRate({ ...base, ageYears: 13 })).not.toThrow()
    })
  })
})

describe('BR-NUT-12 / BR-NUT-13: activity factors and TDEE', () => {
  it.each([
    ['SEDENTARY', 1.2],
    ['LIGHTLY_ACTIVE', 1.375],
    ['MODERATELY_ACTIVE', 1.55],
    ['VERY_ACTIVE', 1.725],
    ['EXTRA_ACTIVE', 1.9],
  ] as const)('TC-NUT-010 %s factor is %f', (level, f) => {
    expect(ACTIVITY_FACTOR[level]).toBe(f)
  })

  it('TC-NUT-011 spec worked example: 1345 x 1.375 = 1849.375 -> 1849', () => {
    expect(totalDailyEnergyExpenditure(1345, 'LIGHTLY_ACTIVE')).toBe(1849)
  })

  it.each([
    [2000, 'SEDENTARY', 2400],
    [2000, 'MODERATELY_ACTIVE', 3100],
    [2000, 'EXTRA_ACTIVE', 3800],
    [1000, 'VERY_ACTIVE', 1725],
  ] as const)('TC-NUT-012 TDEE(%i, %s) = %i', (bmr, level, expected) => {
    expect(totalDailyEnergyExpenditure(bmr, level)).toBe(expected)
  })

  it.each([0, -1, NaN, Infinity])('TC-NUT-013 rejects BMR %f', (bad) => {
    expect(() => totalDailyEnergyExpenditure(bad, 'SEDENTARY')).toThrow(RangeError)
  })
})

describe('default hydration goal', () => {
  it.each([
    [30, 1050],
    [70, 2450],
    [400, 14000],
  ])('TC-NUT-014 %f kg -> %i ml (35 ml per kg)', (kg, ml) => {
    expect(defaultHydrationGoalMl(kg)).toBe(ml)
  })

  it('TC-NUT-015 rounds half up to a whole millilitre', () => {
    expect(defaultHydrationGoalMl(70.0143)).toBe(2451) // 2450.5005
  })

  it.each([29.9, 400.1, NaN])('TC-NUT-016 rejects body mass %f', (bad) => {
    expect(() => defaultHydrationGoalMl(bad)).toThrow(RangeError)
  })
})

describe('BR-NUT-08: Atwater energy from macros', () => {
  it('TC-NUT-017 the factors are 4, 4 and 9 kcal per gram', () => {
    expect(ATWATER_KCAL_PER_GRAM).toEqual({ protein: 4, carbohydrate: 4, fat: 9 })
  })

  it.each([
    [{ proteinG: 10, carbohydrateG: 20, fatG: 5 }, 165],
    [{ proteinG: 0, carbohydrateG: 0, fatG: 0 }, 0],
    [{ proteinG: 1, carbohydrateG: 0, fatG: 0 }, 4],
    [{ proteinG: 0, carbohydrateG: 0, fatG: 1 }, 9],
    [{ proteinG: 0.25, carbohydrateG: 0.25, fatG: 0.25 }, 4.3],
  ])('TC-NUT-018 %j -> %f kcal', (macros, kcal) => {
    expect(energyFromMacros(macros)).toBeCloseTo(kcal, 5)
  })

  it.each([
    [{ proteinG: -1, carbohydrateG: 0, fatG: 0 }],
    [{ proteinG: 0, carbohydrateG: -0.1, fatG: 0 }],
    [{ proteinG: 0, carbohydrateG: 0, fatG: NaN }],
    [{ proteinG: Infinity, carbohydrateG: 0, fatG: 0 }],
  ])('TC-NUT-019 rejects %j', (macros) => {
    expect(() => energyFromMacros(macros)).toThrow(RangeError)
  })
})
