/**
 * Settings, account lifecycle, dashboard, achievements, reminders, devices,
 * and cross-cutting HTTP behaviour (error envelope, headers, CORS, limits).
 * Test IDs: TC-SET-001 .. TC-ACC-1xx .. TC-DSH-001 .. TC-SYS-2xx ..
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type express from 'express'

import { cleanup, getPool, newUser, ORIGIN, PASSWORD, request, startApp, TEST_DB, today, type TestUser } from './harness.ts'

let app: express.Express
let u: TestUser

describe.skipIf(!TEST_DB)('Settings, account, dashboard and platform behaviour', () => {
  beforeAll(async () => {
    app = await startApp()
    u = await newUser(app, 'plat')
  }, 120_000)
  afterAll(cleanup)

  describe('settings (FR-SET)', () => {
    const put = (body: unknown, user = u) => request(app).put('/api/v1/settings').set(user.auth()).send(body as object)

    it('TC-SET-001 a new account has all three modules enabled and documented defaults', async () => {
      const res = await request(app).get('/api/v1/settings').set(u.auth())
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ plant_care_enabled: true, fitness_enabled: true, nutrition_enabled: true, unit_system: 'METRIC', reduce_motion: false, larger_text: false, high_contrast: false, analytics_opt_in: false })
    })

    it.each([
      [{ theme: 'DARK' }], [{ theme: 'LIGHT' }], [{ unit_system: 'IMPERIAL' }], [{ hemisphere: 'SOUTHERN' }],
      [{ week_start_day: 'SUNDAY' }], [{ reduce_motion: true }], [{ larger_text: true }], [{ high_contrast: true }],
      [{ analytics_opt_in: true }], [{ daily_notification_cap: 1 }], [{ daily_notification_cap: 20 }],
    ])('TC-SET-002 %j is saved and read back', async (patch) => {
      expect((await put(patch)).status).toBe(200)
      const got = await request(app).get('/api/v1/settings').set(u.auth())
      for (const [k, v] of Object.entries(patch)) expect(got.body[k]).toBe(v)
    })

    it.each([
      ['theme not in the enum', { theme: 'NEON' }],
      ['unit system not in the enum', { unit_system: 'FURLONGS' }],
      ['hemisphere not in the enum', { hemisphere: 'POLAR' }],
      ['boolean sent as text', { reduce_motion: 'yes' }],
      ['notification cap 0', { daily_notification_cap: 0 }],
      ['notification cap 21', { daily_notification_cap: 21 }],
      ['notification cap fractional', { daily_notification_cap: 2.5 }],
      ['quiet start 24:00', { quiet_start_time: '24:00' }],
      ['quiet start 7:00 (no leading zero)', { quiet_start_time: '7:00' }],
      ['quiet start 12:60', { quiet_start_time: '12:60' }],
      ['timezone over 64 characters', { timezone: 'x'.repeat(65) }],
      ['locale over 20 characters', { locale: 'x'.repeat(21) }],
    ])('TC-SET-003 rejects %s with 422', async (_l, body) => {
      const res = await put(body)
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_FAILED')
    })

    it('TC-SET-004 at least one module must stay enabled (FR-SET module toggles)', async () => {
      const me = await newUser(app, 'plat-mod')
      expect((await put({ plant_care_enabled: false, fitness_enabled: false }, me)).status).toBe(200)
      const res = await put({ nutrition_enabled: false }, me)
      expect(res.status).toBe(422)
      expect(JSON.stringify(res.body.error.details)).toMatch(/at_least_one_module_required/)
    })

    it('TC-SET-005 quiet hours: WINDOW mode needs both times, and they must differ', async () => {
      const me = await newUser(app, 'plat-quiet')
      expect((await put({ quiet_hours_mode: 'WINDOW', quiet_start_time: '22:00', quiet_end_time: null }, me)).status).toBe(422)
      expect((await put({ quiet_hours_mode: 'WINDOW', quiet_start_time: '22:00', quiet_end_time: '22:00' }, me)).status).toBe(422)
      expect((await put({ quiet_hours_mode: 'WINDOW', quiet_start_time: '22:00', quiet_end_time: '07:00' }, me)).status).toBe(200)
    })

    it('TC-SET-006 a window that crosses midnight (22:00 -> 07:00) is accepted', async () => {
      const me = await newUser(app, 'plat-night')
      const res = await put({ quiet_hours_mode: 'WINDOW', quiet_start_time: '22:00', quiet_end_time: '07:00' }, me)
      expect(res.status).toBe(200)
    })

    it('TC-SET-007 an empty update is harmless (200) and unknown keys do not create columns', async () => {
      expect((await put({})).status).toBe(200)
      const res = await put({ evil: 'x', is_admin: true })
      expect(res.status).toBeLessThan(500)
      const got = await request(app).get('/api/v1/settings').set(u.auth())
      expect(got.body).not.toHaveProperty('is_admin')
    })

    it('TC-SET-008 [DEF-015] the timezone must be a valid IANA identifier (FR-SET / BR-ACC-15)', async () => {
      expect((await put({ timezone: 'Mars/Olympus_Mons' })).status).toBe(422)
      expect((await put({ timezone: 'Asia/Kolkata' })).status).toBe(200)
    })
  })

  describe('account deletion lifecycle (FR-ACC-21, BR-ACC-20)', () => {
    it('TC-ACC-101 a new account is ACTIVE with no deletion dates', async () => {
      const res = await request(app).get('/api/v1/account').set(u.auth())
      expect(res.body).toMatchObject({ status: 'ACTIVE', deletion_requested_at: null, purge_after: null })
    })

    it('TC-ACC-102 deletion requires the password: missing -> 422, wrong -> 401 INVALID_CREDENTIALS, extra field -> 422', async () => {
      const me = await newUser(app, 'del-guard')
      expect((await request(app).post('/api/v1/account/deletion').set(me.auth()).send({})).status).toBe(422)
      const wrong = await request(app).post('/api/v1/account/deletion').set(me.auth()).send({ password: 'Wrong-Password-1234!' })
      expect(wrong.status).toBe(401)
      expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS')
      expect((await request(app).post('/api/v1/account/deletion').set(me.auth()).send({ password: PASSWORD, extra: 1 })).status).toBe(422)
      const state = await request(app).get('/api/v1/account').set(me.auth())
      expect(state.body.status).toBe('ACTIVE')
    })

    it('TC-ACC-103 a correct request schedules deletion exactly 30 days ahead', async () => {
      const me = await newUser(app, 'del-ok')
      const res = await request(app).post('/api/v1/account/deletion').set(me.auth()).send({ password: PASSWORD })
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('PENDING_DELETION')
      expect(res.body.already_pending).toBe(false)
      const days = (new Date(res.body.purge_after).getTime() - new Date(res.body.deletion_requested_at).getTime()) / 86_400_000
      expect(days).toBeCloseTo(30, 2)
    })

    it('TC-ACC-104 requesting twice is idempotent: already_pending=true and the purge date does not move', async () => {
      const me = await newUser(app, 'del-twice')
      const a = await request(app).post('/api/v1/account/deletion').set(me.auth()).send({ password: PASSWORD })
      const b = await request(app).post('/api/v1/account/deletion').set(me.auth()).send({ password: PASSWORD })
      expect(b.body.already_pending).toBe(true)
      expect(b.body.purge_after).toBe(a.body.purge_after)
    })

    it('TC-ACC-105 during the grace window the user can still sign in and is told deletion is pending', async () => {
      const me = await newUser(app, 'del-login')
      await request(app).post('/api/v1/account/deletion').set(me.auth()).send({ password: PASSWORD })
      const login = await request(app).post('/api/auth/login').set('x-plantpal-client', 'ANDROID').send({ email: me.email, password: PASSWORD })
      expect(login.status).toBe(200)
      expect(login.body.account_pending_deletion).toBe(true)
    })

    it('TC-ACC-106 cancelling restores ACTIVE; cancelling again is 409', async () => {
      const me = await newUser(app, 'del-cancel')
      await request(app).post('/api/v1/account/deletion').set(me.auth()).send({ password: PASSWORD })
      const cancel = await request(app).delete('/api/v1/account/deletion').set(me.auth())
      expect(cancel.status).toBe(200)
      expect(cancel.body.status).toBe('ACTIVE')
      expect((await request(app).delete('/api/v1/account/deletion').set(me.auth())).status).toBe(409)
    })

    it('TC-ACC-107 deleting a user row cascades to all of their data (no orphans)', async () => {
      const me = await newUser(app, 'cascade')
      await request(app).post('/api/v1/nutrition/water').set(me.auth()).send({ amount_ml: 200, local_date_str: today() })
      await request(app).post('/api/v1/fitness').set(me.auth()).send({ activity_type: 'WALK', local_date_str: today(), duration_mins: 10 })
      await getPool().query('delete from users where id = $1', [me.id])
      for (const t of ['water_logs', 'workouts', 'user_settings', 'auth_sessions']) {
        const { rows } = await getPool().query<{ n: string }>(`select count(*)::text n from ${t} where user_id = $1`, [me.id])
        expect(Number(rows[0]!.n), t).toBe(0)
      }
    })
  })

  describe('dashboard (FR-DSH-01) and achievements (FR-GAM)', () => {
    it('TC-DSH-001 returns the aggregate with streak, plants, fitness and nutrition sections in one call', async () => {
      const res = await request(app).get(`/api/v1/dashboard?date=${today()}`).set(u.auth())
      expect(res.status).toBe(200)
      for (const k of ['streak', 'plants', 'fitness', 'nutrition', 'today_list']) expect(res.body).toHaveProperty(k)
    })

    it('TC-DSH-002 the dashboard reflects what was just logged', async () => {
      const me = await newUser(app, 'dash')
      await request(app).post('/api/v1/fitness').set(me.auth()).send({ activity_type: 'WALK', local_date_str: today(), duration_mins: 10, steps: 3210 })
      const res = await request(app).get(`/api/v1/dashboard?date=${today()}`).set(me.auth())
      expect(res.body.fitness.steps).toBe(3210)
    })

    it('TC-DSH-003 a new user has a zero streak and sees no other user\'s data', async () => {
      const me = await newUser(app, 'dash-new')
      const res = await request(app).get(`/api/v1/dashboard?date=${today()}`).set(me.auth())
      expect(res.body.streak).toMatchObject({ current: 0, longest: 0 })
      expect(res.body.fitness.steps).toBe(0)
    })

    it('TC-DSH-004 [DEF-009] a malformed or impossible date is a 422, not a 500 or a silent default', async () => {
      for (const d of ['banana', '2026-13-45', '17-10-2026']) {
        const res = await request(app).get(`/api/v1/dashboard?date=${d}`).set(u.auth())
        expect(res.status, d).toBe(422)
      }
    })

    it('TC-GAM-101 the achievement list holds the 16 seeded achievements, all locked for a new user', async () => {
      const me = await newUser(app, 'ach')
      const res = await request(app).get('/api/v1/achievements').set(me.auth())
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(16)
      expect(res.body.every((a: { unlocked_at: string | null }) => a.unlocked_at === null)).toBe(true)
    })

    it('TC-GAM-102 the first workout unlocks the first-workout achievement exactly once', async () => {
      const me = await newUser(app, 'ach-first')
      await request(app).post('/api/v1/fitness').set(me.auth()).send({ activity_type: 'WALK', local_date_str: today(), duration_mins: 10 })
      await request(app).post('/api/v1/fitness').set(me.auth()).send({ activity_type: 'WALK', local_date_str: today(), duration_mins: 10 })
      const res = await request(app).get('/api/v1/achievements').set(me.auth())
      const first = res.body.filter((a: { achievement: { code: string } }) => a.achievement.code === 'FIRST_WORKOUT')
      expect(first).toHaveLength(1)
      expect(first[0].unlocked_at).not.toBeNull()
      const { rows } = await getPool().query<{ n: string }>(`select count(*)::text n from user_achievements ua join achievements a on a.id = ua.achievement_id where ua.user_id = $1 and a.code = 'FIRST_WORKOUT' and ua.unlocked_at is not null`, [me.id])
      expect(Number(rows[0]!.n)).toBe(1)
    })

    it('TC-GAM-103 marking achievements seen answers 200 and is repeatable', async () => {
      const me = await newUser(app, 'ach-seen')
      expect((await request(app).post('/api/v1/achievements/seen').set(me.auth()).send({})).status).toBe(200)
      expect((await request(app).post('/api/v1/achievements/seen').set(me.auth()).send({})).status).toBe(200)
    })

    it('TC-GAM-104 the streaks endpoint answers 200 with a streaks array', async () => {
      const res = await request(app).get('/api/v1/achievements/streaks').set(u.auth())
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.streaks)).toBe(true)
    })
  })

  describe('reminders and devices (FR-NOT)', () => {
    it('TC-NOT-001 a new user has no reminders', async () => {
      const me = await newUser(app, 'rem')
      const res = await request(app).get('/api/v1/reminders').set(me.auth())
      expect(res.status).toBe(200)
      expect(res.body.reminders).toEqual([])
    })

    it('TC-NOT-002 dismissing an unknown reminder is 404 and a malformed id is 422', async () => {
      expect((await request(app).post(`/api/v1/reminders/${crypto.randomUUID()}/dismiss`).set(u.auth())).status).toBe(404)
      expect((await request(app).post('/api/v1/reminders/not-a-uuid/dismiss').set(u.auth())).status).toBe(422)
    })

    it('TC-NOT-003 registering a device with an empty body is 422 and names the missing fields', async () => {
      const res = await request(app).post('/api/v1/devices').set(u.auth()).send({})
      expect(res.status).toBe(422)
      expect(res.body.error.details.length).toBeGreaterThan(0)
    })
  })

  describe('error envelope, headers, CORS and limits (FR-SYS-19..21, NFR-SEC-06)', () => {
    it('TC-SYS-201 every error carries code, message, message_key (errors.*), request_id and an ISO timestamp', async () => {
      const res = await request(app).get('/api/v1/plants').set({ authorization: 'Bearer nope' })
      const e = res.body.error
      expect(e.code).toBeTruthy()
      expect(typeof e.message).toBe('string')
      expect(e.message_key).toMatch(/^errors\./)
      expect(e.request_id).toBeTruthy()
      expect(new Date(e.timestamp).toISOString()).toBe(e.timestamp)
    })

    it('TC-SYS-202 the request id header is returned and equals the id in the error body', async () => {
      const res = await request(app).get('/api/v1/plants')
      expect(res.headers['x-request-id']).toBe(res.body.error.request_id)
    })

    it('TC-SYS-203 a unique request id is generated per request', async () => {
      const a = await request(app).get('/healthz')
      const b = await request(app).get('/healthz')
      expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id'])
    })

    it('TC-SYS-204 an unknown route returns 404 in the standard envelope', async () => {
      const res = await request(app).get('/api/v1/does-not-exist').set(u.auth())
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('TC-SYS-205 malformed JSON is a client error with the envelope, never a 500 and never a stack trace', async () => {
      const res = await request(app).post('/api/v1/nutrition/water').set(u.auth()).set('content-type', 'application/json').send('{"amount_ml": ')
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
      expect(JSON.stringify(res.body)).not.toMatch(/at .*\.(ts|js):\d+|node_modules|SyntaxError/)
    })

    it('TC-SYS-206 [DEF-016] a body over the 1 MB limit is refused with 413, not a 500', async () => {
      const res = await request(app).post('/api/v1/nutrition/water').set(u.auth()).send({ amount_ml: 1, local_date_str: today(), pad: 'x'.repeat(1_100_000) })
      expect(res.status).toBe(413)
    })

    it('TC-SYS-207 security headers are set and the framework is not advertised', async () => {
      const res = await request(app).get('/healthz')
      expect(res.headers['x-powered-by']).toBeUndefined()
      expect(res.headers['x-content-type-options']).toBe('nosniff')
      expect(res.headers['strict-transport-security']).toBeTruthy()
      expect(res.headers['x-frame-options'] ?? res.headers['content-security-policy']).toBeTruthy()
    })

    it('TC-SYS-208 CORS allows the configured origin with credentials and refuses others', async () => {
      const ok = await request(app).get('/healthz').set('Origin', ORIGIN)
      expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN)
      expect(ok.headers['access-control-allow-credentials']).toBe('true')
      const bad = await request(app).get('/healthz').set('Origin', 'https://evil.example')
      expect(bad.headers['access-control-allow-origin']).toBeUndefined()
    })

    it('TC-SYS-209 a CORS preflight from an untrusted origin gets no allow headers', async () => {
      const res = await request(app).options('/api/v1/plants').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST')
      expect(res.headers['access-control-allow-origin']).toBeUndefined()
    })

    it('TC-SYS-210 /healthz needs no database and reports status ok with an uptime', async () => {
      const res = await request(app).get('/healthz')
      expect(res.body.status).toBe('ok')
      expect(typeof res.body.uptime_s).toBe('number')
    })

    it('TC-SYS-211 /readyz reports the database as up and is not cached', async () => {
      const res = await request(app).get('/readyz')
      expect(res.body).toMatchObject({ status: 'ready', database: 'up' })
      expect(res.headers['cache-control']).toMatch(/no-store/)
    })

    it('TC-SYS-212 an unexpected failure returns a generic 500 with no SQL, path or stack in the body', async () => {
      // Force a database error through the public API: an oversized integer in a numeric field.
      const res = await request(app).post('/api/v1/fitness').set(u.auth()).send({ activity_type: 'STRENGTH', local_date_str: today(), sets: [{ reps: 5, weight_kg: -1 }] })
      const text = JSON.stringify(res.body)
      expect(text).not.toMatch(/select |insert |pg_|stack|\.ts:|node_modules/i)
    })
  })
})
