import { describe, expect, it } from 'vitest'

import {
  estimatedOneRepMax,
  isEligibleForOneRepMaxRecord,
  setVolumeKg,
  totalVolumeKg,
  workoutEnergyKcal,
} from './fitness.js'

describe('workoutEnergyKcal — MET formula', () => {
  it('computes MET x kg x minutes / 60', () => {
    // 8 MET, 70 kg, 30 minutes -> 8 x 70 x 0.5 = 280 kcal
    expect(workoutEnergyKcal(8, 70, 30)).toBe(280)
  })

  it('scales linearly with duration', () => {
    expect(workoutEnergyKcal(8, 70, 60)).toBe(workoutEnergyKcal(8, 70, 30) * 2)
  })

  it('rejects a MET value outside the catalogue bound of 1.0 to 23.0', () => {
    expect(() => workoutEnergyKcal(0.5, 70, 30)).toThrow(RangeError)
    expect(() => workoutEnergyKcal(24, 70, 30)).toThrow(RangeError)
  })
})

describe('estimatedOneRepMax — BR-FIT-15 Epley', () => {
  it('reproduces the documented worked example: 100 x (1 + 5/30) = 116.7', () => {
    expect(estimatedOneRepMax(100, 5)).toBe(116.7)
  })

  it('returns the weight exactly at one repetition, avoiding the 3.3 percent Epley inflation', () => {
    // Unmodified Epley would give 100 x (1 + 1/30) = 103.3, a lift never performed.
    expect(estimatedOneRepMax(100, 1)).toBe(100)
  })

  it('increases with repetitions at the same weight', () => {
    expect(estimatedOneRepMax(100, 8)).toBeGreaterThan(estimatedOneRepMax(100, 3))
  })

  it('treats a bodyweight set as carrying no load information', () => {
    expect(estimatedOneRepMax(0, 10)).toBe(0)
    expect(isEligibleForOneRepMaxRecord(0, 10)).toBe(false)
  })

  it('excludes sets above 12 repetitions from record detection but still estimates them', () => {
    expect(estimatedOneRepMax(60, 15)).toBeGreaterThan(60)
    expect(isEligibleForOneRepMaxRecord(60, 15)).toBe(false)
    expect(isEligibleForOneRepMaxRecord(60, 12)).toBe(true)
    expect(isEligibleForOneRepMaxRecord(60, 1)).toBe(true)
  })

  it('rejects a fractional repetition count', () => {
    expect(() => estimatedOneRepMax(100, 2.5)).toThrow(RangeError)
  })
})

describe('volume — BR-FIT-14', () => {
  it('computes set volume as reps x weight', () => {
    expect(setVolumeKg(5, 100)).toBe(500)
  })

  it('reproduces the documented worked example: 3 sets of 5 at 100 kg = 1500 kg', () => {
    const sets = [
      { reps: 5, weightKg: 100 },
      { reps: 5, weightKg: 100 },
      { reps: 5, weightKg: 100 },
    ]
    expect(totalVolumeKg(sets)).toBe(1500)
  })

  it('returns 0.0 rather than null when there are no sets, so no chart series has a gap', () => {
    expect(totalVolumeKg([])).toBe(0)
  })

  it('contributes zero for bodyweight sets logged at zero load', () => {
    expect(totalVolumeKg([{ reps: 20, weightKg: 0 }])).toBe(0)
  })
})
