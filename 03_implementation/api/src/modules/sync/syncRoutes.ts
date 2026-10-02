/**
 * Sync routes mounted at /api/v1/sync.
 */

import { Router } from 'express'

import { authenticate } from '../auth/authController.ts'
import { drainOutboxHandler } from './syncController.ts'

const router = Router()

router.use(authenticate)

router.post('/outbox', drainOutboxHandler)

export default router
