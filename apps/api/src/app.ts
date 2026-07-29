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

import authRoutes from './modules/auth/authRoutes.ts'
import plantsRoutes from './modules/plants/plantsRoutes.ts'
import fitnessRoutes from './modules/fitness/fitnessRoutes.ts'
import nutritionRoutes from './modules/nutrition/nutritionRoutes.ts'
import dashboardRoutes from './modules/dashboard/dashboardRoutes.ts'
import achievementsRoutes from './modules/achievements/achievementsRoutes.ts'
import remindersRoutes from './modules/reminders/remindersRoutes.ts'
import devicesRoutes from './modules/notifications/devicesRoutes.ts'
import syncRoutes from './modules/sync/syncRoutes.ts'
import settingsRoutes from './modules/settings/settingsRoutes.ts'
import { errorHandler, notFoundHandler } from './http/errorHandler.ts'
import { requestId } from './http/requestId.ts'
import { logger } from './logging.ts'

export interface AppOptions {
  corsOrigins: string[]
  /** FR-SYS-21 — request body size limit. */
  bodyLimit?: string
  /** Authentication middleware, optionally replaced in tests. */
  authenticate?: typeof import('./modules/auth/authController.ts').authenticate
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
  app.use('/api/v1/reminders', remindersRoutes)
  app.use('/api/v1/devices', devicesRoutes)
  app.use('/api/v1/sync', syncRoutes)
  app.use('/api/v1/settings', settingsRoutes)

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
