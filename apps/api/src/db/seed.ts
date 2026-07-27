/**
 * Seed runner — idempotent reference-data loader.
 *
 * BR-SYS-29 clause 4: seed data is applied via separate seed scripts, never
 * migrations, so a migration is never blocked by a row that already exists and
 * a re-seed is always safe. Each seed file uses stable primary keys with
 * `on conflict (id) do update`, so running this twice converges rather than
 * duplicating or erroring.
 *
 * Unlike migrations there is no ledger table: a seed is defined to be
 * idempotent, so "have I run this?" is not a question worth persisting. Run it
 * on every deploy after migrations; it costs one upsert per catalogue row.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { getPool, initPool } from './pool.js'
import { sqlDir } from './migrate.js'
import { loadEnv } from '../config/env.js'
import { logger } from '../logging.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function runSeeds(): Promise<{ files: number }> {
  const pool = getPool()
  const client = await pool.connect()

  try {
    const dir = sqlDir('seeds')
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^\d{3}-.+\.sql$/.test(f))
      .sort()

    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8')
      logger.info({ file }, 'applying seed')
      // Each seed file wraps itself in a transaction, so a partial failure in
      // one catalogue does not leave half a catalogue behind.
      await client.query(sql)
    }

    logger.info({ files: files.length }, 'seeds complete')
    return { files: files.length }
  } finally {
    client.release()
  }
}

// Allow `npm run seed` to invoke this directly (pathToFileURL: the raw
// string comparison never matches on Windows).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = loadEnv()
  initPool(env.DATABASE_URL)
  runSeeds()
    .then(({ files }) => {
      logger.info({ files }, 'seed run finished')
      process.exit(0)
    })
    .catch((err) => {
      logger.error({ err }, 'seed run failed')
      process.exit(1)
    })
}
