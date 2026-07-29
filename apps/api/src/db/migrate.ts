/**
 * Database migration runner.
 *
 * Migrations are numbered SQL files in ./migrations/ executed in sequence,
 * each wrapped in a transaction. A migrations table records which have run,
 * so a deploy applying `002` after `001` already ran skips `001` safely.
 *
 * BR-SYS-29 clause 4: seed data is idempotent, applied via separate seed
 * scripts rather than migrations so a migration is never blocked by a row
 * that already exists.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { getPool, initPool } from './pool.ts'
import { loadEnv } from '../config/env.ts'
import { logger } from '../logging.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * SQL files are not compiled, so a dist build finds them back in src/. The
 * repo always ships alongside the build on the target hosts, making the
 * fallback safe; a packaged-only deploy would need a copy step instead.
 */
export function sqlDir(name: string): string {
  const local = path.join(__dirname, name)
  if (fs.existsSync(local)) return local
  return path.join(__dirname, '..', '..', 'src', 'db', name)
}

const MIGRATIONS_TABLE = 'pp_migrations'

const CREATE_TABLE_SQL = `
  create table if not exists ${MIGRATIONS_TABLE} (
    version  integer primary key,
    name     text not null,
    applied_at timestamptz not null default now()
  )
`

export async function runMigrations(): Promise<{ applied: number; skipped: number }> {
  const pool = getPool()
  const client = await pool.connect()

  try {
    await client.query(CREATE_TABLE_SQL)

    const { rows: appliedRows } = await client.query<{ version: number }>(
      `select version from ${MIGRATIONS_TABLE} order by version`,
    )
    const applied = new Set(appliedRows.map((r) => r.version))

    const dir = sqlDir('migrations')
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^\d{3}-.+\.sql$/.test(f))
      .sort()

    let appliedNow = 0
    let skipped = 0

    for (const file of files) {
      const version = parseInt(file.slice(0, 3), 10)
      if (applied.has(version)) {
        skipped++
        continue
      }

      const sql = fs.readFileSync(path.join(dir, file), 'utf8')
      logger.info({ version, file }, 'applying migration')

      await client.query('begin')
      try {
        await client.query(sql)
        await client.query(
          `insert into ${MIGRATIONS_TABLE} (version, name) values ($1, $2)`,
          [version, file],
        )
        await client.query('commit')
        appliedNow++
      } catch (err) {
        await client.query('rollback')
        throw err
      }
    }

    logger.info({ applied: appliedNow, skipped }, 'migrations complete')
    return { applied: appliedNow, skipped }
  } finally {
    client.release()
  }
}

// Allow `npm run migrate` to invoke this directly. The comparison goes
// through pathToFileURL because a raw `file://${argv[1]}` never matches on
// Windows (backslashes, drive letters and percent-encoding all differ).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = loadEnv()
  initPool(env.DATABASE_URL)
  runMigrations()
    .then(({ applied, skipped }) => {
      logger.info({ applied, skipped }, 'migration run finished')
      process.exit(0)
    })
    .catch((err) => {
      logger.error({ err }, 'migration run failed')
      process.exit(1)
    })
}
