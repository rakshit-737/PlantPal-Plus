/**
 * Account-lifecycle repository — FR-ACC-21 (request account deletion with a
 * grace period) and its cancellation.
 *
 * Everything here is a *soft*, reversible state change on three `users`
 * columns: `status`, `deletion_requested_at`, `purge_after`. The irreversible
 * half — FR-ACC-22's erasure sweep over BR-ACC-20 Table H — is a scheduler
 * concern and deliberately has no code path in this module. A request handler
 * that can hard-delete a user row is one mis-routed call away from permanent
 * data loss, so the capability simply does not exist here.
 *
 * The schema calls the sweep instant `purge_after` where the specification
 * calls it `deletion_scheduled_at` (001-auth-schema.sql vs FR-ACC-21). This
 * layer speaks the column names; the controller publishes both.
 */

import { getPool, transaction } from '../../db/pool.ts'

/**
 * BR-ACC-20 clause 1 — the grace period is exactly 30 days (2 592 000 s) from
 * `deletion_requested_at`. Held as a named constant so the window is stated
 * once and the SQL below binds it as a parameter.
 */
export const DELETION_GRACE_DAYS = 30

/** ENT-01 status values this module transitions between (001-auth-schema.sql). */
const STATUS_PENDING_DELETION = 'PENDING_DELETION'

export interface AccountStateRow {
  status: string
  deletion_requested_at: Date | null
  purge_after: Date | null
}

/**
 * The only user columns this module reads. Named explicitly rather than
 * `select *` so a future column addition — a credential hash, a token version —
 * cannot start leaking through the account endpoint by accident.
 */
const ACCOUNT_STATE_COLUMNS = 'status, deletion_requested_at, purge_after'

export async function getAccountState(userId: string): Promise<AccountStateRow | null> {
  const pool = getPool()
  const { rows } = await pool.query<AccountStateRow>(
    `select ${ACCOUNT_STATE_COLUMNS} from users where id = $1`,
    [userId],
  )
  return rows[0] ?? null
}

export type RequestDeletionOutcome =
  | { kind: 'scheduled'; state: AccountStateRow }
  /** Already inside the window; the original instants are returned untouched. */
  | { kind: 'already_pending'; state: AccountStateRow }
  | { kind: 'missing' }

/**
 * Move the account into PENDING_DELETION and stamp the grace window.
 *
 * Idempotent by construction: the row is locked and inspected first, and an
 * account already in PENDING_DELETION is returned as-is. Writing
 * `deletion_requested_at = now()` unconditionally would silently *extend* the
 * window on every repeat confirmation — a user who taps twice would have their
 * deletion date pushed out, which is the opposite of what BR-ACC-20 clause 1
 * promises ("exactly 30 days from deletion_requested_at").
 *
 * `for update` rather than a bare read: two concurrent confirmations would
 * otherwise both observe a non-pending row and both write a window, and the
 * later transaction's `now()` would win.
 */
