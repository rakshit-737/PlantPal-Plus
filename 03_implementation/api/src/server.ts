/**
 * Process entry point: load configuration, build the app, listen, and shut down
 * cleanly.
 *
 * Graceful shutdown matters on the target hosts, which send SIGTERM before
 * replacing an instance. Without it, in-flight requests are cut mid-response.
 */

import { createApp } from './app.ts'
import { configureEnv } from './config/env.ts'
import { initPool } from './db/pool.ts'
import { runMigrations } from './db/migrate.ts'
import { runSeeds } from './db/seed.ts'
import { logger } from './logging.ts'
import { startPurgeJob, stopPurgeJob } from './modules/account/purgeService.ts'
import { startReminderEngine, stopReminderEngine } from './modules/reminders/reminderService.ts'

const env = configureEnv()
initPool(env.DATABASE_URL)

// Run migrations at boot so every deploy is self-migrating. The migration runner
// is idempotent: it records which migrations have run, so a re-deploy applies
// nothing new.
const migrationResult = await runMigrations()
logger.info(
  { applied: migrationResult.applied, skipped: migrationResult.skipped },
  'boot migrations completed',
)
// Seeds are idempotent by definition (BR-SYS-29 clause 4: stable ids, upsert
// on conflict), so running them at every boot makes a fresh deploy fully
// hands-off — no console step to forget.
const seedResult = await runSeeds()
logger.info({ files: seedResult.files }, 'boot seeds completed')
const app = createApp({ corsOrigins: env.CORS_ORIGINS })

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, 'PlantPal+ API listening')
})

// RSK-01: the reminder tick lives in this process. Keep /healthz pinged by an
// external monitor so the free-tier instance does not sleep through it.
startReminderEngine()
// FR-ACC-22: the hourly erasure sweep. Same process, same RSK-01 exposure, and
// the same mitigation — a missed hour delays an erasure, it never skips one.
startPurgeJob()

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down')
  stopReminderEngine()
  stopPurgeJob()
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'error during shutdown')
      process.exit(1)
    }
    process.exit(0)
  })
  // Do not wait forever for a stuck connection to drain.
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
