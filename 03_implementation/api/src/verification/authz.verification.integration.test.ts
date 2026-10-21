/**
 * Authorisation (NFR-SEC, OWASP ASVS V4): every protected route refuses an
 * anonymous caller, and no resource can be read or changed by another user (IDOR).
 * Test IDs: TC-SEC-001 ..
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type express from 'express'

import { cleanup, newPlant, newUser, request, startApp, TEST_DB, today, type TestUser } from './harness.ts'

let app: express.Express
let alice: TestUser
let bob: TestUser

const ROUTES: Array<[string, string]> = [
  ['GET', '/api/auth/me'],
  ['GET', '/api/v1/plants'], ['POST', '/api/v1/plants'], ['GET', '/api/v1/plants/species'],
  ['GET', '/api/v1/plants/00000000-0000-4000-8000-000000000000'],
  ['PUT', '/api/v1/plants/00000000-0000-4000-8000-000000000000'],
  ['DELETE', '/api/v1/plants/00000000-0000-4000-8000-000000000000'],
  ['POST', '/api/v1/plants/00000000-0000-4000-8000-000000000000/care'],
  ['GET', '/api/v1/plants/00000000-0000-4000-8000-000000000000/care'],
  ['POST', '/api/v1/plants/00000000-0000-4000-8000-000000000000/growth'],
  ['GET', '/api/v1/plants/00000000-0000-4000-8000-000000000000/growth'],
  ['GET', '/api/v1/fitness'], ['POST', '/api/v1/fitness'], ['GET', '/api/v1/fitness/exercises'],
  ['GET', '/api/v1/fitness/personal-records'], ['GET', '/api/v1/fitness/summary'],
  ['GET', '/api/v1/fitness/00000000-0000-4000-8000-000000000000'],
  ['GET', '/api/v1/nutrition/foods/search'], ['POST', '/api/v1/nutrition/foods'],
  ['DELETE', '/api/v1/nutrition/foods/00000000-0000-4000-8000-000000000000'],
  ['GET', '/api/v1/nutrition/summary'], ['POST', '/api/v1/nutrition/meals'], ['POST', '/api/v1/nutrition/water'],
  ['GET', '/api/v1/dashboard'],
  ['GET', '/api/v1/achievements'], ['GET', '/api/v1/achievements/streaks'], ['POST', '/api/v1/achievements/seen'],
  ['GET', '/api/v1/reminders'], ['POST', '/api/v1/reminders/00000000-0000-4000-8000-000000000000/dismiss'],
  ['POST', '/api/v1/devices'], ['POST', '/api/v1/sync/outbox'],
  ['GET', '/api/v1/settings'], ['PUT', '/api/v1/settings'],
  ['GET', '/api/v1/account'], ['POST', '/api/v1/account/deletion'], ['DELETE', '/api/v1/account/deletion'],
]

describe.skipIf(!TEST_DB)('Authorisation', () => {
  beforeAll(async () => {
    app = await startApp()
    alice = await newUser(app, 'alice')
    bob = await newUser(app, 'bob')
  }, 120_000)
  afterAll(cleanup)

  it.each(ROUTES)('TC-SEC-001 %s %s without a token -> 401 and the standard error envelope', async (method, path) => {
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method.toLowerCase()]!(path).send({})
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED')
  })

  it('TC-SEC-002 the public endpoints stay public: /healthz, /readyz, /api/v1', async () => {
    expect((await request(app).get('/healthz')).status).toBe(200)
    expect((await request(app).get('/readyz')).status).toBe(200)
    expect((await request(app).get('/api/v1')).status).toBe(200)
  })

  describe('a second user cannot reach the first user\'s plant (IDOR)', () => {
    let plantId: string
    beforeAll(async () => {
      plantId = (await newPlant(app, alice, { nickname: 'alice-private' })).body.id
    })

    it('TC-SEC-003 GET -> 404 (not 403, so existence is not revealed)', async () => {
      const res = await request(app).get(`/api/v1/plants/${plantId}`).set(bob.auth())
      expect(res.status).toBe(404)
    })

    it('TC-SEC-004 PUT -> 404 and the data is unchanged', async () => {
      expect((await request(app).put(`/api/v1/plants/${plantId}`).set(bob.auth()).send({ nickname: 'hacked' })).status).toBe(404)
      const mine = await request(app).get(`/api/v1/plants/${plantId}`).set(alice.auth())
      expect(mine.body.nickname).toBe('alice-private')
    })

    it('TC-SEC-005 DELETE -> 404 and the plant survives', async () => {
      expect((await request(app).delete(`/api/v1/plants/${plantId}`).set(bob.auth())).status).toBe(404)
      expect((await request(app).get(`/api/v1/plants/${plantId}`).set(alice.auth())).status).toBe(200)
    })

    it('TC-SEC-006 care logging against it -> 404 and no event is recorded', async () => {
      const res = await request(app).post(`/api/v1/plants/${plantId}/care`).set(bob.auth()).send({ action_type: 'WATER', local_date_str: today() })
      expect(res.status).toBe(404)
      const hist = await request(app).get(`/api/v1/plants/${plantId}/care`).set(alice.auth())
      expect(JSON.stringify(hist.body)).not.toMatch(/WATER/)
    })

    it('TC-SEC-007 reading or writing its growth log -> 404', async () => {
      const w = await request(app).post(`/api/v1/plants/${plantId}/growth`).set(bob.auth()).send({ photo_url: 'https://example.com/x.jpg', local_date_str: today() })
      expect(w.status).toBe(404)
      expect((await request(app).get(`/api/v1/plants/${plantId}/growth`).set(bob.auth())).status).toBe(404)
    })

    it('TC-SEC-008 care history of it reveals nothing to another user (no events returned)', async () => {
      const res = await request(app).get(`/api/v1/plants/${plantId}/care`).set(bob.auth())
      expect([200, 404]).toContain(res.status)
      const events = Array.isArray(res.body) ? res.body : (res.body.events ?? [])
      expect(events).toEqual([])
    })

    it('TC-SEC-008b [DEF-017] care history of another user\'s or a missing plant is 404, consistent with the growth endpoints', async () => {
      expect((await request(app).get(`/api/v1/plants/${plantId}/care`).set(bob.auth())).status).toBe(404)
      expect((await request(app).get(`/api/v1/plants/${crypto.randomUUID()}/care`).set(bob.auth())).status).toBe(404)
    })

    it('TC-SEC-009 the plant list never includes it', async () => {
      const list = await request(app).get('/api/v1/plants').set(bob.auth())
      expect((list.body as Array<{ id: string }>).some((p) => p.id === plantId)).toBe(false)
    })
  })

  it('TC-SEC-010 a user ID or role smuggled into a request body is ignored: the plant belongs to the caller', async () => {
    const res = await newPlant(app, bob, { user_id: alice.id, owner_id: alice.id, role: 'admin' })
    if (res.status === 201) {
      const mine = await request(app).get(`/api/v1/plants/${res.body.id}`).set(bob.auth())
      expect(mine.status).toBe(200)
      const theirs = await request(app).get(`/api/v1/plants/${res.body.id}`).set(alice.auth())
      expect(theirs.status).toBe(404)
    } else {
      expect(res.status).toBe(422) // a strict rejection is equally acceptable
    }
  })

  it('TC-SEC-011 settings and account state are per user', async () => {
    await request(app).put('/api/v1/settings').set(alice.auth()).send({ theme: 'DARK' })
    const bobs = await request(app).get('/api/v1/settings').set(bob.auth())
    expect(bobs.body.theme).not.toBe('DARK')
  })
})
