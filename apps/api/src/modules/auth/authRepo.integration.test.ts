/**
 * Auth integration tests — the real login path against a real PostgreSQL.
 *
 * Closes the long-standing gap recorded in docs/HANDOFF.md: session-cap
 * eviction, refresh-token rotation and reuse detection, and the
 * PENDING_DELETION grace window were covered only by mocks until now.
 *
 * Requires TEST_DATABASE_URL (a disposable branch/database). The suite skips
 * entirely when it is absent, so unit-only runs stay green without a server.
 * Every test uses its own randomised email and afterAll deletes the users it
 * created (cascades wipe sessions and tokens).
 */

import express from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const TEST_DB = process.env['TEST_DATABASE_URL']

process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] = TEST_DB ?? 'postgresql://unused:unused@localhost:5432/unused'
process.env['JWT_ACCESS_SECRET'] ??= 'integration-secret-at-least-32-characters-long'

const { initPool, getPool } = await import('../../db/pool.js')
const { runMigrations } = await import('../../db/migrate.js')
const { createApp } = await import('../../app.js')
const { digestRefreshToken } = await import('./tokens.js')

const PASSWORD = 'Correct-Horse-Battery-9!'
const createdEmails: string[] = []

function freshEmail(): string {
  const email = `it-${crypto.randomUUID()}@itest.plantpal.example`
  createdEmails.push(email)
  return email
}

let app: express.Express

async function registerAndLogin(email: string): Promise<{
  accessToken: string
  refreshToken: string
  userId: string
}> {
  const reg = await request(app)
    .post('/api/auth/register')
    .set('x-plantpal-client', 'ANDROID')
    .send({ email, password: PASSWORD, confirmed_age: true })
  expect(reg.status).toBe(202)

  const login = await request(app)
    .post('/api/auth/login')
    .set('x-plantpal-client', 'ANDROID')
    .send({ email, password: PASSWORD })
  expect(login.status).toBe(200)
  expect(login.body.refresh_token).toBeTruthy()
  return {
    accessToken: login.body.access_token,
    refreshToken: login.body.refresh_token,
    userId: login.body.user.id,
  }
}