export async function requestDeletion(
  userId: string,
  callerSessionId: string | null,
): Promise<RequestDeletionOutcome> {
  // Explicit generic: it gives the callback a contextual return type, so the
  // `kind` discriminants stay literal types rather than widening to `string`.
  return transaction<RequestDeletionOutcome>(async (client) => {
    const { rows: [current] } = await client.query<AccountStateRow>(
      `select ${ACCOUNT_STATE_COLUMNS} from users where id = $1 for update`,
      [userId],
    )
    if (!current) return { kind: 'missing' }
    if (current.status === STATUS_PENDING_DELETION) {
      return { kind: 'already_pending', state: current }
    }

    const { rows: [updated] } = await client.query<AccountStateRow>(
      `update users
       set status = 'PENDING_DELETION',
           deletion_requested_at = now(),
           -- An interval literal cannot carry a placeholder, so the window is
           -- bound as an integer and multiplied by a fixed unit interval.
           -- Interpolating the number into the statement text would be the
           -- concatenation shape the injection audit flagged, even for a value
           -- that never comes from the request.
           purge_after = now() + ($2::int * interval '1 day'),
           updated_at = now()
       -- No status guard needed: the row is held under the lock taken above,
       -- so it cannot have changed state or disappeared, and the update is
       -- therefore guaranteed to return exactly one row.
       where id = $1
       returning ${ACCOUNT_STATE_COLUMNS}`,
      [userId, DELETION_GRACE_DAYS],
    )

    // FR-ACC-21 rule 3 — revoke every session *except* the calling one, so the
    // decision cannot be made on one device and silently ignored on another.
    // The caller keeps its session because cancelling is only reachable while
    // authenticated (BR-ACC-20 clause 3); signing the requester out here would
    // put the undo behind a fresh login for no security gain.
    //
    // Only on the transition, never on a repeat confirmation: BR-ACC-20 clause
    // 2 keeps the account fully usable during the window, so sessions the owner
    // legitimately opened *after* requesting deletion must survive.
    //
    // A null caller session (no `sid` claim) degrades to revoking everything:
    // that is the conservative direction, and login still admits a
    // PENDING_DELETION account (FR-ACC-21, login path), so the undo survives.
    await client.query(
      `update auth_sessions
       set status = 'REVOKED', revoked_at = now(), revoke_reason = 'DELETION_REQUESTED'
       where user_id = $1
         and status = 'ACTIVE'
         and ($2::uuid is null or id <> $2::uuid)`,
      [userId, callerSessionId],
    )
    // Consume the revoked sessions' refresh tokens with the same idiom logout
    // uses, so a token whose session row was just revoked cannot be redeemed.
    await client.query(
      `update auth_tokens
       set consumed_at = coalesce(consumed_at, now())
       where user_id = $1
         and consumed_at is null
         and ($2::uuid is null or session_id <> $2::uuid)`,
      [userId, callerSessionId],
    )

    // `token_version` is deliberately NOT bumped. It is the revocation lever for
    // FR-ACC-11 (logout everywhere) and FR-ACC-13/14 (credential change); the
    // ENT-01 CRUD matrix assigns FR-ACC-21 only "sets PENDING_DELETION and the
    // deletion instants". Bumping it would also invalidate the requester's own
    // access token, i.e. it would sign the user out of the one session that can
    // still cancel.
    return { kind: 'scheduled', state: updated! }
  })
}

export type CancelDeletionOutcome =
  | { kind: 'cancelled'; state: AccountStateRow }
  /** Nothing to cancel — the caller's account is not in the grace window. */
  | { kind: 'not_pending'; state: AccountStateRow }
  | { kind: 'missing' }

/**
 * Cancel a pending deletion and clear the window.
 *
 * BR-ACC-20 clause 3 restores `state_before_deletion`, not a hard-coded ACTIVE:
 * an account that was PENDING_VERIFICATION when deletion was requested must
 * return to PENDING_VERIFICATION (accounts.md §"state machine"). ENT-01 has no
 * `state_before_deletion` column, so the prior state is *derived* from
 * `email_verified_at`, which FR-ACC-04 writes at the same moment it flips the
 * status to ACTIVE. LOCKED needs no handling: it is computed from
 * login_attempts rows and self-expires, never stored.
 *
 * Cancellation stays available even once `purge_after` has elapsed but the
 * sweep has not run — clause 3 grants it "at any time before the sweep
 * completes", and a late sweep must not silently cost someone their undo.
 */
export async function cancelDeletion(userId: string): Promise<CancelDeletionOutcome> {
  return transaction<CancelDeletionOutcome>(async (client) => {
    const { rows: [current] } = await client.query<AccountStateRow>(
      `select ${ACCOUNT_STATE_COLUMNS} from users where id = $1 for update`,
      [userId],
    )
    if (!current) return { kind: 'missing' }
    if (current.status !== STATUS_PENDING_DELETION) return { kind: 'not_pending', state: current }

    const { rows: [restored] } = await client.query<AccountStateRow>(
      `update users
       set status = case when email_verified_at is null then 'PENDING_VERIFICATION' else 'ACTIVE' end,
           deletion_requested_at = null,
           purge_after = null,
           updated_at = now()
       where id = $1 and status = 'PENDING_DELETION'
       returning ${ACCOUNT_STATE_COLUMNS}`,
      [userId],
    )
    return { kind: 'cancelled', state: restored! }
  })
}
