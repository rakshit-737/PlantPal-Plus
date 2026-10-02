import { describe, expect, it } from 'vitest'

import { ActivityLevel, BiologicalSex } from './enums.js'
import {
  ACTIVITY_FACTOR,
  ATWATER_KCAL_PER_GRAM,
  basalMetabolicRate,
  defaultHydrationGoalMl,
  energyFromMacros,
  totalDailyEnergyExpenditure,
} from './nutrition.js'

describe('Atwater energy — BR-NUT-08', () => {
  it('uses 4, 4 and 9 kcal per gram', () => {
    expect(ATWATER_KCAL_PER_GRAM).toEqual({ protein: 4, carbohydrate: 4, fat: 9 })
  })

  it('computes energy from a macronutrient triple', () => {
    // 30g protein (120) + 40g carbohydrate (160) + 10g fat (90) = 370 kcal
    expect(energyFromMacros({ proteinG: 30, carbohydrateG: 40, fatG: 10 })).toBe(370)
  })

  it('returns zero for an empty entry rather than throwing', () => {
    expect(energyFromMacros({ proteinG: 0, carbohydrateG: 0, fatG: 0 })).toBe(0)
  })

  it('rejects negative macros, which would silently reduce a daily total', () => {
    expect(() => energyFromMacros({ proteinG: -1, carbohydrateG: 0, fatG: 0 })).toThrow(RangeError)
  })
})

describe('basalMetabolicRate — BR-NUT-11 Mifflin-St Jeor', () => {
  const subject = { bodyMassKg: 80, heightCm: 180, ageYears: 30 }

  it('applies the male constant of +5', () => {
    // 10(80) + 6.25(180) - 5(30) + 5 = 800 + 1125 - 150 + 5
    expect(basalMetabolicRate({ ...subject, biologicalSex: BiologicalSex.MALE })).toBe(1780)
  })

  it('applies the female constant of -161', () => {
    expect(basalMetabolicRate({ ...subject, biologicalSex: BiologicalSex.FEMALE })).toBe(1614)
  })

  it('resolves PREFER_NOT_TO_SAY to the exact midpoint of the two, not to a default sex', () => {
    const male = basalMetabolicRate({ ...subject, biologicalSex: BiologicalSex.MALE })
    const female = basalMetabolicRate({ ...subject, biologicalSex: BiologicalSex.FEMALE })
    const undisclosed = basalMetabolicRate({
      ...subject,
      biologicalSex: BiologicalSex.PREFER_NOT_TO_SAY,
    })

    expect(undisclosed).toBe(1697)
    expect(undisclosed).toBe((male + female) / 2)
    expect(undisclosed).not.toBe(male)
    expect(undisclosed).not.toBe(female)
  })

  it('rejects inputs outside the documented validation bounds', () => {
    expect(() => basalMetabolicRate({ ...subject, bodyMassKg: 29, biologicalSex: BiologicalSex.MALE })).toThrow(RangeError)
    expect(() => basalMetabolicRate({ ...subject, heightCm: 99, biologicalSex: BiologicalSex.MALE })).toThrow(RangeError)
  })

  it('rejects an age below the minimum age of 16 (BR-ACC-13, OQ-09 closed at 16)', () => {
    expect(() => basalMetabolicRate({ ...subject, ageYears: 15, biologicalSex: BiologicalSex.MALE })).toThrow(RangeError)
    expect(basalMetabolicRate({ ...subject, ageYears: 16, biologicalSex: BiologicalSex.MALE })).toBeGreaterThan(0)
  })
})

describe('totalDailyEnergyExpenditure — BR-NUT-13', () => {
  it('reproduces the documented worked example: 1345 x 1.375 = 1849.375 -> 1849', () => {
    expect(totalDailyEnergyExpenditure(1345, ActivityLevel.LIGHTLY_ACTIVE)).toBe(1849)
  })

  it('uses the five standard activity factors', () => {
    expect(ACTIVITY_FACTOR).toEqual({
      SEDENTARY: 1.2,
      LIGHTLY_ACTIVE: 1.375,
      MODERATELY_ACTIVE: 1.55,
      VERY_ACTIVE: 1.725,
      EXTRA_ACTIVE: 1.9,
    })
  })

  it('increases monotonically with activity level', () => {
    const levels = [
      ActivityLevel.SEDENTARY,
      ActivityLevel.LIGHTLY_ACTIVE,
      ActivityLevel.MODERATELY_ACTIVE,
      ActivityLevel.VERY_ACTIVE,
      ActivityLevel.EXTRA_ACTIVE,
    ] as const
    const values = levels.map((l) => totalDailyEnergyExpenditure(1600, l))
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!)
    }
  })
})

describe('defaultHydrationGoalMl', () => {
  it('defaults to 35 ml per kilogram of body mass', () => {
    expect(defaultHydrationGoalMl(70)).toBe(2450)
  })
})
