/**
 * Nutrition API (FR-NUT-01..): food search, custom foods, meals, hydration,
 * daily summary, validation and privacy of custom foods.
 * Test IDs: TC-NUT-101 ..
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type express from 'express'

import { cleanup, getPool, newUser, request, startApp, TEST_DB, today, type TestUser } from './harness.ts'

let app: express.Express
let u: TestUser

const food = (over: Record<string, unknown> = {}) => ({ name: `Verif food ${crypto.randomUUID().slice(0, 8)}`, kcal_per_100g: 120, protein_per_100g: 5, carbs_per_100g: 20, fat_per_100g: 2, ...over })
const createFood = (body: unknown, user = u) => request(app).post('/api/v1/nutrition/foods').set(user.auth()).send(body as object)
const item = (over: Record<string, unknown> = {}) => ({ food_name_at_log: 'Banana', quantity: 1, serving_unit: 'PIECE', grams: 118, kcal: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, ...over })
const logMeal = (body: unknown, user = u) => request(app).post('/api/v1/nutrition/meals').set(user.auth()).send(body as object)
const meal = (over: Record<string, unknown> = {}) => ({ meal_type: 'BREAKFAST', local_date_str: today(), items: [item()], ...over })

describe.skipIf(!TEST_DB)('Nutrition API', () => {
  beforeAll(async () => {
    app = await startApp()
    u = await newUser(app, 'nut')
  }, 120_000)
  afterAll(cleanup)

  describe('food catalogue and search (FR-NUT-01..09)', () => {
    it('TC-NUT-101 [data] the seeded catalogue holds 180 foods, none with negative energy or macros', async () => {
      const { rows } = await getPool().query<{ n: string; bad: string }>(
        `select count(*)::text n, count(*) filter (where kcal_per_100g < 0 or protein_per_100g < 0 or carbs_per_100g < 0 or fat_per_100g < 0)::text bad from foods where is_custom = false`,
      )
      expect(Number(rows[0]!.n)).toBe(180)
      expect(Number(rows[0]!.bad)).toBe(0)
    })

    it('TC-NUT-102 search is case-insensitive and substring-based', async () => {
      const a = await request(app).get('/api/v1/nutrition/foods/search?q=banana').set(u.auth())
      const b = await request(app).get('/api/v1/nutrition/foods/search?q=BANANA').set(u.auth())
      const c = await request(app).get('/api/v1/nutrition/foods/search?q=anan').set(u.auth())
      expect(a.status).toBe(200)
      expect(a.body.foods.length).toBeGreaterThan(0)
      expect(b.body.foods.length).toBe(a.body.foods.length)
      expect(c.body.foods.length).toBeGreaterThanOrEqual(a.body.foods.length)
    })

    it('TC-NUT-103 a no-match query returns an empty list, and a repeated q parameter is a 422', async () => {
      const none = await request(app).get('/api/v1/nutrition/foods/search?q=zzzzzznotafood').set(u.auth())
      expect(none.body.foods).toEqual([])
      const dup = await request(app).get('/api/v1/nutrition/foods/search?q=a&q=b').set(u.auth())
      expect(dup.status).toBe(422)
    })

    it('TC-NUT-104 SQL metacharacters in the query are inert', async () => {
      for (const q of ["'; drop table foods;--", "' OR '1'='1", '%', '_']) {
        const res = await request(app).get('/api/v1/nutrition/foods/search').query({ q }).set(u.auth())
        expect(res.status, q).toBeLessThan(500)
      }
      const { rows } = await getPool().query("select to_regclass('public.foods') t")
      expect(rows[0]!.t).not.toBeNull()
    })
  })

  describe('custom foods (FR-NUT-10, strict body)', () => {
    it('TC-NUT-105 creates a custom food (201) that appears in the creator\'s search', async () => {
      const f = food({ name: 'Zorblax custom crisp' })
      const res = await createFood(f)
      expect(res.status).toBe(201)
      const s = await request(app).get('/api/v1/nutrition/foods/search?q=zorblax').set(u.auth())
      expect(s.body.foods.some((x: { name: string }) => x.name === 'Zorblax custom crisp')).toBe(true)
    })

    it('TC-NUT-106 a custom food is invisible to every other user', async () => {
      const other = await newUser(app, 'nut-other')
      await createFood(food({ name: 'Quuxberry private' }))
      const s = await request(app).get('/api/v1/nutrition/foods/search?q=quuxberry').set(other.auth())
      expect(s.body.foods).toEqual([])
    })

    it.each([
      ['empty name', { name: '' }],
      ['name of 121 characters', { name: 'n'.repeat(121) }],
      ['brand of 81 characters', { brand: 'b'.repeat(81) }],
      ['kcal -1', { kcal_per_100g: -1 }],
      ['kcal 9001', { kcal_per_100g: 9001 }],
      ['protein 100.1', { protein_per_100g: 100.1 }],
      ['carbs -0.1', { carbs_per_100g: -0.1 }],
      ['fat 101', { fat_per_100g: 101 }],
      ['unknown serving unit', { default_serving_unit: 'BUCKET' }],
      ['serving grams 0.09', { default_serving_grams: 0.09 }],
      ['serving grams 5001', { default_serving_grams: 5001 }],
      ['barcode of 7 digits', { barcode: '1234567' }],
      ['barcode with letters', { barcode: '12345abc78' }],
      ['unknown extra field', { colour: 'green' }],
      ['kcal as text', { kcal_per_100g: '120' }],
    ])('TC-NUT-107 rejects %s with 422', async (_l, over) => {
      const res = await createFood(food(over))
      expect(res.status).toBe(422)
    })

    it('TC-NUT-108 accepts the boundaries: name 1 and 120, kcal 0 and 9000, macros 0 and 100, barcode 8 and 14 digits, grams 0.1 and 5000', async () => {
      const ok = [
        { name: 'x' }, { name: 'n'.repeat(120) }, { kcal_per_100g: 0 }, { kcal_per_100g: 9000 },
        { protein_per_100g: 0 }, { protein_per_100g: 100 }, { barcode: '12345678' }, { barcode: '12345678901234' },
        { default_serving_grams: 0.1 }, { default_serving_grams: 5000 },
      ]
      for (const over of ok) {
        const res = await createFood(food({ name: `b-${crypto.randomUUID().slice(0, 8)}`, ...over }))
        expect(res.status, JSON.stringify(over).slice(0, 60)).toBe(201)
      }
    })

    it('TC-NUT-109 deleting your own custom food succeeds; a repeat or another user\'s id is 404; a malformed id is 422', async () => {
      const other = await newUser(app, 'nut-del')
      const f = await createFood(food())
      expect((await request(app).delete(`/api/v1/nutrition/foods/${f.body.id}`).set(other.auth())).status).toBe(404)
      expect((await request(app).delete(`/api/v1/nutrition/foods/${f.body.id}`).set(u.auth())).status).toBe(200)
      expect((await request(app).delete(`/api/v1/nutrition/foods/${f.body.id}`).set(u.auth())).status).toBe(404)
      expect((await request(app).delete('/api/v1/nutrition/foods/not-a-uuid').set(u.auth())).status).toBe(422)
    })

    it('TC-NUT-110 a user cannot delete a catalogue food', async () => {
      const { rows } = await getPool().query<{ id: string }>('select id from foods where is_custom = false limit 1')
      expect((await request(app).delete(`/api/v1/nutrition/foods/${rows[0]!.id}`).set(u.auth())).status).toBe(404)
    })
  })

  describe('meals (FR-NUT-14..20)', () => {
    it.each(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'])('TC-NUT-111 logs a %s meal (201)', async (t) => {
      expect((await logMeal(meal({ meal_type: t }))).status).toBe(201)
    })

    it.each([
      ['unknown meal type', meal({ meal_type: 'BRUNCH' })],
      ['missing meal type', meal({ meal_type: undefined })],
      ['bad date format', meal({ local_date_str: '17/10/2026' })],
      ['no items', meal({ items: [] })],
      ['items not an array', meal({ items: 'banana' })],
      ['item without a name', meal({ items: [item({ food_name_at_log: undefined })] })],
      ['quantity 0', meal({ items: [item({ quantity: 0 })] })],
      ['negative quantity', meal({ items: [item({ quantity: -1 })] })],
      ['unknown serving unit', meal({ items: [item({ serving_unit: 'BUCKET' })] })],
      ['grams 0', meal({ items: [item({ grams: 0 })] })],
      ['negative kcal', meal({ items: [item({ kcal: -1 })] })],
    ])('TC-NUT-112 rejects %s with 422', async (_l, body) => {
      const res = await logMeal(body)
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_FAILED')
    })

    it('TC-NUT-113 reports the index of the failing item in the error detail', async () => {
      const res = await logMeal(meal({ items: [item(), item({ grams: 0 })] }))
      expect(JSON.stringify(res.body.error.details)).toMatch(/items\[1\]\.grams/)
    })

    it('TC-NUT-114 kcal 0 is allowed (water-like items)', async () => {
      expect((await logMeal(meal({ items: [item({ kcal: 0 })] }))).status).toBe(201)
    })

    it('TC-NUT-115 [DEF-009] an impossible calendar date (month 13) is a 422, not an internal error', async () => {
      expect((await logMeal(meal({ local_date_str: '2026-13-45' }))).status).toBe(422)
    })

    it('TC-NUT-116 negative macro grams are rejected (a negative value would silently reduce the daily total)', async () => {
      const res = await logMeal(meal({ items: [item({ protein_g: -50 })] }))
      expect(res.status).toBe(422)
    })

    it('TC-NUT-117 [DEF-013] replaying a meal with the same idempotency key returns the original result (200 + Idempotent-Replay), not 409 (BR-SYS-05)', async () => {
      const key = crypto.randomUUID()
      const date = today(-2)
      const a = await logMeal(meal({ local_date_str: date, client_idempotency_key: key }))
      const b = await logMeal(meal({ local_date_str: date, client_idempotency_key: key }))
      expect(a.status).toBe(201)
      expect(b.status).toBe(200)
      expect(b.headers['idempotent-replay']).toBe('true')
    })

    it('TC-NUT-117b [DEF-013] the same holds for a water log replay', async () => {
      const key = crypto.randomUUID()
      const send = () => request(app).post('/api/v1/nutrition/water').set(u.auth()).send({ amount_ml: 250, local_date_str: today(), client_idempotency_key: key })
      expect((await send()).status).toBe(201)
      expect((await send()).status).toBe(200)
    })

    it('TC-NUT-117c a replayed meal is never stored twice, whatever status it returns', async () => {
      const key = crypto.randomUUID()
      const date = today(-3)
      await logMeal(meal({ local_date_str: date, client_idempotency_key: key }))
      await logMeal(meal({ local_date_str: date, client_idempotency_key: key }))
      const sum = await request(app).get(`/api/v1/nutrition/summary?date=${date}`).set(u.auth())
      expect(sum.body.total_kcal ?? sum.body.totals?.kcal).toBeCloseTo(105, 1)
    })
  })

  describe('daily summary and hydration (FR-NUT-21..26)', () => {
    it('TC-NUT-118 the daily total is the sum of its items', async () => {
      const date = today(-5)
      await logMeal(meal({ local_date_str: date, items: [item({ kcal: 100 }), item({ kcal: 250 })] }))
      await logMeal(meal({ local_date_str: date, meal_type: 'LUNCH', items: [item({ kcal: 50 })] }))
      const sum = await request(app).get(`/api/v1/nutrition/summary?date=${date}`).set(u.auth())
      expect(sum.status).toBe(200)
      expect(sum.body.total_kcal ?? sum.body.totals?.kcal).toBeCloseTo(400, 1)
    })

    it('TC-NUT-119 a day with nothing logged returns 200 with zero totals, not an error', async () => {
      const sum = await request(app).get(`/api/v1/nutrition/summary?date=${today(-400)}`).set(u.auth())
      expect(sum.status).toBe(200)
      expect(Number(sum.body.total_kcal ?? sum.body.totals?.kcal ?? 0)).toBe(0)
    })

    it('TC-NUT-120 a malformed summary date is 422', async () => {
      expect((await request(app).get('/api/v1/nutrition/summary?date=yesterday').set(u.auth())).status).toBe(422)
    })

    it('TC-NUT-121 a day\'s summary does not include another user\'s meals', async () => {
      const other = await newUser(app, 'nut-sum')
      const date = today(-6)
      await logMeal(meal({ local_date_str: date, items: [item({ kcal: 999 })] }), other)
      const sum = await request(app).get(`/api/v1/nutrition/summary?date=${date}`).set(u.auth())
      expect(Number(sum.body.total_kcal ?? sum.body.totals?.kcal ?? 0)).toBe(0)
    })

    it.each([[1, 201], [5000, 201], [0, 422], [5001, 422], [-100, 422]])('TC-NUT-122 water amount %i ml -> %i', async (ml, status) => {
      const res = await request(app).post('/api/v1/nutrition/water').set(u.auth()).send({ amount_ml: ml, local_date_str: today() })
      expect(res.status).toBe(status)
    })

    it('TC-NUT-123 water rejects a non-numeric amount and a bad date', async () => {
      expect((await request(app).post('/api/v1/nutrition/water').set(u.auth()).send({ amount_ml: '250', local_date_str: today() })).status).toBe(422)
      expect((await request(app).post('/api/v1/nutrition/water').set(u.auth()).send({ amount_ml: 250, local_date_str: 'today' })).status).toBe(422)
    })
  })
})
