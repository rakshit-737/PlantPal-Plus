import { workoutEnergyKcal } from '@plantpal/shared'
import { describe, expect, it } from 'vitest'

import { activityMet, DEFAULT_BODY_MASS_KG } from './energy.ts'

describe('activityMet (BR-FIT-02)', () => {
  it('reads the catalogue by activity and intensity', () => {
    expect(activityMet('WALK', 'LOW')).toBe(2.8)
    expect(activityMet('RUN', 'MODERATE')).toBe(9.8)
    expect(activityMet('HIIT', 'VIGOROUS')).toBe(10)
  })

  it('treats a missing intensity as MODERATE, the form default', () => {
    expect(activityMet('YOGA', undefined)).toBe(3)
    expect(activityMet('YOGA', null)).toBe(3)
  })

  it('returns undefined for a type outside the catalogue', () => {
    expect(activityMet('PARKOUR', 'LOW')).toBeUndefined()
  })

  it('reproduces the BR-FIT-04 worked example', () => {
    // RUN at MODERATE for 45 minutes at 72.0 kg gives 529.2.
    expect(workoutEnergyKcal(activityMet('RUN', 'MODERATE')!, 72, 45)).toBeCloseTo(529.2, 1)
  })

  it('falls back to the 70 kg default of BR-FIT-05', () => {
    expect(DEFAULT_BODY_MASS_KG).toBe(70)
  })
})
