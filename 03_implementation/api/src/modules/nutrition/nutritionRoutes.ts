import { Router } from 'express'

import { authenticate } from '../auth/authController.ts'
import {
  searchFoodsHandler,
  createCustomFoodHandler,
  deleteCustomFoodHandler,
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
// FR-NUT-10 — remove one of the caller's own custom foods. Registered after
// GET /foods/search, which is a different method and so cannot be shadowed by
// this ':id' path.
router.delete('/foods/:id', deleteCustomFoodHandler)
router.get('/summary', getDailySummaryHandler)
router.post('/meals', logMealHandler)
router.post('/water', logWaterHandler)

export default router
