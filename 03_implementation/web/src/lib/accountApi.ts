/**
 * Typed wrappers over /api/v1/account — the deletion grace window (FR-ACC-21).
 *
 * Nothing here erases anything. Scheduling deletion starts a 30-day countdown
 * during which the account stays fully usable; cancelling clears it. The
 * irreversible sweep is a server-side job, not a request the client can make.
 *
 * Every route acts on the token subject alone: no account identifier is ever
 * sent, so there is no id to get wrong.
 */
import { apiRequest } from './apiClient'

/** The account lifecycle states, mirroring the users.status check constraint. */
export type AccountStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'LOCKED' | 'PENDING_DELETION'

export interface AccountState {
  status: AccountStatus
  /** ISO instant the deletion was requested, or null when none is scheduled. */
  deletion_requested_at: string | null
  /** ISO instant after which the sweep erases the account, or null. */
  purge_after: string | null
  /**
   * The same instant as `purge_after` under the name the login response uses.
   * Read either; they are one value with two names on the wire.
   */
  deletion_scheduled_at: string | null
}

export interface DeletionScheduled extends AccountState {
  /** True when a window was already running — the instants were not re-stamped. */
  already_pending: boolean
}

export const getAccount = () => apiRequest<AccountState>('/v1/account')

/**
 * Schedule deletion, re-proving the caller owns the account.
 *
 * The endpoint takes a step-up: `{ password }` and nothing else — the schema is
 * strict, so the typed-DELETE confirmation phrase must NOT be sent. That
 * ceremony stays a client-side guard against a mis-click; the password is what
 * the server actually verifies, against the caller's stored hash.
 *
 * Rejections worth branching on:
 *  - INVALID_CREDENTIALS (401) — the password is wrong. Note this shares a
 *    status with an expired session, so branch on `code`, never on `status`.
 *    apiClient only silent-refreshes TOKEN_EXPIRED, so this reaches the caller
 *    unretried.
 *  - VALIDATION_FAILED (422) with field `password` — the account has no stored
 *    password hash (OAuth-only; not reachable today).
 *
 * Everything else is unchanged: the call is idempotent, and re-requesting a
 * window that is already running returns `already_pending: true` with the
 * original instants rather than re-stamping them.
 */
export const requestAccountDeletion = (password: string) =>
  apiRequest<DeletionScheduled>('/v1/account/deletion', {
    method: 'POST',
    body: { password },
  })

/**
 * Cancel a scheduled deletion. The restored status comes back in the response
 * and is NOT always ACTIVE — an account that never verified its email returns
 * to PENDING_VERIFICATION. Read it from the response rather than assuming.
 *
 * Throws ApiError with code CONFLICT (409) when nothing was scheduled.
 */
export const cancelAccountDeletion = () =>
  apiRequest<AccountState>('/v1/account/deletion', { method: 'DELETE' })
