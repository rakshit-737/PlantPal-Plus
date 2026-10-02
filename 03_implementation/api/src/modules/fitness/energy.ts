/**
 * The two FR-FIT-05 inputs a client may leave out.
 *
 * The energy estimate is owed on every workout with a duration, not only on
 * those whose client happened to send a MET value and a body mass — the web
 * client sends neither for a plain walk or run, and every such workout used to
 * be stored with no estimate at all. When a client omits them the server fills
 * them in here, from the same sources the requirement names, and freezes them
 * onto the row like any client-sent value.
 *
 *  - MET: BR-FIT-02's catalogue, selected by activity type and perceived
 *    intensity (MODERATE when none is given, the default on every form).
 *  - Body mass: BR-FIT-05's chain. This deployment records no body-metric
 *    entries, so the chain is the onboarding profile mass, then the 70 kg
 *    default.
 */

import { getPool } from '../../db/pool.ts'

/** BR-FIT-05 step 3: the mass used when nothing better is on record. */
export const DEFAULT_BODY_MASS_KG = 70

/** BR-FIT-02: MET at LOW, MODERATE and VIGOROUS perceived intensity. */
const ACTIVITY_MET: Readonly<Record<string, readonly [number, number, number]>> = {
  WALK: [2.8, 3.5, 5.0],
  RUN: [6.0, 9.8, 12.3],
  CYCLE: [4.0, 8.0, 12.0],
  SWIM: [4.8, 7.0, 10.0],
  STRENGTH: [3.5, 5.0, 6.0],
  YOGA: [2.5, 3.0, 4.0],
  HIIT: [6.0, 8.0, 10.0],
  SPORT: [4.0, 6.5, 9.0],
  OTHER: [3.0, 4.5, 6.0],
}

const INTENSITY_COLUMN: Readonly<Record<string, 0 | 1 | 2>> = {
  LOW: 0,
  MODERATE: 1,
  VIGOROUS: 2,
}

/** The catalogue MET for an activity at an intensity, or undefined for an unknown type. */
export function activityMet(activityType: string, intensity?: string | null): number | undefined {
  const row = ACTIVITY_MET[activityType]
  if (!row) return undefined
  return row[INTENSITY_COLUMN[intensity ?? 'MODERATE'] ?? 1]
}

/** BR-FIT-05 steps 2–3: the profile's mass when onboarding captured one, else the default. */
export async function resolveBodyMassKg(userId: string): Promise<number> {
  const { rows } = await getPool().query<{ kg: number | null }>(
    `select current_body_mass_kg::float8 as kg from profiles where user_id = $1`,
    [userId],
  )
  const kg = rows[0]?.kg
  return typeof kg === 'number' && Number.isFinite(kg) && kg > 0 ? kg : DEFAULT_BODY_MASS_KG
}
