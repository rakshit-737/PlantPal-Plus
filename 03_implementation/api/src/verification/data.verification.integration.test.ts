/**
 * Data integrity (NFR-DATA): migrations, seeds, constraints.
 * Test IDs: TC-DAT-001 ..
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { cleanup, getPool, newUser, startApp, TEST_DB } from './harness.ts'

const count = async (sql: string, params: unknown[] = []) => {
  const { rows } = await getPool().query<{ n: string }>(sql, params)
  return Number(rows[0]!.n)
}

describe.skipIf(!TEST_DB)('Data integrity', () => {
  beforeAll(async () => {
    await startApp()
  }, 120_000)
  afterAll(cleanup)

  it('TC-DAT-001 re-running every migration applies nothing and skips all (idempotent)', async () => {
    const { runMigrations } = await import('../db/migrate.ts')
    const r = await runMigrations()
    expect(r.applied).toBe(0)
    expect(r.skipped).toBeGreaterThanOrEqual(7)
  })

  it('TC-DAT-002 re-running the seeds does not duplicate catalogue rows', async () => {
    const { runSeeds } = await import('../db/seed.ts')
    const before = [await count('select count(*)::text n from species'), await count('select count(*)::text n from foods where is_custom = false'), await count('select count(*)::text n from achievements'), await count('select count(*)::text n from exercises')]
    await runSeeds()
    const after = [await count('select count(*)::text n from species'), await count('select count(*)::text n from foods where is_custom = false'), await count('select count(*)::text n from achievements'), await count('select count(*)::text n from exercises')]
    expect(after).toEqual(before)
  })

  it('TC-DAT-003 seeded catalogue sizes match the documented figures: 94 species, 180 foods, 16 achievements', async () => {
    expect(await count('select count(*)::text n from species')).toBe(94)
    expect(await count('select count(*)::text n from foods where is_custom = false')).toBe(180)
    expect(await count('select count(*)::text n from achievements')).toBe(16)
  })

  it('TC-DAT-004 every species has a coherent care profile: 1 <= min <= base <= max', async () => {
    const bad = await count('select count(*)::text n from species where min_interval_days < 1 or min_interval_days > base_interval_days or base_interval_days > max_interval_days')
    expect(bad).toBe(0)
  })

  it('TC-DAT-005 achievement codes are unique', async () => {
    const dup = await count('select count(*)::text n from (select code from achievements group by code having count(*) > 1) d')
    expect(dup).toBe(0)
  })

  it('TC-DAT-006 registering the same address in two letter-cases leaves exactly one account', async () => {
    const { request } = await import('./harness.ts')
    const app = await startApp()
    const base = `case-${crypto.randomUUID()}@verify.plantpal.example`
    const body = { password: 'Correct-Horse-Battery-9!', confirmed_age: true }
    await request(app).post('/api/auth/register').send({ email: base, ...body })
    await request(app).post('/api/auth/register').send({ email: base.toUpperCase(), ...body })
    const n = await count('select count(*)::text n from users where email_normalised = $1', [base.toLowerCase()])
    expect(n).toBe(1)
  })

  it.each([
    ['a plant with an invalid light exposure', `insert into plants (user_id, nickname, base_interval_days, min_interval_days, max_interval_days, light_exposure, placement) select id, 'x', 7, 3, 14, 'BOGUS', 'INDOOR' from users limit 1`],
    ['a workout with a negative duration', `insert into workouts (user_id, activity_type, duration_mins, local_date_str) select id, 'RUN', -5, '2026-01-01' from users limit 1`],
  ])('TC-DAT-007 the schema rejects %s at the database level (defence in depth)', async (_l, sql) => {
    // SQLSTATE class 23 = integrity constraint violation (not a typo or missing column)
    await expect(getPool().query(sql)).rejects.toMatchObject({ code: expect.stringMatching(/^23/) })
  })

  it('TC-DAT-008 the refresh token is stored only as a digest, never in clear', async () => {
    const u = await newUser(await startApp(), 'digest')
    const { rows } = await getPool().query<{ refresh_token_digest: string }>('select refresh_token_digest from auth_tokens limit 50')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((r) => r.refresh_token_digest === u.refreshToken)).toBe(false)
    expect(rows.every((r) => /^[0-9a-f]{64}$/i.test(r.refresh_token_digest))).toBe(true)
  })

  it('TC-DAT-009 passwords are stored as Argon2id hashes, never in clear', async () => {
    const u = await newUser(await startApp(), 'argon')
    const { rows } = await getPool().query<{ password_hash: string }>('select password_hash from users where email = $1', [u.email])
    expect(rows[0]!.password_hash).toMatch(/^\$argon2id\$/)
  })
})
