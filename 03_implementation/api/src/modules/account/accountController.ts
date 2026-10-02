/**
 * Account controller — the deletion grace window (FR-ACC-21, BR-ACC-20).
 *
 * Three authenticated endpoints, all operating on the token subject alone
 * (FR-ACC-23: no account identifier is ever accepted from the request):
 *
 *   GET    /api/v1/account          — current status and the countdown instants
 *   POST   /api/v1/account/deletion — schedule deletion, 30-day grace; requires
 *                                     the account password as a step-up
 *                                     re-authentication (FR-ACC-21 rule 1)
 *   DELETE /api/v1/account/deletion — cancel it, restoring the previous state
 *
 * Only the destructive direction is gated. Cancelling stays on the access token
 * alone: it restores the account rather than harming it, and putting a password
 * in front of the undo is exactly how a 30-day grace window gets missed.
 *
 * Nothing here erases anything. The account stays fully usable for the whole
 * window (BR-ACC-20 clause 2) and the irreversible sweep is FR-ACC-22's job.
 */

import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

import { AppError } from '../../http/errors.ts'
import { getUserId } from '../../http/requestUser.ts'
import { findPasswordHashById } from '../auth/authRepo.ts'
import { verifyPassword } from '../auth/password.ts'
import {
  cancelDeletion,
  getAccountState,
  requestDeletion,
  type AccountStateRow,
} from './accountRepo.ts'

/**
 * The confirmation body.
 *
 * `password` is FR-ACC-21 rule 1's step-up re-authentication. A valid access
 * token alone is not enough to schedule a deletion: the token is a bearer
 * credential with a 15-minute life that an unlocked phone or a hijacked session
 * hands over wholesale, and this endpoint revokes every other session and starts
 * an irreversible 30-day countdown. Proof of the password re-establishes that
 * the human at the keyboard is the account owner.
 *
 * Still `.strict()`. FR-ACC-21 additionally specifies a `confirmation_phrase` of
 * `DELETE` and an anonymised `reason`, neither of which this endpoint implements
 * and neither of which has anywhere to be stored yet. Accepting and silently
 * discarding them would make a client look confirmed when it is not; rejecting
 * them makes the gap loud the first time a client tries to send one.
 *
 * No `PASSWORD_MIN_LENGTH` check here: the policy bounds what may be *set*, and
 * applying it to a submitted password would reject — with a validation error
 * that names the length — every account whose password predates the current
 * policy. Any non-empty string is forwarded to the hash comparison, which is the
 * only thing that decides.
 */
const requestDeletionSchema = z
  .object({ password: z.string().min(1, 'Your password is required to confirm deletion.') })
  .strict()

/** Validation details in the shape the FR-SYS-19 envelope carries. */
function validationError(error: z.ZodError): AppError {
  return new AppError('VALIDATION_FAILED', 'The request failed validation.', {
    details: error.issues.slice(0, 10).map((i) => ({
      field: i.path.join('.') || '(root)',
      issue: i.message,
    })),
  })
}

/**
 * The session the caller is holding, as stamped by the `authenticate`
 * middleware from the access token's `sid` claim.
 *
 * FR-ACC-21 rule 3 revokes every session except this one, so the value reaches
 * SQL as a uuid parameter and is shape-checked here rather than trusted: an
 * unparseable value would otherwise surface as a 22P02 from Postgres, i.e. a
 * 500 on a request that should simply revoke everything. Read locally rather
 * than added to http/requestUser.ts — that helper is shared by every module and
 * this is the only caller that needs `sid`.
 */
function callerSessionId(req: Request): string | null {
  const raw = (req as { sessionId?: unknown }).sessionId
  const parsed = z.string().uuid().safeParse(raw)
  return parsed.success ? parsed.data : null
}

interface AccountStateBody {
  status: string
  deletion_requested_at: string | null
  purge_after: string | null
  /**
   * Alias of `purge_after` under the name FR-ACC-21 and the login response use
   * (`account_pending_deletion` / `deletion_scheduled_at`), so a client reads
   * one field name across both surfaces.
   */
  deletion_scheduled_at: string | null
}

