/**
 * /readyz — the database-touching probe the keep-alive calls.
 *
 * A paused Supabase project once took the whole live deployment down while
 * /healthz kept answering "ok". These tests pin the two properties that make
 * /readyz the right keep-alive target: it reports the database's state rather
 * than the process's, and a burst of calls costs one query, not one per call.
 */

import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/plantpal_test'
process.env['JWT_ACCESS_SECRET'] ??= 'test-secret-that-is-at-least-32-characters-long'

const query = vi.fn()

vi.mock('./db/pool.ts', () => ({
  getPool: () => ({ query }),
  transaction: vi.fn(),
  initPool: vi.fn(),
}))

const { createApp } = await import('./app.ts')

beforeEach(() => {
  query.mockReset()
})

describe('GET /readyz', () => {
  it('reports ready when the database answers', async () => {
    query.mockResolvedValue({ rows: [{ '?column?': 1 }] })
    const res = await request(createApp({ corsOrigins: [] })).get('/readyz')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ready', database: 'up' })
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('reports 503 when the database does not', async () => {
    query.mockRejectedValue(new Error('tenant/user not found'))
    const res = await request(createApp({ corsOrigins: [] })).get('/readyz')

    expect(res.status).toBe(503)
    expect(res.body).toEqual({ status: 'unavailable', database: 'down' })
  })

  it('probes the database at most once per window, however often it is called', async () => {
    query.mockResolvedValue({ rows: [] })
    const app = createApp({ corsOrigins: [] })

    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/readyz')
      expect(res.status).toBe(200)
    }
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('leaves /healthz free of any database dependency', async () => {
    const res = await request(createApp({ corsOrigins: [] })).get('/healthz')

    expect(res.status).toBe(200)
    expect(query).not.toHaveBeenCalled()
  })
})
