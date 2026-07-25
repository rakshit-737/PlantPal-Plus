/**
 * Express application assembly.
 *
 * Kept separate from `server.ts` so tests can mount the app with supertest
 * without binding a port or opening a database pool.
 */

import cors from 'cors'
import cookieParser from 'cookie-parser'
import express, { type Express } from 'express'
import helmet from 'helmet'

import authRoutes from './modules/auth/authRoutes.js'
import plantsRoutes from './modules/plants/plantsRoutes.js'
import fitnessRoutes from './modules/fitness/fitnessRoutes.js'
import nutritionRoutes from './modules/nutrition/nutritionRoutes.js'
import dashboardRoutes from './modules/dashboard/dashboardRoutes.js'
import achievementsRoutes from './modules/achievements/achievementsRoutes.js'
import { errorHandler, notFoundHandler } from './http/errorHandler.js'
import { requestId } from './http/requestId.js'
import { logger } from './logging.js'

export interface AppOptions {
  corsOrigins: string[]
  /** FR-SYS-21 — request body size limit. */
  bodyLimit?: string
  /** Authentication middleware, optionally replaced in tests. */
  authenticate?: typeof import('./modules/auth/authController.js').authenticate
}

export function createApp(options: AppOptions): Express {
  const app = express()

  // Trust the single proxy hop used by the free-tier hosts, so client IPs are
  // correct for rate limiting. Left at 1 deliberately: `true` would let a client
  // spoof X-Forwarded-For and defeat per-IP limits.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(requestId)
  app.use(helmet())
  app.use(
    cors({
      origin: options.corsOrigins,
      credentials: true,
      exposedHeaders: ['x-request-id'],
    }),
  )
  app.use(express.json({ limit: options.bodyLimit ?? '1mb' }))
  app.use(cookieParser())

  // Auth routes — registration, login, token refresh, logout.
  app.use('/api/auth', authRoutes)

  app.use('/api/v1/plants', plantsRoutes)
  app.use('/api/v1/fitness', fitnessRoutes)
  app.use('/api/v1/nutrition', nutritionRoutes)
  app.use('/api/v1/dashboard', dashboardRoutes)
  app.use('/api/v1/achievements', achievementsRoutes)

  /**
   * FR-SYS-25 — health and readiness.
   *
   * `/healthz` is intentionally dependency-free and cheap: it is also the
   * keep-alive target that stops the free-tier instance sleeping through a cron
   * tick, which is the product's single biggest architectural risk (RSK-01).
   * Making it touch the database would turn a keep-alive ping into load.
   */
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', uptime_s: Math.round(process.uptime()) })
  })

  app.get('/api/v1', (_req, res) => {
    res.json({ name: 'PlantPal+ API', version: 'v1' })
  })

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
