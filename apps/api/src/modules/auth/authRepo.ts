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
} from './tokens.ts'
import { getPool, transaction } from '../../db/pool.ts'
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

/** Minimal profile for GET /auth/me — lets a client restore identity after a silent refresh. */
export async function findUserById(
  id: string,
): Promise<{ id: string; email: string; status: string } | null> {
  const pool = getPool()
  const { rows } = await pool.query<{ id: string; email: string; status: string }>(
    `select id, email, status from users where id = $1 and status <> 'DELETED'`,
    [id],
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
  // The cap check, eviction and insert must be one atomic unit: interleaved
  // logins could otherwise exceed the 10-session cap or evict the wrong row.
  if (!client) {
    return transaction((tx) => createSession(params, tx))
  }
  const caller = client

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

  // Consecutive failures = failure rows since the most recent SUCCESS
  // (BR-ACC-09: the counter clears on successful authentication), bounded to
  // 24h so ancient history cannot lock anyone out. The previous version
  // grouped by attempted_at — a per-insert now() — so every group held one
  // row and the count could never exceed 1, which made the >= 5 lockout gate
  // unreachable and allowed unlimited online password guessing (FR-ACC-07).
  // LOCKED_OUT probe rows are excluded so hammering a locked account does not
  // extend its own lock indefinitely.
  const { rows: [row] } = await pool.query<{ failures: string; last_failure_at: string | null }>(
    `select count(*)::text as failures, max(attempted_at)::text as last_failure_at
     from login_attempts
     where email_normalised = $1
       and outcome in ('BAD_PASSWORD', 'NO_ACCOUNT')
       and attempted_at > coalesce(
         (select max(attempted_at) from login_attempts
          where email_normalised = $1 and outcome = 'SUCCESS'),
         now() - interval '24 hours'
       )
       and attempted_at > now() - interval '24 hours'`,
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

/**
 * The unconsumed happy path: a live refresh token whose session is ACTIVE and
 * whose owner has not been purged.
 *
 * "Not purged" means the purge instant has actually PASSED, not merely that one
 * is set. `purge_after` is stamped the moment a deletion is requested, so the
 * earlier `purge_after is null` test disqualified every session from the first
 * minute of the 30-day window — including the one FR-ACC-21 rule 3 deliberately
 * spares so the user can still cancel, and any session opened later during the
 * window. BR-ACC-20 clause 2 keeps the account fully usable throughout, so the
 * user was instead signed out within one 15-minute access-token lifetime and the
 * cancel affordance disappeared behind a fresh login. The predicate below is the
 * same rule the login path applies (authController: purge_after set AND already
 * elapsed means treat as no account).
 */
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
       -- BR-ACC-07 clause 6: absolute 180-day family lifetime, regardless of
       -- how recently the chain rotated (expires_at alone re-arms every use).
       and t.family_created_at > now() - interval '180 days'
       and s.status = 'ACTIVE'
       -- BR-ACC-20 clause 2: a scheduled deletion must not disable refresh --
       -- only a purge instant that has already elapsed does. See the note above.
       and (u.purge_after is null or u.purge_after > now())`,
    [digest],
  )
  return rows[0] ?? null
}

/**
 * Look a token up by digest regardless of consumption state (unexpired, on an
 * ACTIVE session, owner not past its purge instant). The refresh path needs
 * this second probe: a replayed token is by definition already consumed, so
 * filtering on `consumed_at is null` alone would make reuse detection
 * unreachable — the replay would 401 as TOKEN_EXPIRED and the stolen family
 * would live on.
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
       -- BR-ACC-07 clause 6: absolute 180-day family lifetime, regardless of
       -- how recently the chain rotated (expires_at alone re-arms every use).
       and t.family_created_at > now() - interval '180 days'
       and s.status = 'ACTIVE'
       -- BR-ACC-20 clause 2, as above: block only once the purge instant has
       -- passed. Kept identical to findActiveTokenByDigest on purpose — the
       -- refresh path falls through from that probe to this one, so a
       -- divergence here would make a replay 401 as TOKEN_EXPIRED instead of
       -- reaching reuse detection.
       and (u.purge_after is null or u.purge_after > now())`,
    [digest],
  )
  return rows[0] ?? null
}

/**
 * The caller's stored password hash, for a step-up re-authentication on an
 * already-authenticated request (FR-ACC-21 rule 1).
 *
 * Deliberately narrow rather than widening `findUserById`: that function feeds
 * `GET /auth/me`, whose response is serialised straight to the client, so a
 * credential hash must never enter its row shape. `null` for the row means no
 * usable account; a row with a null `password_hash` means an OAuth-only account
 * that has no password to re-authenticate against.
 */
export async function findPasswordHashById(
  id: string,
): Promise<{ password_hash: string | null } | null> {
  const pool = getPool()
  const { rows } = await pool.query<{ password_hash: string | null }>(
    `select password_hash from users where id = $1 and status <> 'DELETED'`,
    [id],
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
      if (row?.in_grace) {
        // Replay grace window — but ONLY while the direct successor is still
        // unconsumed (BR-ACC-08 clause 3): that is the honest lost-response
        // case, where the client retried because it never received the
        // successor. The raw successor cannot be re-sent (digest-only
        // storage), so the untouched successor is consumed here and a
        // replacement sibling is minted — the family keeps exactly ONE live
        // leaf, so a genuinely stolen token still trips REUSE_DETECTED on its
        // next use (E-17). A successor that has itself been consumed means
        // the chain advanced — someone used it — and the spec mandates
        // family revocation (E-18): fall through to the revoke below.
        const { rows: successorRows } = await client.query<{ id: string }>(
          `update auth_tokens set consumed_at = now()
           where parent_id = $1 and consumed_at is null
           returning id`,
          [oldTokenId],
        )
        if (successorRows.length > 0) {
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
      // Outside the grace window, or the successor was already consumed
      // (E-18): revoke the family, commit, then throw.
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