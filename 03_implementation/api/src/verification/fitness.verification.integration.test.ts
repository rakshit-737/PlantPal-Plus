/**
 * Fitness API (FR-FIT-01..): workouts, MET energy, strength volume and 1RM,
 * personal records, weekly summary, validation, ownership.
 * Test IDs: TC-FIT-101 ..
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type express from 'express'

import { cleanup, getPool, newUser, request, startApp, TEST_DB, today, type TestUser } from './harness.ts'

let app: express.Express
let u: TestUser

const post = (body: unknown, user = u) => request(app).post('/api/v1/fitness').set(user.auth()).send(body as object)

describe.skipIf(!TEST_DB)('Fitness API', () => {
  beforeAll(async () => {
    app = await startApp()
    u = await newUser(app, 'fit')
  }, 120_000)
  afterAll(cleanup)

  describe('catalogue (FR-FIT-01)', () => {
    it('TC-FIT-101 the seeded exercise catalogue is not empty and every row has a MET inside 1.0..23.0', async () => {
      const { rows } = await getPool().query<{ met_value: string }>('select met_value::text from exercises')
      expect(rows.length).toBeGreaterThan(0)
      for (const r of rows) {
        const met = Number(r.met_value)
        expect(met).toBeGreaterThanOrEqual(1)
        expect(met).toBeLessThanOrEqual(23)
      }
    })

    it('TC-FIT-102 search returns 200 with a list; a no-match query returns an empty list', async () => {
      const all = await request(app).get('/api/v1/fitness/exercises').set(u.auth())
      expect(all.status).toBe(200)
      const none = await request(app).get('/api/v1/fitness/exercises?q=zzzzzznotanexercise').set(u.auth())
      expect(none.status).toBe(200)
      const list = (b: unknown) => (Array.isArray(b) ? b : (b as { exercises: unknown[] }).exercises)
      expect(list(none.body)).toEqual([])
    })
  })

  describe('logging a workout (FR-FIT-02..05)', () => {
    it('TC-FIT-103 logs a timed workout: 201, MET and body mass stored at log time, energy = MET x kg x min / 60', async () => {
      const res = await post({ activity_type: 'RUN', local_date_str: today(), duration_mins: 45, perceived_intensity: 'MODERATE', met_value_at_log: 9.8, body_mass_at_log_kg: 72 })
      expect(res.status).toBe(201)
      expect(res.body.calories_burned).toBeCloseTo(529.2, 1)
      expect(res.body.met_value_at_log).toBe(9.8)
      expect(res.body.body_mass_at_log_kg).toBe(72)
    })

    it('TC-FIT-104 a workout without a duration is accepted and has no calorie estimate', async () => {
      const res = await post({ activity_type: 'YOGA', local_date_str: today() })
      expect(res.status).toBe(201)
      expect(res.body.calories_burned == null).toBe(true)
    })

    it.each(['WALK', 'RUN', 'CYCLE', 'SWIM', 'STRENGTH', 'YOGA', 'HIIT', 'SPORT', 'OTHER'])('TC-FIT-105 accepts activity type %s', async (t) => {
      expect((await post({ activity_type: t, local_date_str: today(), duration_mins: 10 })).status).toBe(201)
    })

    it.each([
      ['unknown activity type', { activity_type: 'KNITTING', local_date_str: today() }],
      ['missing activity type', { local_date_str: today() }],
      ['missing date', { activity_type: 'RUN' }],
      ['date in the wrong format', { activity_type: 'RUN', local_date_str: '17-10-2026' }],
      ['duration 0', { activity_type: 'RUN', local_date_str: today(), duration_mins: 0 }],
      ['duration 1441', { activity_type: 'RUN', local_date_str: today(), duration_mins: 1441 }],
      ['fractional duration', { activity_type: 'RUN', local_date_str: today(), duration_mins: 30.5 }],
      ['duration as text', { activity_type: 'RUN', local_date_str: today(), duration_mins: '30' }],
      ['intensity LIGHT', { activity_type: 'RUN', local_date_str: today(), perceived_intensity: 'LIGHT' }],
      ['steps -1', { activity_type: 'WALK', local_date_str: today(), steps: -1 }],
      ['steps 200001', { activity_type: 'WALK', local_date_str: today(), steps: 200001 }],
      ['note of 501 characters', { activity_type: 'RUN', local_date_str: today(), note: 'n'.repeat(501) }],
      ['MET below 1', { activity_type: 'RUN', local_date_str: today(), duration_mins: 10, met_value_at_log: 0.9 }],
      ['MET above 23', { activity_type: 'RUN', local_date_str: today(), duration_mins: 10, met_value_at_log: 23.1 }],
      ['body mass below 20', { activity_type: 'RUN', local_date_str: today(), duration_mins: 10, body_mass_at_log_kg: 19.9 }],
      ['body mass above 635', { activity_type: 'RUN', local_date_str: today(), duration_mins: 10, body_mass_at_log_kg: 635.1 }],
    ])('TC-FIT-106 rejects %s with 422', async (_l, body) => {
      const res = await post(body)
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_FAILED')
    })

    it('TC-FIT-107 accepts the boundaries: duration 1 and 1440, steps 0 and 200000, MET 1 and 23, mass 20 and 635, note of 500', async () => {
      const ok = [
        { duration_mins: 1 }, { duration_mins: 1440 }, { steps: 0 }, { steps: 200000 },
        { duration_mins: 10, met_value_at_log: 1 }, { duration_mins: 10, met_value_at_log: 23 },
        { duration_mins: 10, body_mass_at_log_kg: 20 }, { duration_mins: 10, body_mass_at_log_kg: 635 },
        { note: 'n'.repeat(500) },
      ]
      for (const extra of ok) {
        const res = await post({ activity_type: 'WALK', local_date_str: today(), ...extra })
        expect(res.status, JSON.stringify(extra)).toBe(201)
      }
    })

    it('TC-FIT-108 [DEF-010] the server computes calories itself; a client-supplied calories_burned is ignored (API spec section 3.4)', async () => {
      const res = await post({ activity_type: 'WALK', local_date_str: today(), duration_mins: 30, met_value_at_log: 3.5, body_mass_at_log_kg: 70, calories_burned: 99999 })
      expect(res.status).toBe(201)
      expect(res.body.calories_burned).toBeCloseTo(122.5, 1)
    })

    it('TC-FIT-109 [DEF-011] a fractional or negative rep count in a set is a 422, not an internal error', async () => {
      for (const reps of [-1, 2.5]) {
        const res = await post({ activity_type: 'STRENGTH', local_date_str: today(), sets: [{ reps, weight_kg: 50 }] })
        expect(res.status, `reps ${reps}`).toBe(422)
      }
    })

    it('TC-FIT-110 [DEF-011] a negative or non-numeric set weight is a 422, not an internal error', async () => {
      for (const w of [-5, 'heavy']) {
        const res = await post({ activity_type: 'STRENGTH', local_date_str: today(), sets: [{ reps: 5, weight_kg: w }] })
        expect(res.status, `weight ${String(w)}`).toBe(422)
      }
    })

    it('TC-FIT-111 [DEF-009] an impossible calendar date (month 13) is a 422, not an internal error', async () => {
      expect((await post({ activity_type: 'RUN', local_date_str: '2026-13-45', duration_mins: 10 })).status).toBe(422)
    })
  })

  describe('strength sets and records (FR-FIT-09..13, BR-FIT-14, BR-FIT-15)', () => {
    it('TC-FIT-112 three sets of 5 at 100 kg total 1500 kg of volume (spec vector)', async () => {
      const res = await post({ activity_type: 'STRENGTH', local_date_str: today(), sets: [1, 2, 3].map((i) => ({ set_index: i, reps: 5, weight_kg: 100 })) })
      expect(res.status).toBe(201)
      expect(Number(res.body.total_volume_kg)).toBe(1500)
    })

    it('TC-FIT-113 estimated 1RM for 100 kg x 5 is stored as 116.7 kg (spec vector)', async () => {
      const w = await post({ activity_type: 'STRENGTH', local_date_str: today(), sets: [{ reps: 5, weight_kg: 100 }] })
      const { rows } = await getPool().query<{ estimated_1rm_kg: string }>('select estimated_1rm_kg::text from workout_sets where workout_id = $1', [w.body.id])
      expect(Number(rows[0]!.estimated_1rm_kg)).toBe(116.7)
    })

    it('TC-FIT-114 a set above 12 reps is stored but carries no 1RM record estimate', async () => {
      const w = await post({ activity_type: 'STRENGTH', local_date_str: today(), sets: [{ reps: 13, weight_kg: 40 }] })
      const { rows } = await getPool().query<{ estimated_1rm_kg: string | null }>('select estimated_1rm_kg::text from workout_sets where workout_id = $1', [w.body.id])
      expect(rows[0]!.estimated_1rm_kg).toBeNull()
    })

    it('TC-FIT-115 a bodyweight set (0 kg) contributes zero volume', async () => {
      const w = await post({ activity_type: 'STRENGTH', local_date_str: today(), sets: [{ reps: 20, weight_kg: 0 }] })
      expect(Number(w.body.total_volume_kg)).toBe(0)
    })

    it('TC-FIT-116 personal-records endpoint answers 200 with a list', async () => {
      const res = await request(app).get('/api/v1/fitness/personal-records').set(u.auth())
      expect(res.status).toBe(200)
    })
  })

  describe('reading (FR-FIT-14..17)', () => {
    it('TC-FIT-117 list and get return only the caller\'s workouts; another user\'s id is 404', async () => {
      const other = await newUser(app, 'fit-other')
      const mine = await post({ activity_type: 'RUN', local_date_str: today(), duration_mins: 5, note: 'mine' })
      const theirs = await post({ activity_type: 'RUN', local_date_str: today(), duration_mins: 5, note: 'theirs' }, other)
      expect((await request(app).get(`/api/v1/fitness/${mine.body.id}`).set(u.auth())).status).toBe(200)
      expect((await request(app).get(`/api/v1/fitness/${theirs.body.id}`).set(u.auth())).status).toBe(404)
      const list = await request(app).get('/api/v1/fitness').set(u.auth())
      const notes = (list.body.workouts as Array<{ note: string | null }>).map((w) => w.note)
      expect(notes).not.toContain('theirs')
    })

    it('TC-FIT-118 pagination: limit is clamped to 1..100 and a bad value falls back safely', async () => {
      for (const q of ['limit=0', 'limit=1000', 'limit=abc', 'offset=-5', 'limit=1&offset=0']) {
        const res = await request(app).get(`/api/v1/fitness?${q}`).set(u.auth())
        expect(res.status, q).toBe(200)
        expect((res.body.workouts as unknown[]).length).toBeLessThanOrEqual(100)
      }
    })

    it('TC-FIT-119 weekly summary requires a valid week parameter (422 with field "week")', async () => {
      for (const q of ['', '?week=', '?week=2026-7-1', '?week=banana']) {
        const res = await request(app).get(`/api/v1/fitness/summary${q}`).set(u.auth())
        expect(res.status, q).toBe(422)
        expect(JSON.stringify(res.body.error.details)).toMatch(/week/)
      }
    })

    it('TC-FIT-120 weekly summary for a valid week answers 200', async () => {
      const res = await request(app).get(`/api/v1/fitness/summary?week=${today()}`).set(u.auth())
      expect(res.status).toBe(200)
    })

    it('TC-FIT-121 the literal paths /exercises, /summary and /personal-records are not swallowed by /:id', async () => {
      for (const path of ['exercises', 'personal-records']) {
        const res = await request(app).get(`/api/v1/fitness/${path}`).set(u.auth())
        expect(res.status, path).toBe(200)
      }
    })

    it('TC-FIT-122 a malformed workout id is 422, not 500', async () => {
      const res = await request(app).get('/api/v1/fitness/not-a-uuid').set(u.auth())
      expect(res.status).toBe(422)
    })
  })
})
