import { Router } from 'express'

import { authenticate } from '../auth/authController.ts'
import {
  searchFoodsHandler,
  getDailySummaryHandler,
  logMealHandler,
  logWaterHandler,
} from './nutritionController.ts'

const router = Router()

router.use(authenticate)

router.get('/foods/search', searchFoodsHandler)
router.get('/summary', getDailySummaryHandler)
router.post('/meals', logMealHandler)
router.post('/water', logWaterHandler)

export default router
