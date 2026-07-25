/**
 * Achievements routes mounted at /api/v1/achievements.
 */

import { Router } from 'express'

import { authenticate } from '../auth/authController.js'
import {
  listAchievementsHandler,
  listStreaksHandler,
  markSeenHandler,
} from './achievementsController.js'

const router = Router()

router.use(authenticate)

router.get('/', listAchievementsHandler)
router.get('/streaks', listStreaksHandler)
router.post('/seen', markSeenHandler)

export default router
