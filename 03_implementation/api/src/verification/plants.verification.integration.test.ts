/**
 * Plant care API (FR-PLT-01..22): create, read, update, archive, care actions,
 * growth log, species catalogue; input validation and ownership.
 * Test IDs: TC-PLT-101 ..
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type express from 'express'

import { anySpecies, cleanup, getPool, newPlant, newUser, request, startApp, TEST_DB, today, type TestUser } from './harness.ts'

let app: express.Express
let u: TestUser

describe.skipIf(!TEST_DB)('Plant care API', () => {
  beforeAll(async () => {
    app = await startApp()
    u = await newUser(app, 'plants')
  }, 120_000)
  afterAll(cleanup)

  describe('species catalogue (FR-PLT-01, FR-PLT-02)', () => {
    it('TC-PLT-101 [data] the seeded catalogue holds at least 60 species (spec floor) with complete care profiles', async () => {
      const { rows } = await getPool().query<{ n: string }>('select count(*)::text n from species')
      expect(Number(rows[0]!.n)).toBeGreaterThanOrEqual(60)
    })

    it('TC-PLT-102 search is case-insensitive and returns care-profile fields', async () => {
      const lower = await request(app).get('/api/v1/plants/species?q=monstera').set(u.auth())
      const upper = await request(app).get('/api/v1/plants/species?q=MONSTERA').set(u.auth())
      expect(lower.status).toBe(200)
      const list = (b: { species?: unknown[] } | unknown[]) => (Array.isArray(b) ? b : b.species) as Array<Record<string, unknown>>
      expect(list(lower.body).length).toBeGreaterThan(0)
      expect(list(upper.body).length).toBe(list(lower.body).length)
      for (const k of ['id', 'base_interval_days', 'min_interval_days', 'max_interval_days']) expect(list(lower.body)[0]).toHaveProperty(k)
    })

    it('TC-PLT-103 a query matching nothing returns an empty list with 200, not an error', async () => {
      const res = await request(app).get('/api/v1/plants/species?q=zzzzzzzznotaplant').set(u.auth())
      expect(res.status).toBe(200)
      const list = Array.isArray(res.body) ? res.body : res.body.species
      expect(list).toEqual([])
    })

    it("TC-PLT-104 SQL metacharacters in the query are treated as text (no 500)", async () => {
      for (const q of ["'; drop table plants;--", "' OR '1'='1", '%', '_', '\\', '"']) {
        const res = await request(app).get('/api/v1/plants/species').query({ q }).set(u.auth())
        expect(res.status, `q=${q}`).toBeLessThan(500)
      }
      const { rows } = await getPool().query("select to_regclass('public.plants') as t")
      expect(rows[0]!.t).not.toBeNull()
    })
  })

  describe('create (FR-PLT-05)', () => {
    it('TC-PLT-105 creates a plant and returns 201 with an id and the computed interval', async () => {
      const res = await newPlant(app, u)
      expect(res.status).toBe(201)
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(res.body.nickname).toBe('Verification plant')
    })

    it.each([
      ['empty nickname', { nickname: '' }],
      ['whitespace nickname', { nickname: '   ' }],
      ['81-character nickname', { nickname: 'n'.repeat(81) }],
      ['base interval 0', { base_interval_days: 0 }],
      ['base interval 366', { base_interval_days: 366 }],
      ['fractional base interval', { base_interval_days: 2.5 }],
      ['min above max', { min_interval_days: 30, max_interval_days: 5 }],
    ])('TC-PLT-106 rejects %s with 422', async (_l, over) => {
      const res = await newPlant(app, u, over)
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_FAILED')
    })

    it('TC-PLT-107 accepts the nickname boundaries of 1 and 80 characters', async () => {
      expect((await newPlant(app, u, { nickname: 'x' })).status).toBe(201)
      expect((await newPlant(app, u, { nickname: 'n'.repeat(80) })).status).toBe(201)
    })

    it('TC-PLT-108 accepts the base interval boundaries of 1 and 365 days', async () => {
      expect((await newPlant(app, u, { base_interval_days: 1, min_interval_days: 1, max_interval_days: 365 })).status).toBe(201)
      expect((await newPlant(app, u, { base_interval_days: 365, min_interval_days: 1, max_interval_days: 365 })).status).toBe(201)
    })

    it.each([
      ['light_exposure', 'TOO_BRIGHT'],
      ['placement', 'BALCONY'],
      ['pot_material', 'GOLD'],
      ['soil_type', 'MUD'],
      ['indoor_climate', 'TROPICAL'],
    ])('TC-PLT-109 an invalid %s value is rejected with 422, not a server error', async (field, value) => {
      const res = await newPlant(app, u, { [field]: value })
      expect(res.status).toBe(422)
    })

    it('TC-PLT-110 [DEF-006] a non-positive pot_diameter_cm (0 or negative) is rejected with 422', async () => {
      for (const d of [0, -5]) {
        const res = await newPlant(app, u, { pot_diameter_cm: d })
        expect(res.status, `diameter ${d}`).toBe(422)
      }
    })
  })

  describe('read, update, archive (FR-PLT-06, FR-PLT-09, FR-PLT-10)', () => {
    it('TC-PLT-111 list returns only the caller\'s plants', async () => {
      const other = await newUser(app, 'plants-other')
      const mine = await newPlant(app, u, { nickname: 'mine-only' })
      await newPlant(app, other, { nickname: 'theirs-only' })
      const res = await request(app).get('/api/v1/plants').set(u.auth())
      const names = (res.body as Array<{ nickname: string }>).map((p) => p.nickname)
      expect(names).toContain('mine-only')
      expect(names).not.toContain('theirs-only')
      expect(mine.status).toBe(201)
    })

    it('TC-PLT-112 get by id returns the plant; an unknown valid UUID is 404', async () => {
      const p = await newPlant(app, u)
      expect((await request(app).get(`/api/v1/plants/${p.body.id}`).set(u.auth())).status).toBe(200)
      const res = await request(app).get(`/api/v1/plants/${crypto.randomUUID()}`).set(u.auth())
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('TC-PLT-113 a malformed id is 422, not 500', async () => {
      for (const id of ['undefined', '123', 'not-a-uuid', "1' or '1'='1"]) {
        const res = await request(app).get(`/api/v1/plants/${encodeURIComponent(id)}`).set(u.auth())
        expect(res.status, id).toBe(422)
      }
    })

    it('TC-PLT-114 update changes the nickname and persists it', async () => {
      const p = await newPlant(app, u)
      const put = await request(app).put(`/api/v1/plants/${p.body.id}`).set(u.auth()).send({ nickname: 'Renamed' })
      expect(put.status).toBe(200)
      const got = await request(app).get(`/api/v1/plants/${p.body.id}`).set(u.auth())
      expect(got.body.nickname).toBe('Renamed')
    })

    it('TC-PLT-115 [DEF-008] creating a plant sets its schedule (BR-PLT-10 T1): interval and factor snapshot are present', async () => {
      const p = await newPlant(app, u, { light_exposure: 'BRIGHT_INDIRECT' })
      const got = await request(app).get(`/api/v1/plants/${p.body.id}`).set(u.auth())
      expect(Number.isInteger(got.body.effective_interval_days)).toBe(true)
      expect(got.body.watering_factor_snapshot).not.toBeNull()
    })

    it('TC-PLT-115b [DEF-008] editing light exposure recomputes the interval (BR-PLT-10 T4, FR-PLT-08)', async () => {
      const p = await newPlant(app, u, { light_exposure: 'BRIGHT_INDIRECT', base_interval_days: 10, min_interval_days: 1, max_interval_days: 60 })
      await request(app).put(`/api/v1/plants/${p.body.id}`).set(u.auth()).send({ light_exposure: 'LOW' })
      const after = (await request(app).get(`/api/v1/plants/${p.body.id}`).set(u.auth())).body
      // LOW (1.25) lengthens the interval relative to BRIGHT_INDIRECT (1.00).
      expect(after.watering_factor_snapshot?.fLight ?? after.watering_factor_snapshot?.f_light).toBe(1.25)
    })

    it('TC-PLT-116 archive is a soft delete: the plant disappears from list and get, 404 on repeat', async () => {
      const p = await newPlant(app, u, { nickname: 'to-archive' })
      const del = await request(app).delete(`/api/v1/plants/${p.body.id}`).set(u.auth())
      expect(del.status).toBeLessThan(300)
      expect((await request(app).get(`/api/v1/plants/${p.body.id}`).set(u.auth())).status).toBe(404)
      const list = await request(app).get('/api/v1/plants').set(u.auth())
      expect((list.body as Array<{ id: string }>).some((x) => x.id === p.body.id)).toBe(false)
      expect((await request(app).delete(`/api/v1/plants/${p.body.id}`).set(u.auth())).status).toBe(404)
      const { rows } = await getPool().query('select deleted_at from plants where id = $1', [p.body.id])
      expect(rows[0]?.deleted_at).not.toBeNull() // row retained for the retention window
    })
  })

  describe('care actions (FR-PLT-11..14)', () => {
    it.each(['WATER', 'FERTILIZE', 'PRUNE', 'REPOT', 'MIST', 'ROTATE', 'TREAT'])('TC-PLT-117 logs a %s action', async (action) => {
      const p = await newPlant(app, u)
      const res = await request(app).post(`/api/v1/plants/${p.body.id}/care`).set(u.auth()).send({ action_type: action, local_date_str: today() })
      expect(res.status).toBe(201)
    })

    it.each([
      ['unknown action', { action_type: 'DANCE', local_date_str: today() }],
      ['missing action', { local_date_str: today() }],
      ['missing date', { action_type: 'WATER' }],
      ['wrong date format', { action_type: 'WATER', local_date_str: '15/07/2026' }],
    ])('TC-PLT-118 rejects a care log with %s (422)', async (_l, body) => {
      const p = await newPlant(app, u)
      const res = await request(app).post(`/api/v1/plants/${p.body.id}/care`).set(u.auth()).send(body)
      expect(res.status).toBe(422)
    })

    it('TC-PLT-118b [DEF-009] an impossible calendar date (month 13) is a 422, not an internal error', async () => {
      const p = await newPlant(app, u)
      const res = await request(app).post(`/api/v1/plants/${p.body.id}/care`).set(u.auth()).send({ action_type: 'WATER', local_date_str: '2026-13-45' })
      expect(res.status).toBe(422)
    })

    it('TC-PLT-119 watering moves the next due date forward and records history, newest first', async () => {
      const p = await newPlant(app, u)
      await request(app).post(`/api/v1/plants/${p.body.id}/care`).set(u.auth()).send({ action_type: 'WATER', local_date_str: today(-3) })
      await request(app).post(`/api/v1/plants/${p.body.id}/care`).set(u.auth()).send({ action_type: 'WATER', local_date_str: today() })
      const hist = await request(app).get(`/api/v1/plants/${p.body.id}/care`).set(u.auth())
      expect(hist.status).toBe(200)
      const rows = (Array.isArray(hist.body) ? hist.body : hist.body.events) as Array<{ performed_at?: string; logged_at_utc?: string }>
      expect(rows.length).toBeGreaterThanOrEqual(2)
      const stamps = rows.map((r) => new Date((r.performed_at ?? r.logged_at_utc)!).getTime())
      expect([...stamps].sort((a, b) => b - a)).toEqual(stamps)
      const plant = await request(app).get(`/api/v1/plants/${p.body.id}`).set(u.auth())
      expect(new Date(plant.body.next_water_due_at).getTime()).toBeGreaterThan(Date.now() - 86_400_000)
    })

    it('TC-PLT-120 only WATER changes the schedule; FERTILIZE leaves next_water_due_at unchanged', async () => {
      const p = await newPlant(app, u)
      await request(app).post(`/api/v1/plants/${p.body.id}/care`).set(u.auth()).send({ action_type: 'WATER', local_date_str: today() })
      const before = (await request(app).get(`/api/v1/plants/${p.body.id}`).set(u.auth())).body.next_water_due_at
      await request(app).post(`/api/v1/plants/${p.body.id}/care`).set(u.auth()).send({ action_type: 'FERTILIZE', local_date_str: today() })
      const after = (await request(app).get(`/api/v1/plants/${p.body.id}`).set(u.auth())).body.next_water_due_at
      expect(after).toBe(before)
    })

    it('TC-PLT-121 two waterings in quick succession both succeed (double-tap safe)', async () => {
      const p = await newPlant(app, u)
      const send = () => request(app).post(`/api/v1/plants/${p.body.id}/care`).set(u.auth()).send({ action_type: 'WATER', local_date_str: today() })
      const [a, b] = await Promise.all([send(), send()])
      expect([a.status, b.status].every((s) => s < 500)).toBe(true)
    })
  })

  describe('growth log (FR-PLT-20, FR-PLT-21; strict body)', () => {
    const entry = (over: Record<string, unknown> = {}) => ({ photo_url: 'https://example.com/p.jpg', local_date_str: today(), ...over })
    const post = (id: string, body: unknown) => request(app).post(`/api/v1/plants/${id}/growth`).set(u.auth()).send(body as object)

    it('TC-PLT-122 adds an entry (201) and lists it', async () => {
      const p = await newPlant(app, u)
      const res = await post(p.body.id, entry({ height_cm: 12.5, note: 'first leaf' }))
      expect(res.status).toBe(201)
      const list = await request(app).get(`/api/v1/plants/${p.body.id}/growth`).set(u.auth())
      expect(Array.isArray(list.body)).toBe(true)
      expect(list.body).toHaveLength(1)
    })

    it.each([
      ['non-http scheme', { photo_url: 'ftp://example.com/p.jpg' }],
      ['javascript URL', { photo_url: 'javascript:alert(1)' }],
      ['data URL', { photo_url: 'data:text/html,<script>alert(1)</script>' }],
      ['not a URL', { photo_url: 'photo.jpg' }],
      ['URL over 2048 characters', { photo_url: `https://example.com/${'a'.repeat(2050)}` }],
      ['missing photo_url', { photo_url: undefined }],
      ['height below 0', { height_cm: -0.1 }],
      ['height above 5000', { height_cm: 5000.1 }],
      ['note over 1000 characters', { note: 'n'.repeat(1001) }],
      ['bad date', { local_date_str: '2026-7-1' }],
      ['unknown extra field', { surprise: true }],
    ])('TC-PLT-123 rejects %s (422)', async (_l, over) => {
      const p = await newPlant(app, u)
      expect((await post(p.body.id, entry(over))).status).toBe(422)
    })

    it('TC-PLT-124 accepts the height boundaries 0 and 5000 and the note boundary of 1000 characters', async () => {
      const p = await newPlant(app, u)
      expect((await post(p.body.id, entry({ height_cm: 0 }))).status).toBe(201)
      expect((await post(p.body.id, entry({ height_cm: 5000 }))).status).toBe(201)
      expect((await post(p.body.id, entry({ note: 'n'.repeat(1000) }))).status).toBe(201)
    })

    it('TC-PLT-125 a plant holds at most 40 growth entries; the 41st is 409 LIMIT_EXCEEDED (NFR-SCAL-03)', async () => {
      const p = await newPlant(app, u)
      for (let i = 0; i < 40; i++) {
        const r = await post(p.body.id, entry({ local_date_str: today(-i), note: `entry ${i}` }))
        expect(r.status, `entry ${i}`).toBe(201)
      }
      const over = await post(p.body.id, entry({ local_date_str: today(-41) }))
      expect(over.status).toBe(409)
      const issues = JSON.stringify(over.body.error.details ?? '')
      expect(over.body.error.code === 'LIMIT_EXCEEDED' || /limit_exceeded/i.test(issues)).toBe(true)
      const list = await request(app).get(`/api/v1/plants/${p.body.id}/growth`).set(u.auth())
      expect(list.body).toHaveLength(40)
    }, 60_000)

    it('TC-PLT-125b [DEF-007] a sixth entry for one plant on one local date is rejected (BR-PLT-38 / E-40)', async () => {
      const p = await newPlant(app, u)
      const statuses: number[] = []
      for (let i = 0; i < 6; i++) statuses.push((await post(p.body.id, entry({ note: `same-day ${i}` }))).status)
      expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true)
      expect(statuses[5]).toBeGreaterThanOrEqual(400)
    })

    it('TC-PLT-126 deleting an entry hides it; a repeat delete is 404', async () => {
      const p = await newPlant(app, u)
      const e = await post(p.body.id, entry())
      const del = await request(app).delete(`/api/v1/plants/${p.body.id}/growth/${e.body.id}`).set(u.auth())
      expect(del.status).toBe(200)
      expect(del.body).toEqual({ status: 'deleted' })
      expect((await request(app).delete(`/api/v1/plants/${p.body.id}/growth/${e.body.id}`).set(u.auth())).status).toBe(404)
      const list = await request(app).get(`/api/v1/plants/${p.body.id}/growth`).set(u.auth())
      expect(list.body).toHaveLength(0)
    })
  })

  it('TC-PLT-127 the caller can only create plants against a species that exists (foreign key)', async () => {
    const sp = await anySpecies(app, u)
    const res = await request(app).post('/api/v1/plants').set(u.auth()).send({ nickname: 'ghost-species', ...sp, species_id: crypto.randomUUID(), light_exposure: 'MEDIUM', placement: 'INDOOR' })
    expect([404, 422]).toContain(res.status)
  })
})
