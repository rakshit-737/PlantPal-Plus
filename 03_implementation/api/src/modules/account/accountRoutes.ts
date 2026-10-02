/**
 * Account routes mounted at /api/v1/account (FR-ACC-21).
 */

import { Router } from 'express'

import { authenticate } from '../auth/authController.ts'
import {
  cancelDeletionHandler,
  getAccountHandler,
  requestDeletionHandler,
} from './accountController.ts'

const router = Router()

// Every route here acts on the token subject, so authentication is applied to
// the whole router rather than per route: a handler added later cannot be
// forgotten and end up unprotected.
router.use(authenticate)

router.get('/', getAccountHandler)
router.post('/deletion', requestDeletionHandler)
router.delete('/deletion', cancelDeletionHandler)

export default router
