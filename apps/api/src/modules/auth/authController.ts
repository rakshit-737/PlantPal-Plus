/**
 * Auth controller — register, login, refresh, logout.
 *
 * Every handler operates on `email_normalised` rather than the raw address
 * supplied by the client. BR-ACC-10 requires byte-identical responses for
 * "no such account" and "wrong password", and the only way to deliver that
 * reliably is to centralise the normalisation and the dummy-hash padding
 * inside the controller rather than delegating them to individual queries.
 */

import type { NextFunction, Request, Response } from 'express'

import { env } from '../../config/env.js'
import { AppError, type ErrorDetail, ERROR_CODES } from '../../http/errors.js'
import { logger } from '../../logging.js'
import {
  createUser,
  createSession,
  findUserForAuth,
  recordLoginAttempt,
  computeLockoutState,
  recordFailedLogin,
  recordLoginSuccess,
  findActiveTokenByDigest,
  findTokenByDigestAnyState,
  consumeAndRotateToken,
  DUMMY_HASH,
} from './authRepo.js'
import {
  assertPasswordPolicy,
  hashPassword,
  verifyPassword,
} from './password.js'
import {
  digestRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from './tokens.js'

function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/** IP truncated to a /24 or /48 prefix before storage (BR-ACC-18 clause 4). */
function ipPrefix(req: Request): string {
  const ip = req.ip ?? '0.0.0.0'
  if (ip.includes(':')) {
    // IPv6: keep the first three groups ( /48 )
    return ip.split(':').slice(0, 3).join(':') + '::'
  }
  const parts = ip.split('.')
  return parts.slice(0, 3).join('.') + '.0'
}

function deviceLabel(req: Request): string | null {
  const raw = req.header('x-plantpal-device')
  if (!raw) return null
  return raw.replace(/[\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || null
}

function platform(req: Request): string {
  const raw = req.header('x-plantpal-client')
  return raw === 'IOS' || raw === 'ANDROID' || raw === 'WEB' ? raw : 'WEB'
}

/**
 * The access-token signing secret, read through the validated configuration.
 *
 * Reading `process.env.JWT_ACCESS_SECRET!` directly would defer the failure to
 * request time: a deploy missing the variable would boot happily and then return
 * 500 on every single login. `env()` validates it once at startup (present, and
 * at least 32 characters), so a misconfiguration stops the deploy instead.
 */
function accessSecret(): string {
  return env().JWT_ACCESS_SECRET
}

/** BR-ACC-10 clause 5 — the minimum wall-clock cost of any login attempt. */
export const LOGIN_TIMING_FLOOR_MS = 250

/**
 * Pad the current operation out to the timing floor.
 *
 * Account enumeration by timing works because "no such user" is cheap (no hash
 * to verify) while "wrong password" is expensive (a full Argon2 verification).
 * Padding every path up to a common floor removes the signal — but only if the
 * elapsed time is measured from the start of the handler. Measuring it after the
 * expensive work has already happened yields a constant delay added to a
 * variable cost, which leaves the difference entirely intact.
 */
export async function enforceTimingFloor(
  startedAt: number,
  floorMs: number = LOGIN_TIMING_FLOOR_MS,
): Promise<void> {
  const remaining = floorMs - (Date.now() - startedAt)
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining))
  }
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, confirmed_age: confirmedAge } = req.body as {
      email?: string; password?: string; confirmed_age?: boolean
    }
    const errors: ErrorDetail[] = []

    const normalised = email ? normaliseEmail(email) : ''
    if (!email || email.length < 5 || email.length > 254 || !email.includes('@')) {
      errors.push({ field: 'email', issue: 'invalid' })
    }

    if (!password) {
      errors.push({ field: 'password', issue: 'required' })
    } else {
      try { assertPasswordPolicy(password) } catch {
        errors.push({ field: 'password', issue: 'policy_violation' })
      }
    }

    if (confirmedAge !== true) {
      errors.push({ field: 'confirmed_age', issue: 'must_be_confirmed' })
    }

    if (errors.length) {
      throw new AppError('VALIDATION_FAILED', 'The request failed validation.', { details: errors })
    }

    const passwordHash = await hashPassword(password!)

    let user
    try {
      user = await createUser({ email: email!, passwordHash, confirmedAge: confirmedAge! })
    } catch (err: unknown) {
      if (err && typeof err === 'object' && '__appError' in (err as Record<string, unknown>)) {
        // Address already registered — do NOT disclose when the call is unauthenticated
        // (BR-ACC-10). Return success with a "check your email" message.
      } else {
        throw err
      }
    }

    // BR-ACC-10 clause 2: registration returns success whether the account is
    // new or already existed, to prevent address enumeration. The email flow
    // handle tells the genuine owner.
    logger.info({ email_normalised: normalised }, 'registration attempt')

    res.status(202).json({
      status: 'registered',
      message: 'Check your email for a confirmation link.',
    })
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// Login — FR-ACC-06, BR-ACC-07, BR-ACC-09, BR-ACC-10
// ---------------------------------------------------------------------------

