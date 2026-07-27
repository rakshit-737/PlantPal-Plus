/**
 * Auth repository — database operations for ENT-01 through ENT-07.
 *
 * Every query here operates on `email_normalised` rather than raw `email`,
 * because BR-ACC-10 requires that account existence is never disclosed through
 * timing, error-detail count or response content difference. The normalised
 * form makes that testable.
 */

import {
  digestRefreshToken,
  issueRefreshToken,
  MAX_ACTIVE_SESSIONS,
  refreshDigestsMatch,
  refreshTokenExpiresAt,
} from './tokens.js'
import { getPool, transaction } from '../../db/pool.js'
import type { PoolClient } from 'pg'

/* -----------------------------------------------------------------------
 * Registration
 * --------------------------------------------------------------------- */

export interface CreateUserInput {
  email: string
  passwordHash: string
  confirmedAge: boolean
}

export interface CreatedUser {
  id: string
  email: string
  status: string
}

export async function createUser(params: CreateUserInput): Promise<CreatedUser> {
  return await transaction(async (client) => {
    const emailNormalised = params.email.toLowerCase().trim()

    const { rows: [user] } = await client.query<CreatedUser>(
      `insert into users (email, email_normalised, password_hash, minimum_age_confirmed)
       values ($1, lower(trim($1)), $2, $3)
       on conflict (email_normalised) do nothing
       returning id, email, status`,
      [params.email, params.passwordHash, params.confirmedAge],
    )

    if (!user) {
      throw Object.assign(new Error('That email address is already registered.'), {
        code: 'CONFLICT',
        status: 409,
        __appError: true,
      })
    }

    // Create the profile with defaults.
    const displayName = params.email.split('@')[0]!.slice(0, 60)
    await client.query(
      `insert into profiles (user_id, display_name)
       values ($1, $2)`,
      [user.id, displayName],
    )

    // Create the settings with defaults.
    await client.query(
      `insert into user_settings (user_id) values ($1)`,
      [user.id],
    )

    return user
  })
}

/* -----------------------------------------------------------------------
 * Login
 * --------------------------------------------------------------------- */

export interface UserForAuth {
  id: string
  email: string
  status: string
  password_hash: string | null
  token_version: number
  failed_login_count: number
  locked_until: Date | null
  created_at: Date
  email_verified_at: Date | null
  deletion_requested_at: Date | null
  purge_after: Date | null
}

export async function findUserForAuth(emailNormalised: string): Promise<UserForAuth | null> {
  const pool = getPool()
  const { rows } = await pool.query<UserForAuth>(
    `select id, email, status, password_hash, token_version,
            failed_login_count, locked_until, created_at,
            email_verified_at, deletion_requested_at, purge_after
     from users where email_normalised = $1 and status <> 'DELETED'`,
    [emailNormalised],
  )
  return rows[0] ?? null
}

export interface CreateSessionInput {
  userId: string
  platform: string
  installationId: string
  deviceLabel: string | null
  ipAddressHash: string | null
  userAgent: string | null
}

export interface IssuedSession {
  sessionId: string
  tokenFamilyId: string
  refreshToken: string
  /** The stored SHA-256 digest — returned so the caller never persists the raw token. */
  refreshTokenDigest: string
}

export async function createSession(
  params: CreateSessionInput,
  client?: PoolClient,
): Promise<IssuedSession> {
  const pool = client ?? getPool()
  const caller = client ?? pool

  const expiresAt = refreshTokenExpiresAt()
  const familyId = params.installationId // reuse as family, stable per install
  const sessionId = crypto.randomUUID()
  const { token, digest } = issueRefreshToken()

  // Enforce the 10-session cap: count ACTIVE sessions and evict the LRU on the 11th.
  const { rows: [activeCount] } = await caller.query<{ count: string }>(
    `select count(*)::text from auth_sessions
     where user_id = $1 and status = 'ACTIVE'`,
    [params.userId],
  )
  if (Number(activeCount?.count ?? 0) >= MAX_ACTIVE_SESSIONS) {
    await caller.query(
      `update auth_sessions
       set status = 'REVOKED', revoked_at = now(), revoke_reason = 'FAMILY_CAP_REACHED'
       where id = (
         select id from auth_sessions
         where user_id = $1 and status = 'ACTIVE'
         order by last_used_at asc nulls first
         limit 1
       )`,
      [params.userId],
    )
  }

  await caller.query(
    `insert into auth_sessions
       (id, user_id, token_family_id, refresh_token_hash, status, platform,
        client_installation_id, device_label, ip_address_hash, user_agent,
        expires_at)
     values ($1, $2, $3, $4, 'ACTIVE', $5, $6, $7, $8, $9, $10)`,
    [
      sessionId,
      params.userId,
      familyId,
      digest,
      params.platform,
      params.installationId,
      params.deviceLabel,
      params.ipAddressHash,
      params.userAgent,
      expiresAt,
    ],
  )

  // Also insert the token-generation row (BR-ACC-07 clause 5).
  await caller.query(
    `insert into auth_tokens
       (user_id, session_id, token_family_id, parent_id, generation,
        refresh_token_digest, expires_at, family_created_at)
     values ($1, $2, $3, null, 1, $4, $5, now())`,
    [params.userId, sessionId, familyId, digest, expiresAt],
  )

  return { sessionId, tokenFamilyId: familyId, refreshToken: token, refreshTokenDigest: digest }
}

