/**
 * Fitness routes mounted at /api/fitness.
 */

import { Router } from 'express'

import { authenticate } from '../auth/authController.js'
import {
  listWorkoutsHandler,
  getWorkoutHandler,
  logWorkout,
  getSummary,
  searchExercises,
  getPersonalRecordsHandler,
} from './fitnessController.js'

const router = Router()

router.use(authenticate)

router.get('/exercises', searchExercises)
router.get('/personal-records', getPersonalRecordsHandler)
router.get('/summary', getSummary)
router.get('/', listWorkoutsHandler)
router.post('/', logWorkout)
router.get('/:id', getWorkoutHandler)

export default router
