/**
 * Black-box verification of FR-FIT energy, one-rep-max and volume rules
 * (BR-FIT-14, BR-FIT-15 and the MET formula).
 * Test IDs: TC-FIT-001 ..
 */
import { describe, expect, it } from 'vitest'

import {
  E1RM_VALID_REP_RANGE,
  estimatedOneRepMax,
  isEligibleForOneRepMaxRecord,
  setVolumeKg,
  totalVolumeKg,
  workoutEnergyKcal,
} from '../index.js'

describe('MET energy estimate: MET x kg x minutes / 60, one decimal', () => {
  it('TC-FIT-001 spec vector: RUN at MODERATE (MET 9.8), 45 min at 72 kg = 529.2 kcal', () => {
    expect(workoutEnergyKcal(9.8, 72, 45)).toBe(529.2)
  })

  it('TC-FIT-002 catalogue default: WALK MET 3.5, 70 kg, 30 min = 122.5 kcal', () => {
    expect(workoutEnergyKcal(3.5, 70, 30)).toBe(122.5)
  })

  it('TC-FIT-003 rounds to one decimal place half up', () => {
    // 1 * 30 * 1 / 60 = 0.5 ; 3.3 * 61 * 1 / 60 = 3.355 -> 3.4
    expect(workoutEnergyKcal(1, 30, 1)).toBe(0.5)
    expect(workoutEnergyKcal(3.3, 61, 1)).toBe(3.4)
  })

  it.each([
    [1.0, true],
    [23.0, true],
    [0.99, false],
    [23.01, false],
    [0, false],
    [-5, false],
    [NaN, false],
  ])('TC-FIT-004 MET %f accepted=%s (bound 1.0 to 23.0, inclusive)', (met, ok) => {
    const run = () => workoutEnergyKcal(met, 70, 30)
    if (ok) expect(run).not.toThrow()
    else expect(run).toThrow(RangeError)
  })

  it.each([0, -1, NaN])('TC-FIT-005 rejects body mass %f', (kg) => {
    expect(() => workoutEnergyKcal(5, kg, 30)).toThrow(RangeError)
  })

  it.each([0, -1, NaN, Infinity])('TC-FIT-006 rejects duration %f', (mins) => {
    expect(() => workoutEnergyKcal(5, 70, mins)).toThrow(RangeError)
  })

  it('TC-FIT-007 doubles when duration doubles (linearity)', () => {
    expect(workoutEnergyKcal(6, 80, 60)).toBe(2 * workoutEnergyKcal(6, 80, 30))
  })
})

describe('BR-FIT-15: Epley one-rep max', () => {
  it('TC-FIT-008 spec vector: 100 kg x 5 reps = 100 x (1 + 5/30) = 116.7 kg', () => {
    expect(estimatedOneRepMax(100, 5)).toBe(116.7)
  })

  it('TC-FIT-009 one repetition returns the lifted weight exactly', () => {
    expect(estimatedOneRepMax(142.5, 1)).toBe(142.5)
  })

  it.each([
    [60, 10, 80],
    [100, 12, 140],
    [50, 3, 55],
  ])('TC-FIT-010 %f kg x %i reps -> %f kg', (kg, reps, e1rm) => {
    expect(estimatedOneRepMax(kg, reps)).toBe(e1rm)
  })

  it('TC-FIT-011 zero load carries no information and returns 0', () => {
    expect(estimatedOneRepMax(0, 8)).toBe(0)
  })

  it.each([0, -1, 2.5, NaN])('TC-FIT-012 rejects %f reps', (reps) => {
    expect(() => estimatedOneRepMax(100, reps)).toThrow(RangeError)
  })

  it('TC-FIT-013 rejects a negative weight', () => {
    expect(() => estimatedOneRepMax(-1, 5)).toThrow(RangeError)
  })

  it('TC-FIT-014 the valid record rep range is 1 to 12', () => {
    expect(E1RM_VALID_REP_RANGE).toEqual({ min: 1, max: 12 })
  })

  it.each([
    [100, 1, true],
    [100, 12, true],
    [100, 13, false],
    [100, 0, false],
    [0, 5, false],
    [100, 5.5, false],
  ])('TC-FIT-015 eligible(%f kg, %f reps) = %s', (kg, reps, ok) => {
    expect(isEligibleForOneRepMaxRecord(kg, reps)).toBe(ok)
  })
})

describe('BR-FIT-14: strength volume', () => {
  it('TC-FIT-016 spec vector: 3 sets of 5 at 100 kg = 1500 kg', () => {
    expect(totalVolumeKg([{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }])).toBe(1500)
  })

  it('TC-FIT-017 an empty workout totals 0, never null or NaN', () => {
    expect(totalVolumeKg([])).toBe(0)
  })

  it('TC-FIT-018 bodyweight sets (0 kg) contribute zero volume', () => {
    expect(totalVolumeKg([{ reps: 15, weightKg: 0 }])).toBe(0)
  })

  it('TC-FIT-019 set volume is reps x weight, one decimal', () => {
    expect(setVolumeKg(8, 22.5)).toBe(180)
    expect(setVolumeKg(3, 33.33)).toBe(100)
  })

  it.each([
    [-1, 10],
    [1.5, 10],
    [5, -0.5],
    [5, NaN],
  ])('TC-FIT-020 setVolumeKg rejects reps=%f weight=%f', (reps, kg) => {
    expect(() => setVolumeKg(reps, kg)).toThrow(RangeError)
  })

  it('TC-FIT-021 [DEF-003] totalVolumeKg accepts invalid sets that setVolumeKg rejects', () => {
    // totalVolumeKg does no validation: a negative or fractional set silently
    // lowers or distorts the total, whereas setVolumeKg refuses the same input.
    // Two functions in one module disagree about the same input, so a caller that
    // reaches totalVolumeKg first can record a wrong total volume.
    expect(() => totalVolumeKg([{ reps: -5, weightKg: 100 }])).toThrow(RangeError)
  })
})