export async function recordLoginSuccess(userId: string, client?: PoolClient): Promise<void> {
  const caller = client ?? getPool()
  await caller.query(
    `update users set failed_login_count = 0, locked_until = null, last_login_at = now()
     where id = $1`,
    [userId],
  )
}

/* -----------------------------------------------------------------------
 * Login failure tracking — BR-ACC-09
 * --------------------------------------------------------------------- */

export async function recordLoginAttempt(
  emailNormalised: string,
  ipPrefix: string,
  outcome: string,
): Promise<void> {
  const pool = getPool()
  await pool.query(
    `insert into login_attempts (email_normalised, ip_prefix, outcome)
     values ($1, $2, $3)`,
    [emailNormalised, ipPrefix, outcome],
  )
}

export interface LockoutState {
  failures: number
  lockSeconds: number
  lastFailureAt: Date | null
}

export async function computeLockoutState(emailNormalised: string): Promise<LockoutState> {
  const pool = getPool()

  // Consecutive failures since the last success or 30-minute gap.
  const { rows: [row] } = await pool.query<{ failures: string; last_failure_at: string | null }>(
    `with ordered as (
       select outcome, attempted_at,
              lag(outcome) over (order by attempted_at desc) as prev_outcome,
              lag(attempted_at) over (order by attempted_at desc) as prev_at
       from login_attempts
       where email_normalised = $1
         and attempted_at > now() - interval '30 days'
       order by attempted_at desc
     ),
     streak as (
       select count(*) filter (where outcome in ('BAD_PASSWORD','NO_ACCOUNT','LOCKED_OUT')) as failures,
              attempted_at as last_failure_at
       from ordered
       where (outcome = 'SUCCESS' or prev_outcome = 'SUCCESS') is false
         and (prev_at is null or attempted_at - prev_at < interval '30 minutes')
       group by attempted_at
       order by attempted_at desc
       limit 1
     )
     select coalesce(failures, 0)::text as failures, last_failure_at::text
     from streak
     union all select '0'::text, null::text where not exists (select 1 from streak)
     limit 1`,
    [emailNormalised],
  )

  const failures = Number(row?.failures ?? '0')
  const lastFailureAt = row?.last_failure_at ? new Date(row.last_failure_at) : null
  const lockSeconds =
    failures >= 5 ? Math.min(60 * Math.pow(2, failures - 5), 1800) : 0

  return { failures, lockSeconds, lastFailureAt }
}

export async function recordFailedLogin(emailNormalised: string): Promise<void> {
  const pool = getPool()
  await pool.query(
    `update users set failed_login_count = failed_login_count + 1
     where email_normalised = $1`,
    [emailNormalised],
  )
}

/* -----------------------------------------------------------------------
 * Session / token lookup — BR-ACC-08
 * --------------------------------------------------------------------- */

export interface ActiveTokenRow {
  id: string
  sessionId: string
  tokenFamilyId: string
  generation: number
  refreshTokenDigest: string
  consumedAt: Date | null
  expiresAt: Date
  userId: string
  tokenVersion: number
}

export async function findActiveTokenByDigest(
  digest: string,
  client?: PoolClient,
): Promise<ActiveTokenRow | null> {
  const caller = client ?? getPool()
  const { rows } = await caller.query<ActiveTokenRow>(
    `select t.id, t.session_id as "sessionId", t.token_family_id as "tokenFamilyId",
            t.generation, t.refresh_token_digest as "refreshTokenDigest",
            t.consumed_at as "consumedAt", t.expires_at as "expiresAt",
            t.user_id as "userId", u.token_version as "tokenVersion"
     from auth_tokens t
     join users u on u.id = t.user_id
     join auth_sessions s on s.id = t.session_id
     where t.refresh_token_digest = $1
       and t.consumed_at is null
       and t.expires_at > now()
       and s.status = 'ACTIVE'
       and u.purge_after is null`,
    [digest],
  )
  return rows[0] ?? null
}

/**
 * Look a token up by digest regardless of consumption state (unexpired, on an
 * ACTIVE session, owner not purged). The refresh path needs this second probe:
 * a replayed token is by definition already consumed, so filtering on
 * `consumed_at is null` alone would make reuse detection unreachable — the
 * replay would 401 as TOKEN_EXPIRED and the stolen family would live on.
 */
export async function findTokenByDigestAnyState(
  digest: string,
  client?: PoolClient,
): Promise<ActiveTokenRow | null> {
  const caller = client ?? getPool()
  const { rows } = await caller.query<ActiveTokenRow>(
    `select t.id, t.session_id as "sessionId", t.token_family_id as "tokenFamilyId",
            t.generation, t.refresh_token_digest as "refreshTokenDigest",
            t.consumed_at as "consumedAt", t.expires_at as "expiresAt",
            t.user_id as "userId", u.token_version as "tokenVersion"
     from auth_tokens t
     join users u on u.id = t.user_id
     join auth_sessions s on s.id = t.session_id
     where t.refresh_token_digest = $1
       and t.expires_at > now()
       and s.status = 'ACTIVE'
       and u.purge_after is null`,
    [digest],
  )
  return rows[0] ?? null
}

