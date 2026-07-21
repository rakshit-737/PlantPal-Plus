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
import { fileURLToPath } from 'node:url'

import { getPool } from './pool.js'
import { logger } from '../logging.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

    const dir = path.join(__dirname, 'migrations')
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