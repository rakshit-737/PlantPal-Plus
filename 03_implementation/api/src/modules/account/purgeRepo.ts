/**
 * Erasure repository — FR-ACC-22, the irreversible half of the account
 * lifecycle that `accountRepo` deliberately refuses to hold.
 *
 * Everything reversible (status, `deletion_requested_at`, `purge_after`) lives
 * in `accountRepo`. This module is the only place in the codebase that can
 * remove a `users` row, and it is reachable from the scheduler alone — no route
 * mounts it. That separation is the point: a hard delete one mis-routed call
 * away from a request handler is a permanent-data-loss bug waiting to be
 * written.
 *
 * BR-ACC-20 clause 8 does the actual work: every user-scoped table declares
 * `user_id ... on delete cascade`, so erasing the account is one delete plus
 * the two rows the cascade cannot reach — `login_attempts`, keyed by email
 * rather than by user, and `audit_events`, which Table I retains in anonymised
 * form.
 */

import { createHmac } from 'node:crypto'

import { getPool, transaction } from '../../db/pool.ts'

/**
 * BR-ACC-20 clause 4 / FR-ACC-22 rule 1 — at most 100 accounts per run, oldest
 * first, so a backlog cannot exhaust the free tier's CPU envelope in one pass.
 */
export const PURGE_BATCH_CEILING = 100

/**
 * Table H, restated as the tables this sweep counts before erasing them.
 *
 * The rows go away through the cascade whether or not a table is listed here;
 * the list exists so the run can log per-table counts (FR-ACC-22 rule 7,
 * NFR-OBSV-01). A table added later and forgotten here is therefore an
 * observability gap, never a retention one — the failure mode is a missing
 * number in a log line, not a surviving row.
 *
 * Child tables (`meal_items`, `workout_sets`) are omitted: they carry no
 * `user_id` and cascade from their parent, so counting them would mean joining
 * back through it for a number the parent's count already implies.
 */
export const USER_SCOPED_TABLES: readonly { table: string; column: string }[] = Object.freeze([
  { table: 'profiles', column: 'user_id' },
  { table: 'user_settings', column: 'user_id' },
  { table: 'auth_sessions', column: 'user_id' },
  { table: 'auth_tokens', column: 'user_id' },
  { table: 'email_verification_tokens', column: 'user_id' },
  { table: 'password_reset_tokens', column: 'user_id' },
  { table: 'consent_records', column: 'user_id' },
  { table: 'device_push_tokens', column: 'user_id' },
  { table: 'plants', column: 'user_id' },
  { table: 'plant_care_events', column: 'user_id' },
  { table: 'growth_log_entries', column: 'user_id' },
  { table: 'workouts', column: 'user_id' },
  { table: 'personal_records', column: 'user_id' },
  { table: 'meals', column: 'user_id' },
  { table: 'water_logs', column: 'user_id' },
  { table: 'foods', column: 'created_by' },
  { table: 'reminders', column: 'user_id' },
  { table: 'streaks', column: 'user_id' },
  { table: 'user_achievements', column: 'user_id' },
  { table: 'sync_events', column: 'user_id' },
])

export interface DueAccount {
  id: string
  email_normalised: string
}

/**
 * Accounts whose grace period has elapsed, oldest first.
 *
 * `purge_after <= now()` is evaluated by PostgreSQL rather than by the process:
 * the sweep must agree with the login path (authController), which asks the
 * same question of the same clock. A Node-side `new Date()` would disagree with
 * it by whatever the container's drift happens to be.
 */
export async function findAccountsDueForPurge(
  limit: number = PURGE_BATCH_CEILING,
): Promise<DueAccount[]> {
  const { rows } = await getPool().query<DueAccount>(
    `select id, email_normalised
       from users
      where status = 'PENDING_DELETION'
        and purge_after is not null
        and purge_after <= now()
      order by purge_after asc
      limit $1`,
    [limit],
  )
  return rows
}

