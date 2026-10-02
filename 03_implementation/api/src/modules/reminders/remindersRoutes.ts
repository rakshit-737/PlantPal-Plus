/**
 * Reminders routes mounted at /api/v1/reminders.
 *
 * v1.0 delivery is in-app: clients poll this list. Expo Push and the email
 * digest layer on top later without changing the schedule/dispatch model.
 */

import type { NextFunction, Request, Response } from 'express'
import { Router } from 'express'

import { AppError } from '../../http/errors.ts'
import { getUserId } from '../../http/requestUser.ts'
import { authenticate } from '../auth/authController.ts'
import { dismiss, listForUser } from './remindersRepo.ts'

const router = Router()

router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reminders = await listForUser(getUserId(req))
    res.status(200).json({ reminders })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/dismiss', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      throw new AppError('VALIDATION_FAILED', 'Reminder id must be a UUID.')
    }
    const ok = await dismiss(getUserId(req), id)
    if (!ok) {
      throw new AppError('NOT_FOUND', 'Reminder not found or already resolved.')
    }
    res.status(200).json({ status: 'dismissed' })
  } catch (err) {
    next(err)
  }
})

export default router
