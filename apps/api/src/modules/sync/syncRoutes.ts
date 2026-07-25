/**
 * Sync routes mounted at /api/v1/sync.
 */

import { Router } from 'express'

import { authenticate } from '../auth/authController.js'
import { drainOutboxHandler } from './syncController.js'

const router = Router()

router.use(authenticate)

router.post('/outbox', drainOutboxHandler)

export default router
