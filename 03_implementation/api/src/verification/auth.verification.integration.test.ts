/**
 * Accounts and authentication (FR-ACC, BR-ACC-01, BR-ACC-07, BR-ACC-10,
 * NFR-SEC). Black-box through the public API, real PostgreSQL.
 * Test IDs: TC-ACC-001 ..
 */
import jwt from 'jsonwebtoken'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type express from 'express'

import { cleanup, newUser, ORIGIN, PASSWORD, request, SECRET, startApp, TEST_DB } from './harness.ts'

let app: express.Express

const uniqueEmail = (p = 'a') => `${p}-${crypto.randomUUID()}@verify.plantpal.example`
const register = (body: Record<string, unknown>, client = 'ANDROID') =>
  request(app).post('/api/auth/register').set('x-plantpal-client', client).send(body)

describe.skipIf(!TEST_DB)('Accounts and authentication', () => {
  beforeAll(async () => {
    app = await startApp()
  }, 120_000)
  afterAll(cleanup)

  describe('registration validation (FR-ACC-01, FR-ACC-02)', () => {
    it('TC-ACC-001 accepts a valid registration with 202', async () => {
      const email = uniqueEmail()
      const res = await register({ email, password: PASSWORD, confirmed_age: true })
      expect(res.status).toBe(202)
      await request(app).get('/healthz') // keep the app warm; cleanup removes the user via the pool
      const { getPool } = await import('./harness.ts')
      await getPool().query('delete from users where email = $1', [email])
    })

    it.each([
      ['missing email', { password: PASSWORD, confirmed_age: true }, 'email'],
      ['email without @', { email: 'not-an-email', password: PASSWORD, confirmed_age: true }, 'email'],
      ['email of 4 characters', { email: 'a@b.', password: PASSWORD, confirmed_age: true }, 'email'],
      ['missing password', { email: 'x@verify.plantpal.example', confirmed_age: true }, 'password'],
      ['age not confirmed', { email: 'x@verify.plantpal.example', password: PASSWORD, confirmed_age: false }, 'confirmed_age'],
      ['age confirmation absent', { email: 'x@verify.plantpal.example', password: PASSWORD }, 'confirmed_age'],
      ['age confirmation as string "true"', { email: 'x@verify.plantpal.example', password: PASSWORD, confirmed_age: 'true' }, 'confirmed_age'],
    ])('TC-ACC-002 rejects %s with 422 and names the field', async (_l, body, field) => {
      const res = await register(body)
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_FAILED')
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field)
    })

    it('TC-ACC-003 rejects an email longer than 254 characters', async () => {
      const email = `${'a'.repeat(250)}@verify.plantpal.example`
      expect((await register({ email, password: PASSWORD, confirmed_age: true })).status).toBe(422)
    })

    it('TC-ACC-004 collects every failure in one response (BR-ACC / FR-ACC-01 step 2)', async () => {
      const res = await register({ email: 'bad', password: 'short', confirmed_age: false })
      const fields = res.body.error.details.map((d: { field: string }) => d.field).sort()
      expect(fields).toEqual(['confirmed_age', 'email', 'password'])
    })
  })

  describe('password policy BR-ACC-01 (length 12..128)', () => {
    const pw = (n: number) => `Aa1!${'xYz'.repeat(60)}`.slice(0, n)
    it.each([
      [11, 422],
      [12, 202],
      [128, 202],
      [129, 422],
    ])('TC-ACC-005 a %i-character password returns %i', async (len, status) => {
      const email = uniqueEmail('pw')
      const res = await register({ email, password: pw(len), confirmed_age: true })
      expect(res.status).toBe(status)
      if (status === 202) {
        const { getPool } = await import('./harness.ts')
        await getPool().query('delete from users where email = $1', [email])
      }
    })

    it('TC-ACC-006 [DEF-005] rejects a 12-character password with a single character class (clause 3)', async () => {
      const res = await register({ email: uniqueEmail('cls'), password: 'abcdefghijkl', confirmed_age: true })
      expect(res.status).toBe(422)
    })

    it('TC-ACC-007 [DEF-005] rejects a password with 5 or more repeated characters (clause 5)', async () => {
      const res = await register({ email: uniqueEmail('rep'), password: 'Aa1!aaaaaXyz', confirmed_age: true })
      expect(res.status).toBe(422)
    })

    it('TC-ACC-008 [DEF-005] rejects a whitespace-only password (clause 4)', async () => {
      const res = await register({ email: uniqueEmail('ws'), password: ' '.repeat(14), confirmed_age: true })
      expect(res.status).toBe(422)
    })
  })

  describe('account enumeration resistance (BR-ACC-10)', () => {
    it('TC-ACC-009 registering an existing address returns the same status and body as a new one', async () => {
      const email = uniqueEmail('dup')
      const first = await register({ email, password: PASSWORD, confirmed_age: true })
      const second = await register({ email, password: PASSWORD, confirmed_age: true })
      expect(second.status).toBe(first.status)
      expect(second.body).toEqual(first.body)
      const { getPool } = await import('./harness.ts')
      await getPool().query('delete from users where email = $1', [email])
    })

    it('TC-ACC-010 login with a wrong password and login with an unknown address are indistinguishable', async () => {
      const u = await newUser(app, 'enum')
      const wrong = await request(app).post('/api/auth/login').send({ email: u.email, password: 'Wrong-Password-1234!' })
      const unknown = await request(app).post('/api/auth/login').send({ email: uniqueEmail('nobody'), password: PASSWORD })
      expect(wrong.status).toBe(401)
      expect(unknown.status).toBe(wrong.status)
      expect(unknown.body.error.code).toBe(wrong.body.error.code)
      expect(unknown.body.error.message).toBe(wrong.body.error.message)
    })

    it('TC-ACC-011 both failure paths take at least the 250 ms timing floor', async () => {
      const u = await newUser(app, 'time')
      for (const email of [u.email, uniqueEmail('ghost')]) {
        const t0 = Date.now()
        await request(app).post('/api/auth/login').send({ email, password: 'Wrong-Password-1234!' })
        expect(Date.now() - t0).toBeGreaterThanOrEqual(240)
      }
    })
  })

  describe('login (FR-ACC-04)', () => {
    it('TC-ACC-012 matches the email case-insensitively and ignores surrounding whitespace', async () => {
      const u = await newUser(app, 'case')
      const res = await request(app).post('/api/auth/login').set('x-plantpal-client', 'ANDROID')
        .send({ email: `  ${u.email.toUpperCase()}  `, password: PASSWORD })
      expect(res.status).toBe(200)
      expect(res.body.user.id).toBe(u.id)
    })

    it('TC-ACC-013 the password is case-sensitive', async () => {
      const u = await newUser(app, 'pwcase')
      const res = await request(app).post('/api/auth/login').send({ email: u.email, password: PASSWORD.toUpperCase() })
      expect(res.status).toBe(401)
    })

    it('TC-ACC-014 never returns a password hash or digest in any auth response', async () => {
      const u = await newUser(app, 'leak')
      const me = await request(app).get('/api/auth/me').set(u.auth())
      const blob = JSON.stringify(me.body).toLowerCase()
      expect(blob).not.toMatch(/password|argon|hash|digest/)
    })

    it('TC-ACC-015 mobile clients receive the refresh token in the body; web clients in an HttpOnly Secure cookie', async () => {
      const u = await newUser(app, 'client')
      expect(typeof u.refreshToken).toBe('string')
      const web = await request(app).post('/api/auth/login').set('x-plantpal-client', 'WEB').send({ email: u.email, password: PASSWORD })
      expect(web.body.refresh_token).toBeUndefined()
      const cookie = ([] as string[]).concat(web.headers['set-cookie'] ?? []).join(';')
      expect(cookie).toMatch(/refresh_token=/)
      expect(cookie).toMatch(/HttpOnly/i)
      expect(cookie).toMatch(/Secure/i)
      expect(cookie).toMatch(/SameSite=None/i)
    })

    it('TC-ACC-016 the access token lives for 900 seconds', async () => {
      const u = await newUser(app, 'ttl')
      const claims = jwt.decode(u.token) as { iat: number; exp: number }
      expect(claims.exp - claims.iat).toBe(900)
    })
  })

  describe('access-token validation on a protected route (NFR-SEC)', () => {
    const me = (h: Record<string, string>) => request(app).get('/api/auth/me').set(h)
    const claims = (over: Record<string, unknown> = {}) => ({
      sub: crypto.randomUUID(), sid: crypto.randomUUID(), ver: 1, jti: crypto.randomUUID(),
      iss: 'plantpal', aud: 'plantpal', ...over,
    })

    it('TC-ACC-017 no Authorization header -> 401 AUTHENTICATION_REQUIRED', async () => {
      const res = await me({})
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED')
    })

    it.each([['Basic dXNlcjpwYXNz'], ['bearer lowercase-scheme'], ['Token abc']])('TC-ACC-018 scheme %j -> 401', async (h) => {
      expect((await me({ authorization: h })).status).toBe(401)
    })

    it('TC-ACC-019 garbage after Bearer -> 401 TOKEN_INVALID', async () => {
      const res = await me({ authorization: 'Bearer not.a.jwt' })
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('TOKEN_INVALID')
    })

    it('TC-ACC-020 a token signed with a different secret is rejected', async () => {
      const forged = jwt.sign(claims(), 'a-completely-different-secret-of-32-chars!!', { algorithm: 'HS256', expiresIn: 900 })
      expect((await me({ authorization: `Bearer ${forged}` })).status).toBe(401)
    })

    it('TC-ACC-021 an alg=none token is rejected', async () => {
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
      const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...claims(), exp: Math.floor(Date.now() / 1000) + 900 })}.`
      expect((await me({ authorization: `Bearer ${none}` })).status).toBe(401)
    })

    it('TC-ACC-022 an expired token -> 401 TOKEN_EXPIRED', async () => {
      const u = await newUser(app, 'exp')
      const old = jwt.sign({ ...(jwt.decode(u.token) as object), exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, { algorithm: 'HS256' })
      const res = await me({ authorization: `Bearer ${old}` })
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('TOKEN_EXPIRED')
    })

    it('TC-ACC-023 a token with the wrong audience or issuer is rejected', async () => {
      const u = await newUser(app, 'aud')
      const base = jwt.decode(u.token) as Record<string, unknown>
      const badAud = jwt.sign({ ...base, aud: 'someone-else' }, SECRET, { algorithm: 'HS256' })
      const badIss = jwt.sign({ ...base, iss: 'someone-else' }, SECRET, { algorithm: 'HS256' })
      expect((await me({ authorization: `Bearer ${badAud}` })).status).toBe(401)
      expect((await me({ authorization: `Bearer ${badIss}` })).status).toBe(401)
    })

    it('TC-ACC-024 flipping one character of the signature invalidates the token', async () => {
      const u = await newUser(app, 'sig')
      const [h, p, s] = u.token.split('.')
      const flipped = `${h}.${p}.${s!.slice(0, -2)}${s!.endsWith('A') ? 'B' : 'A'}${s!.slice(-1)}`
      expect((await me({ authorization: `Bearer ${flipped}` })).status).toBe(401)
    })
  })

  describe('refresh-token rotation (BR-ACC-07)', () => {
    const refresh = (token: string) => request(app).post('/api/auth/refresh').set('x-plantpal-client', 'ANDROID').send({ refresh_token: token })

    it('TC-ACC-025 refresh returns a new access token and a different refresh token', async () => {
      const u = await newUser(app, 'rot')
      const res = await refresh(u.refreshToken)
      expect(res.status).toBe(200)
      expect(res.body.access_token).toBeTruthy()
      expect(res.body.refresh_token).toBeTruthy()
      expect(res.body.refresh_token).not.toBe(u.refreshToken)
    })

    it('TC-ACC-026 an unknown refresh token -> 401', async () => {
      expect((await refresh('definitely-not-a-real-token')).status).toBe(401)
    })

    it('TC-ACC-027 a missing refresh token -> 401, not 500', async () => {
      const res = await request(app).post('/api/auth/refresh').send({})
      expect(res.status).toBe(401)
    })

    it('TC-ACC-028 reuse of a consumed token revokes the family: the newest token stops working too', async () => {
      const u = await newUser(app, 'reuse')
      const first = await refresh(u.refreshToken)
      const newest = first.body.refresh_token as string
      // Replay beyond the lost-response grace window is simulated by consuming the successor first.
      const second = await refresh(newest)
      expect(second.status).toBe(200)
      const replay = await refresh(u.refreshToken)
      expect(replay.status).toBe(401)
      const afterRevocation = await refresh(second.body.refresh_token)
      expect(afterRevocation.status).toBe(401)
    })

    it('TC-ACC-029 logout consumes the refresh token', async () => {
      const u = await newUser(app, 'out')
      const out = await request(app).post('/api/auth/logout').set('x-plantpal-client', 'ANDROID').send({ refresh_token: u.refreshToken })
      expect(out.status).toBe(200)
      expect((await refresh(u.refreshToken)).status).toBe(401)
    })

    it('TC-ACC-030 a cookie-based refresh from an untrusted origin is refused (CSRF defence)', async () => {
      const u = await newUser(app, 'csrf')
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${u.refreshToken}`)
        .set('Origin', 'https://evil.example')
        .send({})
      expect(res.status).toBe(403)
    })

    it('TC-ACC-031 a cookie-based refresh from the trusted origin is accepted', async () => {
      const u = await newUser(app, 'csrfok')
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('x-plantpal-client', 'WEB')
        .set('Cookie', `refresh_token=${u.refreshToken}`)
        .set('Origin', ORIGIN)
        .send({})
      expect(res.status).toBe(200)
    })
  })
})