/**
 * BR-ACC-20 Table I — the subject of a retained audit row is
 * `HMAC-SHA256(server_pepper, user_id)`, never the identifier itself. A plain
 * hash would be reversible by anyone holding the user-id space (it is a UUID:
 * enumerable in principle, and in practice recoverable from any backup); the
 * keyed construction is what makes the tombstone non-identifying once the
 * account is gone.
 */
export function subjectHash(userId: string, pepper: string): string {
  return createHmac('sha256', pepper).update(userId).digest('hex')
}

export interface PurgeOutcome {
  /** False when the account was cancelled or already erased between the scan and the lock. */
  erased: boolean
  /** Per-table row counts, for the run's log line. Empty when `erased` is false. */
  counts: Record<string, number>
}

/**
 * Erase one account in a single transaction (FR-ACC-22 rule 3).
 *
 * The row is re-read `for update` inside the transaction and re-checked against
 * the same predicate the scan used. Without that lock a cancellation landing
 * between the scan and the delete would be silently overrun — the user would
 * cancel, receive a success response, and be erased seconds later. This is the
 * one operation in the product where losing that race is unrecoverable, so it
 * is checked twice rather than once.
 */
export async function purgeAccount(account: DueAccount, pepper: string): Promise<PurgeOutcome> {
  return transaction<PurgeOutcome>(async (client) => {
    const { rows: [locked] } = await client.query<{ id: string }>(
      `select id
         from users
        where id = $1
          and status = 'PENDING_DELETION'
          and purge_after is not null
          and purge_after <= now()
        for update`,
      [account.id],
    )
    if (!locked) return { erased: false, counts: {} }

    // One round trip for every count: 20 scalar subqueries cost far less than
    // 20 statements against a free-tier database an ocean away.
    const countSql = USER_SCOPED_TABLES.map(
      ({ table, column }, i) =>
        `(select count(*)::int from ${table} where ${column} = $1) as "t${i}"`,
    ).join(', ')
    const { rows: [countRow] } = await client.query<Record<string, number>>(
      `select ${countSql}`,
      [account.id],
    )
    const counts: Record<string, number> = {}
    USER_SCOPED_TABLES.forEach(({ table }, i) => {
      counts[table] = countRow?.[`t${i}`] ?? 0
    })

    const hash = subjectHash(account.id, pepper)

    // Table I: anonymise before the delete, not after. `audit_events.user_id`
    // is `on delete set null`, so deleting the user first would strip the link
    // this update needs to find the rows — they would survive as unattributable
    // rows still carrying the email in their payload, which is precisely the
    // personal datum clause 7 says is never retained.
    const { rowCount: anonymised } = await client.query(
      `update audit_events
          set user_id = null,
              payload = (payload - 'email' - 'email_normalised')
                        || jsonb_build_object('subject', $2::text)
        where user_id = $1`,
      [account.id, hash],
    )
    counts['audit_events_anonymised'] = anonymised ?? 0

    // BR-ACC-09 rows are keyed by address, not by user, so no cascade reaches
    // them. Clause 10 (the address is free to register again) depends on this:
    // leaving them would carry the erased account's lockout state onto whoever
    // registers that address next.
    const { rowCount: attempts } = await client.query(
      `delete from login_attempts where email_normalised = $1`,
      [account.email_normalised],
    )
    counts['login_attempts'] = attempts ?? 0

    await client.query(`delete from users where id = $1`, [account.id])
    counts['users'] = 1

    // Rule 5 — the evidence that the erasure happened, carrying counts and a
    // timestamp and no identifier. Written last so it cannot be anonymised by
    // the update above or removed by the cascade below it.
    await client.query(
      `insert into audit_events (user_id, event_type, payload)
       values (null, 'ACCOUNT_ERASED', $1::jsonb)`,
      [JSON.stringify({ subject: hash, rows: counts, erased_at: new Date().toISOString() })],
    )

    return { erased: true, counts }
  })
}
