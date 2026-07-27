import type { NextFunction, Request, Response } from 'express'
import { authenticate } from '../auth/authController.js'
import { notFound, badRequest } from '../../http/errors.js'
import { getUserId } from '../../http/requestUser.js'
import { recordDailyLogSafe } from '../engagement/engagementService.js'
import { cancelForTarget } from '../reminders/remindersRepo.js'
import {
  listPlants,
  getPlant,
  createPlant,
  updatePlant,
  softDeletePlant,
  logCareEvent,
  listCareEvents,
  listSpecies,
} from './plantsRepo.js'

const VALID_ACTION_TYPES = ['WATER', 'FERTILIZE', 'PRUNE', 'REPOT', 'MIST', 'ROTATE', 'TREAT']

export { authenticate }

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const plants = await listPlants(userId)
    res.json(plants)
  } catch (err) {
    next(err)
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const plant = await getPlant(req.params.id!, userId)
    if (!plant) throw notFound()
    res.json(plant)
  } catch (err) {
    next(err)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const body = req.body as Record<string, unknown>

    const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : ''
    if (!nickname || nickname.length > 80) {
      throw badRequest('nickname must be 1–80 characters.', [{ field: 'nickname', issue: 'invalid' }])
    }

    const base = Number(body.base_interval_days)
    if (!Number.isInteger(base) || base < 1 || base > 365) {
      throw badRequest('base_interval_days must be 1–365.', [{ field: 'base_interval_days', issue: 'invalid' }])
    }

    const min = Number(body.min_interval_days)
    const max = Number(body.max_interval_days)
    if (min > max) {
      throw badRequest('min_interval_days must not exceed max_interval_days.', [
        { field: 'min_interval_days', issue: 'invalid' },
      ])
    }

    const plant = await createPlant(userId, body as any)
    res.status(201).json(plant)
  } catch (err) {
    next(err)
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const plant = await updatePlant(req.params.id!, userId, req.body)
    if (!plant) throw notFound()
    res.json(plant)
  } catch (err) {
    next(err)
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const deleted = await softDeletePlant(req.params.id!, userId)
    if (!deleted) throw notFound()
    // FR-NOT-22 / E-14: reminders for a deleted subject must not fire.
    await cancelForTarget(userId, req.params.id!).catch(() => undefined)
    res.json({ status: 'deleted' })
  } catch (err) {
    next(err)
  }
}

export async function logCare(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const body = req.body as Record<string, unknown>

    const actionType = body.action_type as string
    if (!actionType || !VALID_ACTION_TYPES.includes(actionType)) {
      throw badRequest('action_type must be one of: ' + VALID_ACTION_TYPES.join(', '), [
        { field: 'action_type', issue: 'invalid' },
      ])
    }

    const localDateStr = body.local_date_str as string
    if (!localDateStr) {
      throw badRequest('local_date_str is required.', [{ field: 'local_date_str', issue: 'required' }])
    }

    try {
      await logCareEvent(
        userId,
        req.params.id!,
        actionType,
        body.note as string | undefined,
        localDateStr,
        body.client_idempotency_key as string | undefined,
      )
    } catch (err: unknown) {
      if (err && typeof err === 'object' && '__notFound' in (err as Record<string, unknown>)) {
        throw notFound()
      }
      throw err
    }
    // FR-NOT-22: the watering resolves the nag — a live reminder for this
    // plant must not keep firing.
    if (actionType === 'WATER') {
      await cancelForTarget(userId, req.params.id!).catch(() => undefined)
    }
    // BR-GAM-02: a resolved care task may complete the plant-care day.
    await recordDailyLogSafe(userId, 'PLANT_CARE', localDateStr)
    res.status(201).json({ status: 'logged' })
  } catch (err) {
    next(err)
  }
}

export async function getCareHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const events = await listCareEvents(req.params.id!, userId)
    res.json(events)
  } catch (err) {
    next(err)
  }
}

export async function searchSpecies(req: Request, res: Response, next: NextFunction) {
  try {
    const species = await listSpecies(req.query.q as string | undefined)
    res.json(species)
  } catch (err) {
    next(err)
  }
}