export async function consumeAndRotateToken(
  oldTokenId: string,
  tokenFamilyId: string,
  sessionId: string,
  userId: string,
): Promise<IssuedSession> {
  // Reuse detection must COMMIT its family revocation and only then surface
  // the error: throwing from inside the transaction would roll the
  // revocation back and leave the stolen family alive. The transaction
  // returns a discriminated outcome; the throw happens after commit.
  const outcome = await transaction<
    { kind: 'ok'; session: IssuedSession } | { kind: 'reuse' }
  >(async (client) => {
    // Atomically consume. `consumed_at IS NULL` is the guard.
    const { rowCount } = await client.query(
      `update auth_tokens
       set consumed_at = now()
       where id = $1 and consumed_at is null`,
      [oldTokenId],
    )
    if (rowCount === 0) {
      // Already consumed — reuse detection. The grace-window comparison runs
      // entirely on the database clock: mixing local Date.now() with the
      // server's consumed_at let ordinary clock skew widen or shrink the 15s
      // window arbitrarily.
      const { rows: [row] } = await client.query<{
        in_grace: boolean; generation: number
      }>(
        `select (now() - consumed_at) <= interval '15 seconds' as in_grace, generation
         from auth_tokens where id = $1`,
        [oldTokenId],
      )
      if (row) {
        if (row.in_grace) {
          // Replay grace window: the usual cause is an honest client whose
          // refresh response was lost in transit and which retried with the
          // same token. The successor's raw token cannot be re-sent (only its
          // digest is stored), so mint a sibling child of the consumed row —
          // same family, so a genuine theft surfaces on the next reuse.
          const expiresAt = refreshTokenExpiresAt()
          const { token } = issueRefreshToken()
          const newDigest = digestRefreshToken(token)
          await client.query(
            `insert into auth_tokens
               (user_id, session_id, token_family_id, parent_id, generation,
                refresh_token_digest, expires_at, family_created_at)
             values ($1, $2, $3, $4,
                     (select generation + 1 from auth_tokens where id = $4),
                     $5, $6,
                     (select family_created_at from auth_tokens where id = $4))`,
            [userId, sessionId, tokenFamilyId, oldTokenId, newDigest, expiresAt],
          )
          return {
            kind: 'ok' as const,
            session: { sessionId, tokenFamilyId, refreshToken: token, refreshTokenDigest: newDigest },
          }
        }
      }
      // Outside the grace window: revoke the family, commit, then throw.
      await revokeTokenFamily(client, tokenFamilyId, sessionId, 'REUSE_DETECTED')
      return { kind: 'reuse' as const }
    }

    // Mint the next generation.
    const expiresAt = refreshTokenExpiresAt()
    const { token } = issueRefreshToken()
    const newDigest = digestRefreshToken(token)

    await client.query(
      `insert into auth_tokens
         (user_id, session_id, token_family_id, parent_id, generation,
          refresh_token_digest, expires_at, family_created_at)
       values ($1, $2, $3, $4,
               (select generation + 1 from auth_tokens where id = $4),
               $5, $6,
               (select family_created_at from auth_tokens where id = $4 for share))`,
      [userId, sessionId, tokenFamilyId, oldTokenId, newDigest, expiresAt],
    )

    // Bump session last_used_at (amortised at 60s per BR-ACC-18 clause 3).
    await client.query(
      `update auth_sessions set last_used_at = now()
       where id = $1 and (last_used_at is null or last_used_at < now() - interval '60 seconds')`,
      [sessionId],
    )

    return {
      kind: 'ok' as const,
      session: { sessionId, tokenFamilyId, refreshToken: token, refreshTokenDigest: newDigest },
    }
  })

  if (outcome.kind === 'reuse') {
    throw Object.assign(
      new Error('Token reuse detected. All sessions on this device have been signed out.'),
      { code: 'TOKEN_REUSE_DETECTED', status: 401, __appError: true },
    )
  }
  return outcome.session
}

async function revokeTokenFamily(
  client: PoolClient,
  familyId: string,
  _sessionId: string,
  reason: string,
): Promise<void> {
  await client.query(
    `update auth_sessions
     set status = 'REVOKED', revoked_at = now(), revoke_reason = $2
     where token_family_id = $1 and status = 'ACTIVE'`,
    [familyId, reason],
  )
  await client.query(
    `update auth_tokens
     set consumed_at = coalesce(consumed_at, now())
     where token_family_id = $1 and consumed_at is null`,
    [familyId],
  )
}

/* -----------------------------------------------------------------------
 * Registration helpers
 * --------------------------------------------------------------------- */

/** Dummy Argon2id hash for timing padding when no user exists (BR-ACC-10 clause 5). */
export const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'