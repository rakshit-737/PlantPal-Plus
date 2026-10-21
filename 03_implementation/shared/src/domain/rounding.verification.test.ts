/**
 * White-box and boundary verification of the shared rounding primitives.
 * BR-PLT-08 clause 1 / BR-NUT-13 / BR-FIT-15 all specify round-half-up.
 *
 * Test IDs: TC-SYS-001 .. (shared-library rules used by every module)
 */
import { describe, expect, it } from 'vitest'

import { clamp, roundHalfUp, roundTo } from '../index.js'

describe('roundHalfUp', () => {
  it.each([
    [0, 0],
    [0.49999, 0],
    [0.5, 1],
    [1.5, 2],
    [2.5, 3],
    [4.4999999, 4],
    [4.5, 5],
    [5.4625, 5],
    [38.6263, 39],
    [71.2332, 71],
  ])('TC-SYS-001 rounds %f to %i', (input, expected) => {
    expect(roundHalfUp(input)).toBe(expected)
  })

  it.each([
    [-0.4, 0],
    [-0.5, -1],
    [-1.5, -2],
    [-2.5, -3],
  ])('TC-SYS-002 rounds negative %f half away from zero to %i', (input, expected) => {
    // Math.round(-2.5) is -2; the specification requires half-up away from zero.
    expect(roundHalfUp(input) + 0).toBe(expected) // + 0 normalises -0; see DEF-001 below
  })

  it('TC-SYS-002b [DEF-001] values in (-0.5, 0) round to +0, not negative zero', () => {
    // Observation S4: Math.sign(-0.4) * Math.floor(0.9) yields -0. Harmless in
    // JSON and most formatting, but Object.is(-0, 0) is false, so an equality
    // check or a Map key built from the result can disagree with the spec's 0.
    expect(Object.is(roundHalfUp(-0.4), 0)).toBe(true)
  })

  it.each([NaN, Infinity, -Infinity])('TC-SYS-003 rejects the non-finite value %f', (bad) => {
    expect(() => roundHalfUp(bad)).toThrow(RangeError)
  })
})

describe('roundTo', () => {
  it.each([
    [529.2, 1, 529.2],
    [116.66666, 1, 116.7],
    [1.25, 1, 1.3],
    [1.35, 1, 1.4],
    [2.5, 0, 3],
    [0.125, 2, 0.13],
    [-1.25, 1, -1.3],
  ])('TC-SYS-004 roundTo(%f, %i) = %f', (value, dp, expected) => {
    expect(roundTo(value, dp)).toBeCloseTo(expected, 10)
  })

  it('TC-SYS-005 accepts the decimal places boundaries 0 and 10', () => {
    expect(() => roundTo(1.23456789012, 0)).not.toThrow()
    expect(() => roundTo(1.23456789012, 10)).not.toThrow()
  })

  it.each([-1, 11, 1.5, NaN])('TC-SYS-006 rejects %f decimal places', (dp) => {
    expect(() => roundTo(1, dp)).toThrow(RangeError)
  })

  it.each([NaN, Infinity])('TC-SYS-007 rejects the non-finite value %f', (bad) => {
    expect(() => roundTo(bad, 1)).toThrow(RangeError)
  })
})

describe('clamp', () => {
  it('TC-SYS-008 returns the value inside the range and the nearest bound outside it', () => {
    expect(clamp(5, 1, 10)).toBe(5)
    expect(clamp(0, 1, 10)).toBe(1)
    expect(clamp(11, 1, 10)).toBe(10)
  })

  it('TC-SYS-009 the bounds themselves are inclusive', () => {
    expect(clamp(1, 1, 10)).toBe(1)
    expect(clamp(10, 1, 10)).toBe(10)
  })

  it('TC-SYS-010 a degenerate range (min = max) always returns that value', () => {
    expect(clamp(-100, 7, 7)).toBe(7)
    expect(clamp(100, 7, 7)).toBe(7)
  })

  it('TC-SYS-011 rejects an inverted range instead of returning a misleading value', () => {
    expect(() => clamp(5, 10, 1)).toThrow(RangeError)
  })
})
