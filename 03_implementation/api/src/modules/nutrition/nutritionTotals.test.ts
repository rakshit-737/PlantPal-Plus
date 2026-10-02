/**
 * The day's nutrition totals (FR-NUT diary summary).
 *
 * Meal totals are stored with one decimal place, and the day's totals are their
 * sums. Plain floating-point addition leaves residue in those sums, which the
 * web diary printed verbatim ("Fat 27.299999999999997 / 65").
 */

import { describe, expect, it } from 'vitest'

import { sumMealTotals } from './nutritionRepo.ts'

describe('sumMealTotals', () => {
  it('adds one-decimal figures without floating-point residue', () => {
    const meals = [
      { total_kcal: 384, total_protein_g: 9, total_carbs_g: 54, total_fat_g: 15.6 },
      { total_kcal: 375, total_protein_g: 8.8, total_carbs_g: 60, total_fat_g: 11.3 },
      { total_kcal: 106.8, total_protein_g: 1.3, total_carbs_g: 27.4, total_fat_g: 0.4 },
    ]

    // The residue this guards against: plain addition is not exact.
    expect(15.6 + 11.3 + 0.4).not.toBe(27.3)

    expect(sumMealTotals(meals)).toEqual({
      kcal: 865.8,
      protein_g: 19.1,
      carbs_g: 141.4,
      fat_g: 27.3,
    })
  })

  it('is zero for every figure on a day with no meals', () => {
    expect(sumMealTotals([])).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
  })
})
