import { Router } from 'express'

import { authenticate } from '../auth/authController.js'
import { getDashboardHandler } from './dashboardController.js'

const router = Router()

router.use(authenticate)

router.get('/', getDashboardHandler)

export default router
