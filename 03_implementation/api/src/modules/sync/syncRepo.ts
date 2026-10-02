/**
 * Sync outbox repository — ENT-24 (SyncEvent).
 *
 * References: migrations/006-sync-schema.sql, FR-SYS-02/03, D-04.
 *
 * The sync_events table is the durable record of ingest. The unique constraint
 * on (user_id, client_idempotency_key) is the idempotency guarantee: a replayed
 * key collides there and the stored outcome is returned instead of reprocessing.
 */

import { getPool } from '../../db/pool.ts'

export interface SyncEventRow {
  id: string
  client_idempotency_key: string
  entity_type: string
  status: 'PENDING' | 'PROCESSED' | 'FAILED'
  result_entity_id: string | null
  error_code: string | null
}

/**
 * Record an incoming event. Returns the row plus whether it already existed —
 * an existing row means this key was ingested before and its stored outcome
 * must be returned without touching the destination tables again (FR-SYS-03).
 */
export async function recordEvent(
  userId: string,
  key: string,
  entityType: string,
  payload: unknown,
): Promise<{ row: SyncEventRow; replay: boolean }> {
  const pool = getPool()
  const { rows } = await pool.query<SyncEventRow>(
    `insert into sync_events (user_id, client_idempotency_key, entity_type, payload)
     values ($1, $2, $3, $4)
     on conflict (user_id, client_idempotency_key) do nothing
     returning id, client_idempotency_key, entity_type, status, result_entity_id, error_code`,
    [userId, key, entityType, JSON.stringify(payload)],
  )
  const inserted = rows[0]
  if (inserted) return { row: inserted, replay: false }

  const { rows: existing } = await pool.query<SyncEventRow>(
    `select id, client_idempotency_key, entity_type, status, result_entity_id, error_code
     from sync_events
     where user_id = $1 and client_idempotency_key = $2`,
    [userId, key],
  )
  const row = existing[0]
  if (!row) throw new Error('sync_events upsert returned neither insert nor existing row')
  return { row, replay: true }
}

export async function markProcessed(id: string, resultEntityId: string | null): Promise<void> {
  const pool = getPool()
  await pool.query(
    `update sync_events
     set status = 'PROCESSED', result_entity_id = $2, processed_at = now()
     where id = $1`,
    [id, resultEntityId],
  )
}

export async function markFailed(id: string, code: string, detail: string): Promise<void> {
  const pool = getPool()
  await pool.query(
    `update sync_events
     set status = 'FAILED', error_code = $2, error_detail = $3, processed_at = now()
     where id = $1`,
    [id, code.slice(0, 60), detail.slice(0, 500)],
  )
}

/** Look up a destination row by its idempotency key (for replay reconciliation). */
export async function findEntityIdByKey(
  table: 'plant_care_events' | 'workouts' | 'meals' | 'water_logs',
  userId: string,
  key: string,
): Promise<string | null> {
  const pool = getPool()
  const { rows } = await pool.query<{ id: string }>(
    // Table name comes from the closed union above, never from input.
    `select id from ${table} where user_id = $1 and client_idempotency_key = $2`,
    [userId, key],
  )
  return rows[0]?.id ?? null
}
