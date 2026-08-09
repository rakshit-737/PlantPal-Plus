/**
 * Single database pool for the process.
 *
 * The free-tier host (CON-01) provides one process on a 512 MB instance. A
 * single pool recycled across every module avoids the N-connection overhead
 * that would come from a pool-per-module approach.
 */

import pg from 'pg'

let pool: pg.Pool | undefined

export function initPool(connectionString: string, max = 10): pg.Pool {
  pool = new pg.Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    // Hosted Postgres (Supabase/Neon) can pause or cold-start when idle; the
    // first connect after a pause can exceed 5s. 15s covers the wake without
    // masking a genuinely unreachable database for long.
    connectionTimeoutMillis: 15_000,
  })
  pool.on('error', (err) => {
    // Pool emits `error` on an idle client that the database terminated behind
    // us. This is a routine free-tier event (serverless database suspends
    // idle connections). Log it rather than crashing.
    console.error({ err }, 'postgres pool client error')
  })
  return pool
}

export function getPool(): pg.Pool {
  if (!pool) throw new Error('Database pool not initialised. Call initPool() at boot.')
  return pool
}

/**
 * Run `fn` inside a single transaction on one dedicated client.
 *
 * Callers must use the client passed in rather than the pool: a query issued
 * against the pool inside this callback would be checked out on a *different*
 * connection and would therefore run outside the transaction, silently escaping
 * the rollback.
 *
 * The client is released in `finally` so a throw cannot leak a connection — on a
 * 512 MB free-tier instance with a pool of 10, leaking a handful exhausts it.
 */
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // The connection may already be dead, in which case the server has
      // discarded the transaction anyway. Surface the original error, not this one.
    }
    throw err
  } finally {
    client.release()
  }
}

/** Test seam. */
export function setPoolForTesting(p: pg.Pool): void {
  pool = p
}