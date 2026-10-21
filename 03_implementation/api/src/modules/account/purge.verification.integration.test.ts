/**
 * Account erasure end to end against PostgreSQL (FR-ACC-21, BR-ACC-20, GDPR Art. 17).
 * Test IDs: TC-ACC-301 ..
 */
import { createHmac } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type express from 'express'

import { cleanup, getPool, newPlant, newUser, PASSWORD, request, startApp, TEST_DB, today } from '../../verification/harness.ts'

let app: express.Express
const q = async (sql: string, params: unknown[] = []) => (await getPool().query(sql, params)).rows

async function userWithData(label: string) {
  const u = await newUser(app, label)
  const plant = await newPlant(app, u)
  await request(app).post(`/api/v1/plants/${plant.body.id}/care`).set(u.auth()).send({ action_type: 'WATER', local_date_str: today() })
  await request(app).post(`/api/v1/plants/${plant.body.id}/growth`).set(u.auth()).send({ photo_url: 'https://example.com/p.jpg', local_date_str: today() })
  const w = await request(app).post('/api/v1/fitness').set(u.auth()).send({ activity_type: 'STRENGTH', local_date_str: today(), sets: [{ reps: 5, weight_kg: 100 }] })
  const m = await request(app).post('/api/v1/nutrition/meals').set(u.auth()).send({ meal_type: 'LUNCH', local_date_str: today(), items: [{ food_name_at_log: 'Rice', quantity: 1, serving_unit: 'CUP', grams: 150, kcal: 200, protein_g: 4, carbs_g: 44, fat_g: 0.4 }] })
  await request(app).post('/api/v1/nutrition/water').set(u.auth()).send({ amount_ml: 250, local_date_str: today() })
  await request(app).post('/api/v1/nutrition/foods').set(u.auth()).send({ name: `custom-${label}`, kcal_per_100g: 100, protein_per_100g: 1, carbs_per_100g: 1, fat_per_100g: 1 })
  return { u, workoutId: w.body.id as string, mealId: m.body.id as string }
}
const requestDeletion = (u: { auth: () => Record<string, string> }) => request(app).post('/api/v1/account/deletion').set(u.auth()).send({ password: PASSWORD })
const makeDue = (id: string) => q(`update users set purge_after = now() - interval '1 minute' where id = $1`, [id])

describe.skipIf(!TEST_DB)('Account erasure', () => {
  beforeAll(async () => {
    app = await startApp()
  }, 120_000)
  afterAll(cleanup)

  it('TC-ACC-301 a due account is erased completely: user row, every user-scoped table and child rows', async () => {
    const { runPurgePass } = await import('./purgeService.ts')
    const { USER_SCOPED_TABLES } = await import('./purgeRepo.ts')
    const { u, workoutId, mealId } = await userWithData('erase')
    await requestDeletion(u)
    await makeDue(u.id)
    const result = await runPurgePass()
    expect(result.erased).toBeGreaterThanOrEqual(1)
    expect(result.failed).toBe(0)
    expect(await q('select 1 from users where id = $1', [u.id])).toHaveLength(0)
    for (const { table, column } of USER_SCOPED_TABLES) {
      expect(await q(`select 1 from ${table} where ${column} = $1`, [u.id]), table).toHaveLength(0)
    }
    expect(await q('select 1 from workout_sets where workout_id = $1', [workoutId])).toHaveLength(0)
    expect(await q('select 1 from meal_items where meal_id = $1', [mealId])).toHaveLength(0)
  }, 60_000)

  it('TC-ACC-302 after erasure the credentials no longer work', async () => {
    const { runPurgePass } = await import('./purgeService.ts')
    const { u } = await userWithData('login-gone')
    await requestDeletion(u)
    await makeDue(u.id)
    await runPurgePass()
    const login = await request(app).post('/api/auth/login').send({ email: u.email, password: PASSWORD })
    expect(login.status).toBe(401)
    const me = await request(app).get('/api/auth/me').set(u.auth())
    expect(me.status).toBe(401)
  }, 60_000)

  it('TC-ACC-303 the audit trail keeps only a keyed hash of the subject: no email, no user id', async () => {
    const { runPurgePass } = await import('./purgeService.ts')
    const { u } = await userWithData('audit')
    await requestDeletion(u)
    await makeDue(u.id)
    await runPurgePass()
    const pepper = process.env['AUDIT_PEPPER'] ?? process.env['JWT_ACCESS_SECRET']!
    const hash = createHmac('sha256', pepper).update(u.id).digest('hex')
    const tomb = await q(`select payload from audit_events where event_type = 'ACCOUNT_ERASED' and payload->>'subject' = $1`, [hash])
    expect(tomb).toHaveLength(1)
    const everything = JSON.stringify(await q('select user_id, payload from audit_events'))
    expect(everything).not.toContain(u.email)
    expect(everything).not.toContain(u.id)
  }, 60_000)

  it('TC-ACC-304 an account still inside its grace window is not purged', async () => {
    const { runPurgePass } = await import('./purgeService.ts')
    const { u } = await userWithData('grace')
    await requestDeletion(u)
    await runPurgePass()
    expect(await q('select 1 from users where id = $1', [u.id])).toHaveLength(1)
  }, 60_000)

  it('TC-ACC-305 an account whose deletion was cancelled is not purged even if the date has passed', async () => {
    const { runPurgePass } = await import('./purgeService.ts')
    const { u } = await userWithData('cancelled')
    await requestDeletion(u)
    await request(app).delete('/api/v1/account/deletion').set(u.auth())
    await q(`update users set purge_after = now() - interval '1 day' where id = $1`, [u.id])
    await runPurgePass()
    expect(await q('select 1 from users where id = $1', [u.id])).toHaveLength(1)
  }, 60_000)

  it('TC-ACC-306 erasing one account leaves another account\'s data untouched', async () => {
    const { runPurgePass } = await import('./purgeService.ts')
    const gone = await userWithData('victim')
    const kept = await userWithData('bystander')
    await requestDeletion(gone.u)
    await makeDue(gone.u.id)
    await runPurgePass()
    expect(await q('select 1 from plants where user_id = $1', [kept.u.id])).not.toHaveLength(0)
    expect(await q('select 1 from workouts where user_id = $1', [kept.u.id])).not.toHaveLength(0)
  }, 90_000)

  it('TC-ACC-307 a second sweep finds nothing more to erase for an already-erased account (idempotent)', async () => {
    const { runPurgePass } = await import('./purgeService.ts')
    const { u } = await userWithData('twice')
    await requestDeletion(u)
    await makeDue(u.id)
    await runPurgePass()
    const again = await runPurgePass()
    expect(again.erased).toBe(0)
  }, 60_000)

  it('TC-ACC-308 failed-login history for the erased address is removed', async () => {
    const { runPurgePass } = await import('./purgeService.ts')
    const { u } = await userWithData('attempts')
    await request(app).post('/api/auth/login').send({ email: u.email, password: 'Wrong-Password-1234!' })
    await requestDeletion(u)
    await makeDue(u.id)
    await runPurgePass()
    expect(await q('select 1 from login_attempts where email_normalised = $1', [u.email.toLowerCase()])).toHaveLength(0)
  }, 60_000)

  it('TC-ACC-309 [DEF-019] the user is told by email that their data was erased (GDPR Art. 12 transparency; API spec section 4 gap)', async () => {
    // No mail transport exists in the API: the erasure sweep emits no notification.
    const mailer = await import('../../notifications/email.ts').catch(() => null)
    expect(mailer).not.toBeNull()
  })
})
