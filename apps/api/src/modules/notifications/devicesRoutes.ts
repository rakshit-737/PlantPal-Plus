/**
 * Device registry routes mounted at /api/v1/devices (FR-NOT-14).
 */

import type { NextFunction, Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'

import { AppError } from '../../http/errors.js'
import { getUserId } from '../../http/requestUser.js'
import { authenticate } from '../auth/authController.js'
import { registerToken } from './devicesRepo.js'

const registerSchema = z
  .object({
    expo_push_token: z
      .string()
      .min(20)
      .max(200)
      .regex(/^Expo(nent)?PushToken\[.+\]$/),
    // WEB deferred to v1.1 under D-10 — mobile platforms only in v1.0.
    platform: z.enum(['IOS', 'ANDROID']),
    client_installation_id: z.string().uuid(),
    device_label: z.string().max(64).optional(),
    app_version: z.string().max(20).optional(),
    permission_status: z.enum(['GRANTED', 'DENIED', 'UNDETERMINED']),
  })
  .strict()

const router = Router()

router.use(authenticate)

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_FAILED', 'The request failed validation.', {
        details: parsed.error.issues.slice(0, 10).map((i) => ({
          field: i.path.join('.'),
          issue: i.message,
        })),
      })
    }
    const { id, devices } = await registerToken(getUserId(req), {
      ...parsed.data,
      device_label: parsed.data.device_label?.trim() || undefined,
    })
    res.status(200).json({ id, devices })
  } catch (err) {
    next(err)
  }
})

export default router