/** Timestamps are serialised here, not in the repo, so the wire format is one decision. */
function toBody(state: AccountStateRow): AccountStateBody {
  const purgeAfter = state.purge_after?.toISOString() ?? null
  return {
    status: state.status,
    deletion_requested_at: state.deletion_requested_at?.toISOString() ?? null,
    purge_after: purgeAfter,
    deletion_scheduled_at: purgeAfter,
  }
}

/**
 * A valid token whose user row has gone means the FR-ACC-22 sweep has run.
 * The closed error registry has no ACC_ACCOUNT_DELETED code, and `GET
 * /auth/me` already answers this exact situation with AUTHENTICATION_REQUIRED —
 * which is also the signal that makes the client drop its tokens and sign out.
 */
function accountGone(): AppError {
  return new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.')
}

export async function getAccountHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const state = await getAccountState(getUserId(req))
    if (!state) throw accountGone()
    res.status(200).json(toBody(state))
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/account/deletion — FR-ACC-21.
 *
 * Idempotent: a repeat confirmation returns the window that is already running,
 * flagged with `already_pending`, and never re-stamps the instants. The
 * specification's alternate flow lists HTTP 409 `ACC_ALREADY_PENDING_DELETION`
 * for this case; 200 is returned instead so a retried or double-tapped
 * confirmation is not surfaced to the user as a failure, and the response still
 * distinguishes the two outcomes for any client that cares.
 *
 * Step-up first, repository second (FR-ACC-21 rule 1): a failed
 * re-authentication must not reach `requestDeletion`, which revokes sessions and
 * stamps the window as its very first act and offers no way back.
 */
export async function requestDeletionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = requestDeletionSchema.safeParse(req.body ?? {})
    if (!parsed.success) throw validationError(parsed.error)

    const userId = getUserId(req)

    // FR-ACC-21 rule 1 — re-authenticate before anything destructive happens.
    // The hash is fetched through a narrow auth-module query rather than added
    // to this module's `ACCOUNT_STATE_COLUMNS`, so a credential hash never
    // shares a row shape with anything the account endpoint serialises.
    const credential = await findPasswordHashById(userId)
    if (!credential) throw accountGone()
    if (credential.password_hash === null) {
      // Not reachable today — every account is created with a password — but an
      // OAuth-only account would have no secret to prove. VALIDATION_FAILED,
      // not INVALID_CREDENTIALS: nothing the caller sent was wrong, the
      // re-authentication this endpoint requires simply cannot be performed, and
      // saying so is safe because the caller is already authenticated as the
      // owner of this exact account (no enumeration surface, contrast BR-ACC-10).
      throw new AppError('VALIDATION_FAILED', 'The request failed validation.', {
        details: [{ field: 'password', issue: 'password_required_but_account_has_none' }],
      })
    }
    if (!(await verifyPassword(parsed.data.password, credential.password_hash))) {
      // The same code the login path returns for a bad password. The registry is
      // closed (BR-SYS-28) and a step-up failure is exactly an authentication
      // failure, so no new code is minted for it.
      throw new AppError('INVALID_CREDENTIALS', 'That password is not right.')
    }

    const outcome = await requestDeletion(userId, callerSessionId(req))
    if (outcome.kind === 'missing') throw accountGone()

    res.status(200).json({
      ...toBody(outcome.state),
      already_pending: outcome.kind === 'already_pending',
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/account/deletion — the cancellation of BR-ACC-20 clause 3,
 * and what the web Settings `?recover=1` flow calls.
 */
export async function cancelDeletionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const outcome = await cancelDeletion(getUserId(req))
    if (outcome.kind === 'missing') throw accountGone()
    if (outcome.kind === 'not_pending') {
      // 409: the request is well-formed and authorised but conflicts with the
      // account's current state. Not 404 — the caller owns this account and
      // knows it exists, so there is nothing to hide (contrast BR-ACC-01).
      throw new AppError('CONFLICT', 'This account is not scheduled for deletion.')
    }
    res.status(200).json(toBody(outcome.state))
  } catch (err) {
    next(err)
  }
}