describe.skipIf(!TEST_DB)('auth against a real PostgreSQL', () => {
  beforeAll(async () => {
    initPool(TEST_DB!)
    await runMigrations()
    app = createApp({ corsOrigins: ['http://localhost:5173'] })
  }, 120_000)

  afterAll(async () => {
    if (!TEST_DB) return
    const pool = getPool()
    if (createdEmails.length > 0) {
      await pool.query(`delete from users where email = any ($1::text[])`, [createdEmails])
      // Login attempts are keyed by normalised email with no FK to users.
      await pool
        .query(`delete from login_attempts where email_normalised = any ($1::text[])`, [
          createdEmails.map((e) => e.toLowerCase()),
        ])
        .catch(() => undefined)
    }
    await pool.end()
  }, 60_000)

  it('registers, signs in, and rejects a wrong password', async () => {
    const email = freshEmail()
    const { accessToken } = await registerAndLogin(email)
    expect(accessToken).toBeTruthy()

    const bad = await request(app)
      .post('/api/auth/login')
      .set('x-plantpal-client', 'ANDROID')
      .send({ email, password: 'Wrong-Password-1!' })
    expect(bad.status).toBe(401)
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS')
  }, 60_000)

  it('rotates the refresh token on every use', async () => {
    const email = freshEmail()
    const { refreshToken } = await registerAndLogin(email)

    const first = await request(app)
      .post('/api/auth/refresh')
      .set('x-plantpal-client', 'ANDROID')
      .send({ refresh_token: refreshToken })
    expect(first.status).toBe(200)
    expect(first.body.access_token).toBeTruthy()
    expect(first.body.refresh_token).toBeTruthy()
    expect(first.body.refresh_token).not.toBe(refreshToken)

    // The rotated token works; its predecessor is consumed.
    const second = await request(app)
      .post('/api/auth/refresh')
      .set('x-plantpal-client', 'ANDROID')
      .send({ refresh_token: first.body.refresh_token })
    expect(second.status).toBe(200)
  }, 60_000)

  it('an immediate replay (lost response, honest retry) gets a sibling token, family intact', async () => {
    const email = freshEmail()
    const { refreshToken } = await registerAndLogin(email)

    const first = await request(app)
      .post('/api/auth/refresh')
      .set('x-plantpal-client', 'ANDROID')
      .send({ refresh_token: refreshToken })
    expect(first.status).toBe(200)

    // Same token again, within the 15s grace window.
    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('x-plantpal-client', 'ANDROID')
      .send({ refresh_token: refreshToken })
    expect(replay.status).toBe(200)
    expect(replay.body.refresh_token).toBeTruthy()
    expect(replay.body.refresh_token).not.toBe(refreshToken)

    // Both leaves stay usable — the family was not revoked.
    const successor = await request(app)
      .post('/api/auth/refresh')
      .set('x-plantpal-client', 'ANDROID')
      .send({ refresh_token: first.body.refresh_token })
    expect(successor.status).toBe(200)
  }, 60_000)

  it('revokes the whole family on token reuse outside the replay grace window', async () => {
    const email = freshEmail()
    const { refreshToken } = await registerAndLogin(email)

    const rotated = await request(app)
      .post('/api/auth/refresh')
      .set('x-plantpal-client', 'ANDROID')
      .send({ refresh_token: refreshToken })
    expect(rotated.status).toBe(200)

    // Age the consumption past the 15s replay grace window, then replay the
    // old token — the attacker-with-a-stolen-token scenario (BR-ACC-07).
    const aged = await getPool().query(
      `update auth_tokens set consumed_at = now() - interval '20 seconds'
       where refresh_token_digest = $1`,
      [digestRefreshToken(refreshToken)],
    )
    expect(aged.rowCount).toBe(1)

    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('x-plantpal-client', 'ANDROID')
      .send({ refresh_token: refreshToken })
    expect(replay.status).toBe(401)
    expect(replay.body.error.code).toBe('TOKEN_REUSE_DETECTED')

    // The legitimate successor must be dead too — the family is revoked.
    const successor = await request(app)
      .post('/api/auth/refresh')
      .set('x-plantpal-client', 'ANDROID')
      .send({ refresh_token: rotated.body.refresh_token })
    expect(successor.status).toBe(401)
  }, 60_000)

  it('caps concurrent sessions at 10, evicting the LRU with FAMILY_CAP_REACHED', async () => {
    const email = freshEmail()
    const { userId } = await registerAndLogin(email)

    // 10 more logins: the 11th ACTIVE session must evict the oldest.
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('x-plantpal-client', 'ANDROID')
        .send({ email, password: PASSWORD })
      expect(res.status).toBe(200)
    }

    const { rows } = await getPool().query<{ status: string; revoke_reason: string | null }>(
      `select status, revoke_reason from auth_sessions where user_id = $1`,
      [userId],
    )
    const active = rows.filter((r) => r.status === 'ACTIVE')
    const evicted = rows.filter((r) => r.revoke_reason === 'FAMILY_CAP_REACHED')
    expect(active).toHaveLength(10)
    expect(evicted.length).toBeGreaterThanOrEqual(1)
  }, 120_000)

  it('lets a PENDING_DELETION user sign in during the grace window, flagged', async () => {
    const email = freshEmail()
    const { userId } = await registerAndLogin(email)

    await getPool().query(
      `update users
       set status = 'PENDING_DELETION', purge_after = now() + interval '20 days'
       where id = $1`,
      [userId],
    )

    const res = await request(app)
      .post('/api/auth/login')
      .set('x-plantpal-client', 'ANDROID')
      .send({ email, password: PASSWORD })
    // FR-ACC-02 clause 5: signing in is the only way to cancel deletion.
    expect(res.status).toBe(200)
    expect(res.body.account_pending_deletion).toBe(true)
    expect(res.body.user.status).toBe('PENDING_DELETION')
  }, 60_000)

  it('refuses a user whose purge date has passed', async () => {
    const email = freshEmail()
    const { userId } = await registerAndLogin(email)

    await getPool().query(
      `update users
       set status = 'PENDING_DELETION', purge_after = now() - interval '1 hour'
       where id = $1`,
      [userId],
    )

    const res = await request(app)
      .post('/api/auth/login')
      .set('x-plantpal-client', 'ANDROID')
      .send({ email, password: PASSWORD })
    expect(res.status).toBe(401)
  }, 60_000)

  it('logout consumes the refresh token and revokes the session', async () => {
    const email = freshEmail()
    const { refreshToken } = await registerAndLogin(email)

    const out = await request(app)
      .post('/api/auth/logout')
      .set('x-plantpal-client', 'ANDROID')
      .send({ refresh_token: refreshToken })
    expect(out.status).toBe(200)

    const after = await request(app)
      .post('/api/auth/refresh')
      .set('x-plantpal-client', 'ANDROID')
      .send({ refresh_token: refreshToken })
    expect(after.status).toBe(401)
  }, 60_000)
})
