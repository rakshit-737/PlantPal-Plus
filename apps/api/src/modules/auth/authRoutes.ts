/**
 * Auth routes mounted at /api/auth.
 */

import { Router } from 'express'

import { register, login, refresh, logout, me, authenticate } from './authController.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.get('/me', authenticate, me)

export default router