/**
 * Offline sync outbox (FR-SYS, BR-SYS-05): POST /api/v1/sync/outbox.
 * Test IDs: TC-SYS-101 ..
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type express from 'express'

import { cleanup, getPool, newPlant, newUser, request, startApp, TEST_DB, today, type TestUser } from './harness.ts'

let app: express.Express
let u: TestUser

const uuid = () => crypto.randomUUID()
const mealPayload = (over: Record<string, unknown> = {}) => ({
  meal_type: 'LUNCH', local_date_str: today(),
  items: [{ food_name_at_log: 'Rice', quantity: 1, serving_unit: 'CUP', grams: 150, kcal: 200, protein_g: 4, carbs_g: 44, fat_g: 0.4 }],
  ...over,
})
const water = (key = uuid(), amount = 250) => ({ client_idempotency_key: key, entity_type: 'WATER_LOG', payload: { amount_ml: amount, local_date_str: today() } })
const send = (events: unknown[], user = u) => request(app).post('/api/v1/sync/outbox').set(user.auth()).send({ events })

describe.skipIf(!TEST_DB)('Offline sync outbox', () => {
  beforeAll(async () => {
    app = await startApp()
    u = await newUser(app, 'sync')
  }, 120_000)
  afterAll(cleanup)

  it('TC-SYS-101 requires authentication', async () => {
    expect((await request(app).post('/api/v1/sync/outbox').send({ events: [water()] })).status).toBe(401)
  })

  it('TC-SYS-102 a valid event is PROCESSED once, with an entity id and replay=false', async () => {
    const res = await send([water()])
    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(1)
    expect(res.body.results[0]).toMatchObject({ status: 'PROCESSED', replay: false, error_code: null })
    expect(res.body.results[0].entity_id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('TC-SYS-103 replaying the same key returns the recorded outcome and does not store a second row', async () => {
    const key = uuid()
    const first = await send([water(key, 123)])
    const again = await send([water(key, 123)])
    expect(again.body.results[0].replay).toBe(true)
    expect(again.body.results[0].entity_id).toBe(first.body.results[0].entity_id)
    const { rows } = await getPool().query<{ n: string }>(`select count(*)::text n from water_logs where user_id = $1 and amount_ml = 123`, [u.id])
    expect(Number(rows[0]!.n)).toBe(1)
  })

  it('TC-SYS-104 a key already ingested through the online path counts as a successful replay', async () => {
    const key = uuid()
    const online = await request(app).post('/api/v1/nutrition/meals').set(u.auth()).send({ ...mealPayload(), client_idempotency_key: key })
    expect(online.status).toBe(201)
    const res = await send([{ client_idempotency_key: key, entity_type: 'MEAL', payload: mealPayload() }])
    expect(res.body.results[0]).toMatchObject({ status: 'PROCESSED', replay: true })
  })

  it('TC-SYS-105 results come back in the order the events were sent', async () => {
    const keys = [uuid(), uuid(), uuid()]
    const res = await send(keys.map((k, i) => water(k, 100 + i)))
    expect(res.body.results.map((r: { client_idempotency_key: string }) => r.client_idempotency_key)).toEqual(keys)
  })

  it('TC-SYS-106 a bad payload fails only its own event (200, FAILED/VALIDATION_FAILED) and the next event still applies', async () => {
    const bad = { client_idempotency_key: uuid(), entity_type: 'WATER_LOG', payload: { amount_ml: 0, local_date_str: today() } }
    const good = water()
    const res = await send([bad, good])
    expect(res.status).toBe(200)
    expect(res.body.results[0]).toMatchObject({ status: 'FAILED', error_code: 'VALIDATION_FAILED', entity_id: null })
    expect(res.body.results[1].status).toBe('PROCESSED')
  })

  it('TC-SYS-107 a FAILED outcome is terminal: replaying the key returns the same failure', async () => {
    const bad = { client_idempotency_key: uuid(), entity_type: 'WATER_LOG', payload: { amount_ml: -5, local_date_str: today() } }
    await send([bad])
    const again = await send([bad])
    expect(again.body.results[0]).toMatchObject({ status: 'FAILED', error_code: 'VALIDATION_FAILED' })
  })

  it('TC-SYS-108 a payload with an unknown field fails that event (strict payload)', async () => {
    const ev = { client_idempotency_key: uuid(), entity_type: 'WATER_LOG', payload: { amount_ml: 250, local_date_str: today(), logged_at_utc: new Date().toISOString() } }
    expect((await send([ev])).body.results[0].status).toBe('FAILED')
  })

  describe('envelope validation rejects the whole request with 422 and applies nothing', () => {
    it.each([
      ['empty events array', { events: [] }],
      ['events missing', {}],
      ['events not an array', { events: 'x' }],
      ['51 events', { events: Array.from({ length: 51 }, () => water()) }],
      ['unknown entity type', { events: [{ client_idempotency_key: uuid(), entity_type: 'SLEEP', payload: {} }] }],
      ['key not a UUID', { events: [{ client_idempotency_key: 'abc', entity_type: 'WATER_LOG', payload: {} }] }],
      ['key a UUID v1, not v4', { events: [{ client_idempotency_key: 'c232ab00-9414-11ec-b3c8-9f6bdeced846', entity_type: 'WATER_LOG', payload: {} }] }],
      ['unknown key on the event', { events: [{ ...water(), surprise: 1 }] }],
      ['unknown key on the body', { events: [water()], extra: true }],
    ])('TC-SYS-109 %s', async (_l, body) => {
      const before = await getPool().query<{ n: string }>('select count(*)::text n from water_logs where user_id = $1', [u.id])
      const res = await request(app).post('/api/v1/sync/outbox').set(u.auth()).send(body)
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_FAILED')
      const after = await getPool().query<{ n: string }>('select count(*)::text n from water_logs where user_id = $1', [u.id])
      expect(after.rows[0]!.n).toBe(before.rows[0]!.n)
    })

    it('TC-SYS-110 exactly 50 events is accepted (boundary)', async () => {
      const res = await send(Array.from({ length: 50 }, () => water()))
      expect(res.status).toBe(200)
      expect(res.body.results).toHaveLength(50)
    }, 60_000)
  })

  it('TC-SYS-111 a care event for another user\'s plant fails with PARENT_NOT_FOUND', async () => {
    const other = await newUser(app, 'sync-other')
    const plant = await newPlant(app, other)
    const ev = { client_idempotency_key: uuid(), entity_type: 'PLANT_CARE_EVENT', payload: { plant_id: plant.body.id, action_type: 'WATER', local_date_str: today() } }
    const res = await send([ev])
    expect(res.body.results[0]).toMatchObject({ status: 'FAILED', error_code: 'PARENT_NOT_FOUND' })
  })

  it('TC-SYS-112 the same key sent by a different user is processed independently (keys are per user)', async () => {
    const other = await newUser(app, 'sync-iso')
    const key = uuid()
    const a = await send([water(key)])
    const b = await send([water(key)], other)
    expect(a.body.results[0].replay).toBe(false)
    expect(b.body.results[0].replay).toBe(false)
  })

  it('TC-SYS-113 a dated event outside the accepted window (more than a year old) fails validation', async () => {
    const old = { client_idempotency_key: uuid(), entity_type: 'WATER_LOG', payload: { amount_ml: 250, local_date_str: today(-400) } }
    expect((await send([old])).body.results[0]).toMatchObject({ status: 'FAILED', error_code: 'VALIDATION_FAILED' })
  })

  it('TC-SYS-114 [DEF-014] a workout body mass accepted online (20..635, BR-ACC-14) is also accepted from the queue', async () => {
    const online = await request(app).post('/api/v1/fitness').set(u.auth()).send({ activity_type: 'WALK', local_date_str: today(), duration_mins: 10, body_mass_at_log_kg: 500 })
    expect(online.status).toBe(201)
    const queued = await send([{ client_idempotency_key: uuid(), entity_type: 'WORKOUT', payload: { activity_type: 'WALK', local_date_str: today(), duration_mins: 10, body_mass_at_log_kg: 500 } }])
    expect(queued.body.results[0].status).toBe('PROCESSED')
  })

  it('TC-SYS-115 a queued workout gets server-computed energy, like the online path', async () => {
    const res = await send([{ client_idempotency_key: uuid(), entity_type: 'WORKOUT', payload: { activity_type: 'RUN', local_date_str: today(), duration_mins: 45, perceived_intensity: 'MODERATE', met_value_at_log: 9.8, body_mass_at_log_kg: 72 } }])
    const id = res.body.results[0].entity_id as string
    const { rows } = await getPool().query<{ calories_burned: string }>('select calories_burned::text from workouts where id = $1', [id])
    expect(Number(rows[0]!.calories_burned)).toBeCloseTo(529.2, 1)
  })
})
