import type { NextFunction, Request, Response } from 'express'

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

    res.json(await updateSettings(userId, patch))
  } catch (err) {
    next(err)
  }
}
