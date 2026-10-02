/**
 * Auth routes mounted at /api/auth.
 */

import { Router, type RequestHandler } from 'express'

import { register, login, refresh, logout, me, authenticate } from './authController.ts'
import { rateLimit } from '../../http/rateLimit.ts'

const router = Router()

/*
 * Two per-IP budgets rather than one (FR-SYS-21).
 *
 * Credential endpoints — register and login — are what an attacker hammers, so
 * they keep the blunt 30/min outer guard; the per-account lockout inside the
 * login handler remains the precise defence.
 *
 * Session endpoints are a different animal. Every page load of the web app
 * redeems the refresh cookie once, and a shared network (a campus, an office,
 * a mobile carrier's NAT — or a host that proxies every visitor through one
 * address) puts many people behind one IP. Sharing the credential budget meant
 * a handful of people reloading pages could exhaust it and get everyone behind
 * that address signed out with a 429. A refresh token is a 256-bit secret, so
 * there is nothing to guess here; this budget only exists to blunt floods.
 *
 * Both are disabled under test: the suites fire dozens of logins from one IP
 * by design, and the account-level lockout path has its own coverage.
 */
const passThrough: RequestHandler = (_req, _res, next) => next()
const underTest = process.env['NODE_ENV'] === 'test'
const credentialLimit = underTest ? passThrough : rateLimit({ windowMs: 60_000, max: 30 })
const sessionLimit = underTest ? passThrough : rateLimit({ windowMs: 60_000, max: 300 })

router.post('/register', credentialLimit, register)
router.post('/login', credentialLimit, login)
router.post('/refresh', sessionLimit, refresh)
router.post('/logout', sessionLimit, logout)
router.get('/me', sessionLimit, authenticate, me)

export default router
