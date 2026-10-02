import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { AppError } from '../../http/errors.ts'
import { getUserId } from '../../http/requestUser.ts'
import { getSettings, updateSettings, type UserSettingsRow } from './settingsRepo.ts'

const ENUMS: Record<string, readonly string[]> = {
  hemisphere: ['NORTHERN', 'SOUTHERN', 'EQUATORIAL'],
  unit_system: ['METRIC', 'IMPERIAL'],
  theme: ['LIGHT', 'DARK', 'SYSTEM'],
  week_start_day: ['SUNDAY', 'MONDAY'],
  quiet_hours_mode: ['OFF', 'WINDOW', 'SCHEDULED_ONLY'],
}

const BOOLEANS = [
  'plant_care_enabled',
  'fitness_enabled',
  'nutrition_enabled',
  'reduce_motion',
  'larger_text',
  'high_contrast',
  'analytics_opt_in',
] as const

/**
 * Quiet-hours boundaries (FR-SET-16, FR-NOT-06). A 24-hour `HH:MM` wall clock
 * in the user's own zone: `24:00` and a seconds component are both rejected so
 * that what a client sends is byte-for-byte what a later GET returns —
 * settingsRepo normalises the read side onto the same shape.
 *
 * `null` clears a boundary. That is legal for every mode except WINDOW, which
 * the merged-state check below enforces.
 */
const quietTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable()

const QUIET_TIMES = ['quiet_start_time', 'quiet_end_time'] as const

/** The fields whose mutation makes the BR-NOT-08 window consistent-or-rejected. */
const QUIET_FIELDS = ['quiet_hours_mode', ...QUIET_TIMES] as const

export async function getSettingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await getSettings(getUserId(req)))
  } catch (err) {
    next(err)
  }
}

export async function updateSettingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
    const errors: { field: string; issue: string }[] = []
    const patch: Partial<UserSettingsRow> = {}

    for (const [field, allowed] of Object.entries(ENUMS)) {
      const v = body[field]
      if (v === undefined) continue
      if (typeof v !== 'string' || !allowed.includes(v)) {
        errors.push({ field, issue: `must_be_one_of:${allowed.join(',')}` })
      } else {
        ;(patch as Record<string, unknown>)[field] = v
      }
    }
    for (const field of BOOLEANS) {
      const v = body[field]
      if (v === undefined) continue
      if (typeof v !== 'boolean') errors.push({ field, issue: 'must_be_boolean' })
      else (patch as Record<string, unknown>)[field] = v
    }
    for (const field of QUIET_TIMES) {
      const v = body[field]
      if (v === undefined) continue
      const parsed = quietTimeSchema.safeParse(v)
      if (!parsed.success) errors.push({ field, issue: 'must_be_hh_mm_24h_or_null' })
      else (patch as Record<string, unknown>)[field] = parsed.data
    }
    if (body['timezone'] !== undefined) {
      if (typeof body['timezone'] !== 'string' || body['timezone'].length > 64) {
        errors.push({ field: 'timezone', issue: 'must_be_string_max_64' })
      } else patch.timezone = body['timezone']
    }
    if (body['locale'] !== undefined) {
      if (typeof body['locale'] !== 'string' || body['locale'].length > 20) {
        errors.push({ field: 'locale', issue: 'must_be_string_max_20' })
      } else patch.locale = body['locale']
    }
    if (body['daily_notification_cap'] !== undefined) {
      const v = body['daily_notification_cap']
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 20) {
        errors.push({ field: 'daily_notification_cap', issue: 'must_be_integer_1_to_20' })
      } else patch.daily_notification_cap = v
    }
    if (errors.length > 0) {
      throw new AppError('VALIDATION_FAILED', 'The request failed validation.', {
        details: errors,
      })
    }

    // Invariant 34: at least one module stays enabled. Evaluate against the
    // merged result, not the patch, so disabling the last active module fails.
    const userId = getUserId(req)
    const current = await getSettings(userId)
    const merged = { ...current, ...patch }
    if (!merged.plant_care_enabled && !merged.fitness_enabled && !merged.nutrition_enabled) {
      throw new AppError('VALIDATION_FAILED', 'At least one module must stay enabled.', {
        details: [{ field: 'modules', issue: 'at_least_one_module_required' }],
      })
    }

    // BR-NOT-08 clause 1 (and its SET-side restatement BR-SET-07): a WINDOW is
    // defined by BOTH boundaries, so a mode of WINDOW with either time missing
    // is not a configuration the dispatcher could evaluate.
    //
    // Checked only when the request actually touches the quiet-hours triple.
    // 001-auth-schema.sql defaults quiet_hours_mode to 'WINDOW' but gives the
    // two time columns no default, so every lazily created row begins life as
    // WINDOW-with-nulls; an unconditional check would make an unrelated theme
    // change unsavable for every user who has never opened this section.
    if (QUIET_FIELDS.some((f) => f in patch) && merged.quiet_hours_mode === 'WINDOW') {
      if (merged.quiet_start_time === null || merged.quiet_end_time === null) {
        throw new AppError('VALIDATION_FAILED', 'Quiet hours need both a start and an end time.', {
          details: [{ field: 'quiet_hours_mode', issue: 'window_requires_start_and_end' }],
        })
      }
      // Start equal to end is ambiguous between "never quiet" and "always
      // quiet" (BR-NOT-08 clause 1, edge case E-33), and is rejected at write
      // time rather than resolved arbitrarily at dispatch time.
      if (merged.quiet_start_time === merged.quiet_end_time) {
        throw new AppError('VALIDATION_FAILED', 'Quiet hours need a different start and end time.', {
          details: [{ field: 'quiet_end_time', issue: 'window_start_equals_end' }],
        })
      }
    }

    res.json(await updateSettings(userId, patch))
  } catch (err) {
    next(err)
  }
}
