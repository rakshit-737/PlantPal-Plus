import { Router } from 'express'

import { authenticate } from '../auth/authController.ts'
import { getSettingsHandler, updateSettingsHandler } from './settingsController.ts'

const router = Router()
router.use(authenticate)

router.get('/', getSettingsHandler)
router.put('/', updateSettingsHandler)

export default router
