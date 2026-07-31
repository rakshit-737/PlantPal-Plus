import { Router } from 'express'

import { authenticate } from '../auth/authController.ts'
import {
  searchFoodsHandler,
  createCustomFoodHandler,
  getDailySummaryHandler,
  logMealHandler,
  logWaterHandler,
} from './nutritionController.ts'

const router = Router()

router.use(authenticate)

router.get('/foods/search', searchFoodsHandler)
// FR-NUT-10 — create a private custom food. Ownership comes from the subject
// stamped by `authenticate` above, never from the body.
router.post('/foods', createCustomFoodHandler)
router.get('/summary', getDailySummaryHandler)
router.post('/meals', logMealHandler)
router.post('/water', logWaterHandler)

export default router
