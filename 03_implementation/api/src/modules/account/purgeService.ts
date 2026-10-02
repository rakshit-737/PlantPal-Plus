/**
 * Erasure sweep — FR-ACC-22, wired to node-cron.
 *
 * Hourly rather than per-tick (BR-ACC-20 clause 4): the deadline being met to
 * the hour is what the promise says, and an account that waits 59 extra minutes
 * has not had its deletion denied. Running it on the reminder's five-minute
 * cadence would spend twelve times the database round trips to buy nothing.
 *
 * RSK-01 applies here as it does to reminders — a sleeping free-tier instance
 * fires no cron. The mitigation is the same keep-alive ping, and the failure
 * mode is the gentler one: a missed hour delays an erasure, and the next tick
 * picks the account up because the sweep re-derives everything it needs from
 * `purge_after` rather than from a cursor it has to remember.
 */

import cron from 'node-cron'

import { env } from '../../config/env.ts'
import { logger } from '../../logging.ts'
import { findAccountsDueForPurge, purgeAccount, PURGE_BATCH_CEILING } from './purgeRepo.ts'

/** Top of every hour. */
export const PURGE_CRON = '0 * * * *'

export interface PurgePassResult {
  /** Accounts the scan found due. */
  due: number
  /** Accounts actually erased this pass. */
  erased: number
  /** Accounts skipped because a cancellation won the race for the row lock. */
  skipped: number
  /** Accounts whose transaction threw; each is retried on the next run. */
  failed: number
  /** Row counts summed across every account erased, per table. */
  counts: Record<string, number>
}

/**
 * The HMAC key behind every retained tombstone (BR-ACC-20 Table I).
 *
 * Falling back to the access-token secret keeps a deployment that never set
 * `AUDIT_PEPPER` from writing tombstones under an empty key — which would make
 * the "anonymised" subject a plain, reversible SHA-256 of the user id. Both
 * values are already 32+ characters, secret, and per-deployment, so the
 * fallback is a real key rather than a placeholder. Rotating either one only
 * breaks correlation *between* old and new tombstones; nothing reads a subject
 * back to an identifier, because nothing can.
 */
function pepper(): string {
  const config = env()
  return config.AUDIT_PEPPER ?? config.JWT_ACCESS_SECRET
}

/**
 * One sweep. Each account is erased in its own transaction, so a single
 * failure — a lock timeout, a dropped connection — costs that account a delay
 * of one hour and leaves the rest of the batch erased (rule 7: idempotent and
 * resumable). Aborting the whole batch on the first error would let one stuck
 * account hold every other deletion open indefinitely.
 */
export async function runPurgePass(limit = PURGE_BATCH_CEILING): Promise<PurgePassResult> {
  const due = await findAccountsDueForPurge(limit)
  const result: PurgePassResult = { due: due.length, erased: 0, skipped: 0, failed: 0, counts: {} }
  if (due.length === 0) return result

  const key = pepper()
  for (const account of due) {
    try {
      const outcome = await purgeAccount(account, key)
      if (!outcome.erased) {
        result.skipped++
        continue
      }
      result.erased++
      for (const [table, n] of Object.entries(outcome.counts)) {
        result.counts[table] = (result.counts[table] ?? 0) + n
      }
    } catch (err) {
      // No identifier in this log line: the account is mid-erasure and may be
      // gone by the time anyone reads it. The count is the operational signal;
      // a stuck account shows up as a `failed` that never returns to zero.
      result.failed++
      logger.error({ err }, 'account erasure failed; will retry on the next sweep')
    }
  }

  logger.info(result, 'account erasure sweep complete')
  return result
}

let task: ReturnType<typeof cron.schedule> | null = null

export function startPurgeJob(): void {
  if (task) return
  task = cron.schedule(PURGE_CRON, () => {
    void runPurgePass()
      .catch((err) => {
        // A failed sweep must never take the process down; the next hour retries.
        logger.error({ err }, 'account erasure sweep failed')
      })
  })
  logger.info({ cron: PURGE_CRON, batchCeiling: PURGE_BATCH_CEILING }, 'account erasure sweep started')
}

export function stopPurgeJob(): void {
  if (task) {
    void task.stop()
    task = null
  }
}
