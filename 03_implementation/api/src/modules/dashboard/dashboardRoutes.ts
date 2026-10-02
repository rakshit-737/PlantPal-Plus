import { Router } from 'express'

import { authenticate } from '../auth/authController.ts'
import { getDashboardHandler } from './dashboardController.ts'

const router = Router()

router.use(authenticate)

router.get('/', getDashboardHandler)

export default router
