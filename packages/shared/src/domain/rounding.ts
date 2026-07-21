/**
 * Rounding primitives shared by every domain calculation.
 *
 * The requirements repeatedly specify "round half up" (BR-PLT-08 clause 1,
 * BR-NUT-13, BR-FIT-15). JavaScript's `Math.round` is *not* half-up: it rounds
 * half toward positive infinity, so `Math.round(-2.5)` is `-2` rather than `-3`.
 * Every value we round today is positive, but encoding the rule correctly here
 * means a future negative-valued metric (an energy deficit, a mass delta) cannot
 * silently acquire a different rounding behaviour.
 *
 * BR-PLT-08 clause 2 additionally requires that intermediate values are never
 * rounded and that the result is bit-for-bit reproducible across the mobile, web
 * and server consumers of the same function (NFR-MAIN-04, BR-ENT-15). That is
 * why these helpers exist in the shared package and are never re-implemented.
 */

/** Round half away from zero, to a whole number. */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`roundHalfUp expected a finite number, received ${value}`)
  }
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5)
}

/** Round half away from zero, to `decimals` decimal places. */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`roundTo expected a finite number, received ${value}`)
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 10) {
    throw new RangeError(`roundTo expected 0..10 decimals, received ${decimals}`)
  }
  const factor = 10 ** decimals
  return (Math.sign(value) * Math.floor(Math.abs(value) * factor + 0.5)) / factor
}

/** Constrain `value` to the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError(`clamp received an inverted range: min ${min} exceeds max ${max}`)
  }
  return Math.min(Math.max(value, min), max)
}
