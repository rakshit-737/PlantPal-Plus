/**
 * Shared harness for the verification suites.
 *
 * Every suite in this folder runs the real Express app against a real
 * PostgreSQL (grey-box: black-box requests, real SQL). Set TEST_DATABASE_URL to
 * a DISPOSABLE database. Without it each suite is skipped, and a skipped suite
 * must be recorded as "Skipped", never "Pass".
 */
import request from 'supertest'
import type express from 'express'

export const TEST_DB = process.env['TEST_DATABASE_URL']

process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] = TEST_DB ?? 'postgresql://unused:unused@localhost:5432/unused'
process.env['JWT_ACCESS_SECRET'] ??= 'integration-secret-at-least-32-characters-long'

const { initPool, getPool } = await import('../db/pool.ts')
const { runMigrations } = await import('../db/migrate.ts')
const { runSeeds } = await import('../db/seed.ts')
const { createApp } = await import('../app.ts')

export { request, getPool }
export const PASSWORD = 'Correct-Horse-Battery-9!'
export const ORIGIN = 'http://localhost:5173'
export const SECRET = process.env['JWT_ACCESS_SECRET']!

export interface TestUser {
  email: string
  token: string
  refreshToken: string
  id: string
  auth: () => { authorization: string }
}

const created: string[] = []

export async function startApp(): Promise<express.Express> {
  initPool(TEST_DB!)
  await runMigrations()
  await runSeeds()
  return createApp({ corsOrigins: [ORIGIN] })
}

/** Register and sign in a fresh user through the public API (mobile client, so the refresh token is in the body). */
export async function newUser(app: express.Express, label = 'u'): Promise<TestUser> {
  const email = `${label}-${crypto.randomUUID()}@verify.plantpal.example`
  created.push(email)
  const reg = await request(app)
    .post('/api/auth/register')
    .set('x-plantpal-client', 'ANDROID')
    .send({ email, password: PASSWORD, confirmed_age: true })
  if (reg.status !== 202 && reg.status !== 201) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`)
  const login = await request(app)
    .post('/api/auth/login')
    .set('x-plantpal-client', 'ANDROID')
    .send({ email, password: PASSWORD })
  if (login.status !== 200) throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`)
  const token = login.body.access_token as string
  return {
    email,
    token,
    refreshToken: login.body.refresh_token as string,
    id: login.body.user.id as string,
    auth: () => ({ authorization: `Bearer ${token}` }),
  }
}

export async function cleanup(): Promise<void> {
  if (!TEST_DB) return
  const pool = getPool()
  if (created.length) await pool.query(`delete from users where email = any($1)`, [created])
  // Registrations made directly by a test (not via newUser) all use this domain.
  await pool.query(`delete from users where email like '%@verify.plantpal.example'`)
  await pool.end()
}

/** The caller's local calendar date as YYYY-MM-DD. */
export function today(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Look up a seeded species to build a valid plant. */
export async function anySpecies(app: express.Express, user: TestUser) {
  const res = await request(app).get('/api/v1/plants/species?q=a').set(user.auth())
  const list = Array.isArray(res.body) ? res.body : res.body.species
  const sp = list[0]
  return {
    species_id: sp.id as string,
    base_interval_days: sp.base_interval_days as number,
    min_interval_days: sp.min_interval_days as number,
    max_interval_days: sp.max_interval_days as number,
  }
}

export async function newPlant(app: express.Express, user: TestUser, over: Record<string, unknown> = {}) {
  const sp = await anySpecies(app, user)
  const res = await request(app)
    .post('/api/v1/plants')
    .set(user.auth())
    .send({ nickname: 'Verification plant', ...sp, light_exposure: 'BRIGHT_INDIRECT', placement: 'INDOOR', ...over })
  return res
}
