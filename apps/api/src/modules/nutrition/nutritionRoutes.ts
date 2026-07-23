import { Router } from 'express'

import { authenticate } from '../auth/authController.js'
import {
  searchFoodsHandler,
  getDailySummaryHandler,
  logMealHandler,
  logWaterHandler,
} from './nutritionController.js'

const router = Router()

router.use(authenticate)

router.get('/foods/search', searchFoodsHandler)
router.get('/summary', getDailySummaryHandler)
router.post('/meals', logMealHandler)
router.post('/water', logWaterHandler)

export default router
