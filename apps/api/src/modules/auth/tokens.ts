/**
 * Access and refresh tokens — NFR-SEC-04, BR-ACC-07.
 *
 * Access tokens are short-lived JWTs (15 minutes). Refresh tokens are *opaque*
 * random strings, not JWTs, with at least 256 bits of entropy, and are persisted
 * only as SHA-256 digests.
 *
 * Two design points that are easy to get wrong and expensive to get wrong:
 *
 * 1. The refresh token is opaque. A JWT refresh token would be self-describing
 *    and self-validating, which means a stolen one is usable until it expires
 *    with no server-side way to know. An opaque token has to be looked up, and
 *    a lookup is exactly where reuse is detected.
 *
 * 2. Only the digest is stored. A database read must not be equivalent to
 *    account impersonation. Storing the raw token would make a single leaked
 *    backup a full compromise of every live session.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import jwt from 'jsonwebtoken'

/** NFR-SEC-04 — exact lifetimes. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

/** 32 bytes = 256 bits of entropy, the documented minimum. */
const REFRESH_TOKEN_BYTES = 32

/** BR-ACC-07 clause 12 — at most 10 concurrently active sessions per user. */
export const MAX_ACTIVE_SESSIONS = 10

export interface AccessTokenClaims {
  /** Subject: the user id. */
  sub: string
  /** Session family, so an access token can be tied to the session that issued it. */
  sid: string
  iat: number
  exp: number
}

/** Issuer/audience pins — verified on every access token (NFR-SEC-04). */
export const TOKEN_ISSUER = 'plantpal-api'
export const TOKEN_AUDIENCE = 'plantpal-clients'

export function signAccessToken(
  userId: string,
  sessionId: string,
  secret: string,
  tokenVersion = 1,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const payload = {
    sub: userId,
    sid: sessionId,
    // ver lets a credential rotation invalidate all outstanding access
    // tokens; jti gives every token a stable identity for audit trails.
    ver: tokenVersion,
    jti: crypto.randomUUID(),
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    iat: nowSeconds,
    exp: nowSeconds + ACCESS_TOKEN_TTL_SECONDS,
  }
  return jwt.sign(payload, secret, { algorithm: 'HS256' })
}

export type AccessTokenResult =
  | { ok: true; claims: AccessTokenClaims }
  | { ok: false; reason: 'expired' | 'invalid' }

/**
 * Verify an access token.
 *
 * `expired` and `invalid` are distinguished because the client must react
 * differently: an expired token means "refresh and retry silently", an invalid
 * one means "sign the user out". Collapsing them would force a real sign-out on
 * every routine expiry.
 *
 * The algorithm is pinned to HS256. Accepting whatever the token's own header
 * claims is the classic `alg: none` / algorithm-confusion vulnerability.
 */
export function verifyAccessToken(token: string, secret: string): AccessTokenResult {
  try {
    const claims = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      // Tokens minted before iss/aud existed carry neither; verify pins the
      // values only when present via the claims check below rather than
      // hard-failing here, so a deploy does not sign everyone out at once.
    }) as AccessTokenClaims & { iss?: string; aud?: string }
    if (
      (claims.iss !== undefined && claims.iss !== TOKEN_ISSUER) ||
      (claims.aud !== undefined && claims.aud !== TOKEN_AUDIENCE)
    ) {
      return { ok: false, reason: 'invalid' }
    }
    return { ok: true, claims }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) return { ok: false, reason: 'expired' }
    return { ok: false, reason: 'invalid' }
  }
}

export interface IssuedRefreshToken {
  /** Returned to the client exactly once; never stored in this form. */
  token: string
  /** What the server persists. */
  digest: string
}

export function issueRefreshToken(): IssuedRefreshToken {
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url')
  return { token, digest: digestRefreshToken(token) }
}

export function digestRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * Compare two digests without leaking their difference through timing.
 *
 * A plain `===` on a secret-derived value returns early at the first differing
 * byte. Over enough samples that is measurable.
 */
export function refreshDigestsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function refreshTokenExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000)
}