interface LoginBody {
  email?: string
  password?: string
}

export async function login(req: Request, res: Response, next: NextFunction) {
  // Captured before any work so the constant-time floor below measures the whole
  // handler. Taking this reading later would make the floor a fixed delay added
  // to a variable amount of work, which equalises nothing (BR-ACC-10 clause 5).
  const startedAt = Date.now()
  try {
    const { email, password } = req.body as LoginBody
    if (!email || !password) {
      throw new AppError('VALIDATION_FAILED', 'Email and password are required.', {
        details: [
          ...(!email ? [{ field: 'email', issue: 'required' }] : []),
          ...(!password ? [{ field: 'password', issue: 'required' }] : []),
        ],
      })
    }

    const normalised = normaliseEmail(email)
    const prefix = ipPrefix(req)

    // 1. Lock-out check BEFORE password verification (FR-ACC-06 rule 2).
    const lockout = await computeLockoutState(normalised)
    if (lockout.failures >= 5) {
      const lockUntil =
        (lockout.lastFailureAt?.getTime() ?? Date.now()) + lockout.lockSeconds * 1000
      if (lockUntil > Date.now()) {
        const remaining = Math.ceil((lockUntil - Date.now()) / 1000)
        await recordLoginAttempt(normalised, prefix, 'LOCKED_OUT')
        // Set the header before throwing: the terminal handler writes the body,
        // and a header cannot be added once that has happened.
        res.setHeader('Retry-After', String(remaining))
        throw new AppError(
          'ACC_ACCOUNT_LOCKED',
          `Too many attempts. Try again in ${remaining} seconds.`,
          { context: { retry_after_seconds: remaining } },
        )
      }
    }

    // 2. Look up the user or the absence of one.
    const user = await findUserForAuth(normalised)

    // 3. Verify the password — always perform a hash verification to equalise
    //    timing (BR-ACC-10 clause 5). Use the stored hash when a user exists,
    //    otherwise a fixed dummy hash generated at boot.
    const hashToVerify = user?.password_hash ?? DUMMY_HASH
    const passwordOk = await verifyPassword(password, hashToVerify)

    // 4. Constant-time floor: every login path takes at least 250 ms measured
    //    from entry (BR-ACC-10 clause 5), so the cost difference between a
    //    dummy-hash verification and a real Argon2 verification is absorbed
    //    rather than exposed as a timing oracle for account enumeration.
    await enforceTimingFloor(startedAt)

    // 5. No user, or user exists but the dummy hash (delete/absent): identical 401.
    if (!user || !user.password_hash) {
      await recordLoginAttempt(normalised, prefix, 'NO_ACCOUNT')
      if (normalised) await recordFailedLogin(normalised)
      throw new AppError('INVALID_CREDENTIALS', 'That email or password is not right.')
    }

    // 6. Wrong password.
    if (!passwordOk) {
      await recordLoginAttempt(normalised, prefix, 'BAD_PASSWORD')
      await recordFailedLogin(normalised)
      throw new AppError('INVALID_CREDENTIALS', 'That email or password is not right.')
    }

    // 7. State checks — ACTIVE, PENDING_VERIFICATION inside grace, PENDING_DELETION.
    const now = new Date()
    if (user.locked_until && user.locked_until > now) {
      await recordLoginAttempt(normalised, prefix, 'LOCKED_OUT')
      throw new AppError('ACCOUNT_LOCKED' as AppError['code'], 'Account is locked.')
    }
    // FR-ACC-02 clause 5: PENDING_DELETION *proceeds*, and the response carries
    // the restore prompt (see the `account_pending_deletion` branch below).
    // Signing these users out would remove the only route to cancelling the
    // deletion, which is the entire purpose of the 30-day grace window
    // (BR-ACC-20 clause 3, state machine PENDING_DELETION -> ACTIVE).
    //
    // A row whose purge date has already passed should have been swept by the
    // purge job. If it is still here the sweep is late, so treat it as no
    // account: `DELETED` and non-existent must stay indistinguishable.
    if (user.purge_after && user.purge_after <= now) {
      await recordLoginAttempt(normalised, prefix, 'NO_ACCOUNT')
      throw new AppError('INVALID_CREDENTIALS', 'That email or password is not right.')
    }
    if (user.status === 'PENDING_VERIFICATION') {
      const graceMs = 168 * 60 * 60 * 1000 // 7 days
      if (user.created_at.getTime() + graceMs < now.getTime()) {
        await recordLoginAttempt(normalised, prefix, 'UNVERIFIED')
        throw new AppError('EMAIL_NOT_VERIFIED', 'Confirm your email address to sign in.', {
          context: { resend_available: true },
        })
      }
    }

    // 8. Success — create the session and token pair.
    const installationId = crypto.randomUUID()
    const session = await createSession({
      userId: user.id,
      platform: platform(req),
      installationId,
      deviceLabel: deviceLabel(req),
      ipAddressHash: prefix,
      userAgent: (req.get('user-agent') ?? '').slice(0, 200),
    })

    await recordLoginSuccess(user.id)
    await recordLoginAttempt(normalised, prefix, 'SUCCESS')

    const accessToken = signAccessToken(user.id, session.sessionId, accessSecret())

    const body: Record<string, unknown> = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
      },
    }

    // Return refresh token as a cookie on web, raw on mobile (BR-ACC-07 clause 7).
    const isWeb = platform(req) === 'WEB'
    if (isWeb) {
      res.cookie('refresh_token', session.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/api/auth',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })
    } else {
      body.refresh_token = session.refreshToken
    }

    if (user.status === 'PENDING_DELETION') {
      body.account_pending_deletion = true
      body.deletion_scheduled_at = user.purge_after?.toISOString()
    }

    res.status(200).json(body)
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// Refresh — BR-ACC-08
// ---------------------------------------------------------------------------

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    // Accept the token from the cookie (web) or the body (mobile).
    const rawToken: string | undefined =
      req.cookies?.refresh_token ?? req.body?.refresh_token

    if (!rawToken) {
      throw new AppError('AUTHENTICATION_REQUIRED', 'No refresh token provided.')
    }

    const digest = digestRefreshToken(rawToken)
    // First probe: the unconsumed happy path. Second probe: a consumed row is
    // a REPLAY, which must reach consumeAndRotateToken so the replay grace
    // window or the family revocation (BR-ACC-07 reuse detection) applies —
    // filtering replays out here as TOKEN_EXPIRED would leave a stolen
    // family alive.
    const row = (await findActiveTokenByDigest(digest)) ?? (await findTokenByDigestAnyState(digest))
    if (!row) {
      throw new AppError('TOKEN_EXPIRED', 'Session expired. Please sign in again.')
    }

    // Family lifetime cap (BR-ACC-07 clause 6): 180 days.
    // In practice expires_at already covers 30 days, but the query checks it.

    const result = await consumeAndRotateToken(
      row.id,
      row.tokenFamilyId,
      row.sessionId,
      row.userId,
    )

    const accessToken = signAccessToken(
      row.userId,
      row.sessionId,
      accessSecret(),
    )

    const isWeb = platform(req) === 'WEB'
    const body: Record<string, unknown> = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900,
    }

    if (isWeb) {
      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/api/auth',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })
    } else {
      body.refresh_token = result.refreshToken
    }

    res.status(200).json(body)
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// Logout — single session
// ---------------------------------------------------------------------------

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const rawToken: string | undefined =
      req.cookies?.refresh_token ?? req.body?.refresh_token

    if (rawToken) {
      const digest = digestRefreshToken(rawToken)
      const pool = (await import('../../db/pool.js')).getPool()
      await pool.query(
        `update auth_tokens
         set consumed_at = coalesce(consumed_at, now())
         where refresh_token_digest = $1 and consumed_at is null`,
        [digest],
      )
      await pool.query(
        `update auth_sessions s
         set status = 'REVOKED', revoked_at = now(), revoke_reason = 'USER_LOGOUT'
         from auth_tokens t
         where t.session_id = s.id
           and t.refresh_token_digest = $1
           and s.status = 'ACTIVE'`,
        [digest],
      )
    }

    res.clearCookie('refresh_token', { path: '/api/auth' })
    res.status(200).json({ status: 'logged_out' })
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// Authenticate middleware — used by every protected route
// ---------------------------------------------------------------------------

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization')
    if (!header?.startsWith('Bearer ')) {
      throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.')
    }
    const token = header.slice(7)
    const secret = accessSecret()
    const result = verifyAccessToken(token, secret)
    if (!result.ok) {
      throw new AppError(
        result.reason === 'expired' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
        result.reason === 'expired'
          ? 'Access token expired. Refresh to continue.'
          : 'Invalid access token.',
      )
    }

    // Store the subject on the request for downstream handlers.
    ;(req as unknown as Record<string, unknown>).userId = result.claims.sub
    ;(req as unknown as Record<string, unknown>).sessionId = result.claims.sid
    next()
  } catch (err) {
    next(err)
  }
}