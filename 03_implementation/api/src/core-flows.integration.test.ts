/**
 * Core user flows against a real PostgreSQL — the paths every account takes on
 * its first day: add a plant, water it, log a workout and a meal, read the
 * dashboard.
 *
 * Unit suites mock the repositories, so they cannot see a query PostgreSQL
 * itself rejects. One of those shipped: watering bound a single parameter both
 * into an interval string and into an integer column, PostgreSQL inferred it as
 * text from the first use and refused the second, and every watering in the
 * live deployment returned 500. These tests run the real SQL.
 *
 * Requires TEST_DATABASE_URL (CI provides one); skips entirely without it.
 */

import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type express from 'express'

const TEST_DB = process.env['TEST_DATABASE_URL']

process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] = TEST_DB ?? 'postgresql://unused:unused@localhost:5432/unused'
process.env['JWT_ACCESS_SECRET'] ??= 'integration-secret-at-least-32-characters-long'

const { initPool, getPool } = await import('./db/pool.ts')
const { runMigrations } = await import('./db/migrate.ts')
const { runSeeds } = await import('./db/seed.ts')
const { createApp } = await import('./app.ts')

const PASSWORD = 'Correct-Horse-Battery-9!'
const email = `flows-${crypto.randomUUID()}@itest.plantpal.example`

let app: express.Express
let token = ''

const today = (() => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})()

describe.skipIf(!TEST_DB)('core flows against a real PostgreSQL', () => {
  beforeAll(async () => {
    initPool(TEST_DB!)
    await runMigrations()
    await runSeeds()
    app = createApp({ corsOrigins: ['http://localhost:5173'] })

    await request(app)
      .post('/api/auth/register')
      .set('x-plantpal-client', 'ANDROID')
      .send({ email, password: PASSWORD, confirmed_age: true })
    const login = await request(app)
      .post('/api/auth/login')
      .set('x-plantpal-client', 'ANDROID')
      .send({ email, password: PASSWORD })
    expect(login.status).toBe(200)
    token = login.body.access_token
  }, 120_000)

  afterAll(async () => {
    if (!TEST_DB) return
    const pool = getPool()
    await pool.query(`delete from users where email = $1`, [email])
    await pool.end()
  })

  const auth = () => ({ authorization: `Bearer ${token}` })

  it('creates a new account ACTIVE when email verification is off', async () => {
    const { rows } = await getPool().query<{ status: string }>(
      `select status from users where email = $1`,
      [email],
    )
    expect(rows[0]?.status).toBe('ACTIVE')
  })

  it('waters a plant and schedules the next watering', async () => {
    const species = await request(app).get('/api/v1/plants/species?q=tulsi').set(auth())
    expect(species.status).toBe(200)
    const list = Array.isArray(species.body) ? species.body : species.body.species
    const sp = list[0]
    expect(sp).toBeTruthy()

    const created = await request(app).post('/api/v1/plants').set(auth()).send({
      nickname: 'Integration tulsi',
      species_id: sp.id,
      base_interval_days: sp.base_interval_days,
      min_interval_days: sp.min_interval_days,
      max_interval_days: sp.max_interval_days,
      light_exposure: 'BRIGHT_INDIRECT',
      placement: 'INDOOR',
    })
    expect(created.status).toBe(201)

    const watered = await request(app)
      .post(`/api/v1/plants/${created.body.id}/care`)
      .set(auth())
      .send({ action_type: 'WATER', local_date_str: today })
    expect(watered.status).toBe(201)

    const plant = await request(app).get(`/api/v1/plants/${created.body.id}`).set(auth())
    expect(plant.status).toBe(200)
    expect(Number.isInteger(plant.body.effective_interval_days)).toBe(true)
    expect(plant.body.effective_interval_days).toBeGreaterThanOrEqual(1)
    expect(new Date(plant.body.next_water_due_at).getTime()).toBeGreaterThan(Date.now())
  })

  it('logs a workout, and refuses a bad intensity with a 422 rather than a 500', async () => {
    const ok = await request(app).post('/api/v1/fitness').set(auth()).send({
      activity_type: 'WALK',
      local_date_str: today,
      duration_mins: 30,
      perceived_intensity: 'MODERATE',
      steps: 4200,
    })
    expect(ok.status).toBe(201)
    // FR-FIT-05: no MET or body mass sent, so the catalogue MET (3.5) and the
    // 70 kg default are used — 3.5 × 70 × 30 / 60.
    expect(ok.body.calories_burned).toBeCloseTo(122.5, 1)
    expect(ok.body.met_value_at_log).toBe(3.5)
    expect(ok.body.body_mass_at_log_kg).toBe(70)

    const bad = await request(app).post('/api/v1/fitness').set(auth()).send({
      activity_type: 'YOGA',
      local_date_str: today,
      perceived_intensity: 'LIGHT',
    })
    expect(bad.status).toBe(422)
  })

  it('answers a malformed id with a 422, not a 500', async () => {
    const res = await request(app).get('/api/v1/plants/undefined').set(auth())
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('does not grow the one streak until every enabled module has counted', async () => {
    // Plants watered and a 30-minute walk: two of three. Nutrition needs two meals.
    const before = await request(app).get(`/api/v1/dashboard?date=${today}`).set(auth())
    expect(before.status).toBe(200)
    expect(before.body.streak.current).toBe(0)
    expect(before.body.fitness.steps).toBe(4200)
  })

  it('grows it once a module is switched off and the rest have counted', async () => {
    const off = await request(app)
      .put('/api/v1/settings')
      .set(auth())
      .send({ nutrition_enabled: false })
    expect(off.status).toBe(200)

    // The next qualifying log re-evaluates the day against the enabled set.
    const walk = await request(app).post('/api/v1/fitness').set(auth()).send({
      activity_type: 'RUN',
      local_date_str: today,
      duration_mins: 15,
    })
    expect(walk.status).toBe(201)

    const after = await request(app).get(`/api/v1/dashboard?date=${today}`).set(auth())
    expect(after.body.streak.current).toBe(1)
  })
})
