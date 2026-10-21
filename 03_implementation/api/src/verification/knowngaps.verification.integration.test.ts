import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type express from 'express'

import { cleanup, getPool, newPlant, newUser, PASSWORD, request, startApp, TEST_DB, today, type TestUser } from './harness.ts'

let app: express.Express
let u: TestUser

describe.skipIf(!TEST_DB)('Known gaps and unmapped FRs', () => {
  beforeAll(async () => {
    app = await startApp()
    u = await newUser(app, 'gap')
  }, 120_000)
  afterAll(cleanup)

  describe('FR-SYS-11 signed upload gap', () => {
    it('TC-SYS-601 [DEF-018] POST /api/v1/media/uploads exists and is authenticated', async () => {
      const anon = await request(app).post('/api/v1/media/uploads').send({})
      expect(anon.status).toBe(401)
    })
    it('TC-SYS-602 [DEF-018] an authenticated issue request is not 404', async () => {
      const res = await request(app)
        .post('/api/v1/media/uploads')
        .set(u.auth())
        .send({ content_type: 'image/jpeg', byte_size: 1024 })
      expect(res.status).not.toBe(404)
    })
    it('TC-SYS-603 [DEF-018] finalize endpoint exists', async () => {
      const res = await request(app)
        .post(`/api/v1/media/${crypto.randomUUID()}/finalize`)
        .set(u.auth())
        .send({})
      expect(res.status).not.toBe(404)
    })
    it('TC-SYS-604 growth photo today is only an http(s) link: data: and javascript: are rejected', async () => {
      const p = await newPlant(app, u)
      for (const photo_url of ['javascript:alert(1)', 'data:image/png;base64,AAAA']) {
        const res = await request(app)
          .post(`/api/v1/plants/${p.body.id}/growth`)
          .set(u.auth())
          .send({ local_date_str: today(), photo_url })
        expect(res.status).toBe(422)
      }
    })
  })

  describe('FR-ACC-22 erased account gap', () => {
    async function erasedUser() {
      const e = await newUser(app, 'erased')
      const del = await request(app).post('/api/v1/account/deletion').set(e.auth()).send({ password: PASSWORD })
      expect(del.status).toBeLessThan(300)
      await getPool().query(`update users set purge_after = now() - interval '1 minute' where id = $1`, [e.id])
      const { runPurgePass } = await import('../modules/account/purgeService.ts')
      const result = await runPurgePass()
      expect(result.erased).toBeGreaterThanOrEqual(1)
      return e
    }
    const water = () => ({
      events: [
        {
          client_idempotency_key: crypto.randomUUID(),
          entity_type: 'WATER_LOG',
          payload: { amount_ml: 250, local_date_str: today() },
        },
      ],
    })

    it('TC-ACC-401 [DEF-020] erased account with a still-valid token gets 401 or 410, not a 422 foreign-key leak', async () => {
      const e = await erasedUser()
      const res = await request(app).post('/api/v1/sync/outbox').set(e.auth()).send(water())
      expect([401, 410]).toContain(res.status)
    })
    it('TC-ACC-402 [DEF-020] queued write for an erased account returns 410', async () => {
      const e = await erasedUser()
      const res = await request(app).post('/api/v1/sync/outbox').set(e.auth()).send(water())
      expect(res.status).toBe(410)
    })
    it('TC-ACC-403 [DEF-020] the 410 body carries ACC_ACCOUNT_DELETED', async () => {
      const e = await erasedUser()
      const res = await request(app).post('/api/v1/sync/outbox').set(e.auth()).send(water())
      expect(JSON.stringify(res.body)).toContain('ACC_ACCOUNT_DELETED')
    })
    it('TC-ACC-404 login after erasure does not succeed', async () => {
      const e = await erasedUser()
      const res = await request(app).post('/api/auth/login').send({ email: e.email, password: PASSWORD })
      expect(res.status).not.toBe(200)
    })
  })

  describe('FR-NOT-11 health endpoints and FR-DSH-04 dashboard', () => {
    it('TC-NOT-301 /healthz is 200 without authentication', async () => {
      expect((await request(app).get('/healthz')).status).toBe(200)
    })
    it('TC-NOT-302 /readyz is 200 with a live database', async () => {
      expect((await request(app).get('/readyz')).status).toBe(200)
    })
    it('TC-DSH-301 dashboard requires authentication', async () => {
      expect((await request(app).get('/api/v1/dashboard')).status).toBe(401)
    })
    it('TC-DSH-302 dashboard returns a JSON object for a new user', async () => {
      const res = await request(app).get('/api/v1/dashboard').set(u.auth())
      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).not.toBeNull()
    })
    it('TC-DSH-303 dashboard for an impossible date is not a 500', async () => {
      const res = await request(app).get('/api/v1/dashboard?date=2026-13-45').set(u.auth())
      expect(res.status).toBeLessThan(500)
    })
  })
})
