/**
 * Auth routes mounted at /api/auth.
 */

import { Router } from 'express'

import { register, login, refresh, logout, me, authenticate } from './authController.ts'
import { rateLimit } from '../../http/rateLimit.ts'

const router = Router()

// Blunt per-IP outer guard (FR-SYS-21); the per-account lockout inside the
// login handler remains the precise defence. 30/min absorbs any legitimate
// client burst while making unauthenticated hammering expensive. Disabled
// under test: the suites fire dozens of logins from one IP by design, and
// the account-level lockout path has its own integration coverage.
if (process.env['NODE_ENV'] !== 'test') {
  router.use(rateLimit({ windowMs: 60_000, max: 30 }))
}

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.get('/me', authenticate, me)

export default router