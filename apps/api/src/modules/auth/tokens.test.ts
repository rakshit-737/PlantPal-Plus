import { describe, expect, it } from 'vitest'
import jwt from 'jsonwebtoken'

import {
  ACCESS_TOKEN_TTL_SECONDS,
  MAX_ACTIVE_SESSIONS,
  REFRESH_TOKEN_TTL_SECONDS,
  digestRefreshToken,
  issueRefreshToken,
  refreshDigestsMatch,
  signAccessToken,
  verifyAccessToken,
} from './tokens.js'

const SECRET = 'a'.repeat(48)
const USER = '11111111-1111-4111-8111-111111111111'
const SESSION = '22222222-2222-4222-8222-222222222222'

describe('token lifetimes — NFR-SEC-04', () => {
  it('uses exactly 15 minutes for access tokens', () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(900)
  })

  it('uses exactly 30 days for refresh tokens', () => {
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(2_592_000)
  })

  it('caps concurrent sessions at 10 (BR-ACC-07, resolved 2026-07-21)', () => {
    expect(MAX_ACTIVE_SESSIONS).toBe(10)
  })
})

describe('access tokens', () => {
  it('round-trips the subject and session claims', () => {
    const token = signAccessToken(USER, SESSION, SECRET)
    const result = verifyAccessToken(token, SECRET)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.claims.sub).toBe(USER)
      expect(result.claims.sid).toBe(SESSION)
      expect(result.claims.exp - result.claims.iat).toBe(ACCESS_TOKEN_TTL_SECONDS)
    }
  })

  it('reports expiry distinctly from invalidity, so a client can refresh instead of signing out', () => {
    const longAgo = Math.floor(Date.now() / 1000) - ACCESS_TOKEN_TTL_SECONDS - 60
    const expired = signAccessToken(USER, SESSION, SECRET, 1, longAgo)
    const result = verifyAccessToken(expired, SECRET)
    expect(result).toEqual({ ok: false, reason: 'expired' })
  })

  it('rejects a token signed with a different secret', () => {
    const token = signAccessToken(USER, SESSION, SECRET)
    expect(verifyAccessToken(token, 'b'.repeat(48))).toEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects an unsigned "alg: none" token rather than trusting its header', () => {
    // The classic algorithm-confusion attack: forge a token declaring no signature.
    const forged = jwt.sign({ sub: USER, sid: SESSION }, '', { algorithm: 'none' })
    expect(verifyAccessToken(forged, SECRET).ok).toBe(false)
  })

  it('rejects a tampered payload', () => {
    const token = signAccessToken(USER, SESSION, SECRET)
    const [header, , signature] = token.split('.')
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'someone-else', sid: SESSION, iat: 1, exp: 9_999_999_999 }),
    ).toString('base64url')
    expect(verifyAccessToken(`${header}.${forgedPayload}.${signature}`, SECRET).ok).toBe(false)
  })
})

describe('refresh tokens', () => {
  it('issues at least 256 bits of entropy', () => {
    const { token } = issueRefreshToken()
    // 32 random bytes in base64url is 43 characters.
    expect(Buffer.from(token, 'base64url').length).toBe(32)
  })

  it('never returns the stored form to the caller', () => {
    const { token, digest } = issueRefreshToken()
    expect(digest).not.toBe(token)
    expect(digest).toHaveLength(64) // SHA-256 hex
    expect(digest).toBe(digestRefreshToken(token))
  })

  it('produces a distinct token on every issue', () => {
    const seen = new Set(Array.from({ length: 200 }, () => issueRefreshToken().token))
    expect(seen.size).toBe(200)
  })

  it('matches digests in constant time and rejects a mismatch', () => {
    const { token, digest } = issueRefreshToken()
    expect(refreshDigestsMatch(digestRefreshToken(token), digest)).toBe(true)
    expect(refreshDigestsMatch(digestRefreshToken('other'), digest)).toBe(false)
  })

  it('does not throw when comparing digests of different lengths', () => {
    expect(refreshDigestsMatch('abc', 'a'.repeat(64))).toBe(false)
  })
})
