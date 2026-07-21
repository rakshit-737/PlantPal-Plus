import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { createApp } from '../app.js'
import { errorHandler } from './errorHandler.js'
import { AppError } from './errors.js'
import { requestId, REQUEST_ID_HEADER } from './requestId.js'

const app = createApp({ corsOrigins: ['http://localhost:5173'] })

describe('error envelope — FR-SYS-19', () => {
  it('returns the documented envelope shape for an unmatched route', async () => {
    const res = await request(app).get('/api/v1/nope')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: expect.any(String),
        message_key: 'errors.not_found',
        request_id: expect.any(String),
        timestamp: expect.any(String),
      },
    })
    expect(new Date(res.body.error.timestamp).toISOString()).toBe(res.body.error.timestamp)
  })

  it('maps malformed JSON to MALFORMED_REQUEST rather than a 500', async () => {
    const res = await request(app)
      .post('/api/v1/anything')
      .set('Content-Type', 'application/json')
      .send('{ this is not json')

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('MALFORMED_REQUEST')
  })

  it('echoes the request id in both the header and the envelope', async () => {
    const res = await request(app).get('/api/v1/nope')
    expect(res.headers[REQUEST_ID_HEADER]).toBe(res.body.error.request_id)
  })

  it('honours a well-formed inbound request id so a retry can be correlated', async () => {
    const res = await request(app).get('/api/v1/nope').set(REQUEST_ID_HEADER, 'client-retry-42')
    expect(res.body.error.request_id).toBe('client-retry-42')
  })

  it('ignores an over-long inbound request id, which would otherwise be a log-injection vector', async () => {
    const res = await request(app).get('/api/v1/nope').set(REQUEST_ID_HEADER, 'x'.repeat(500))
    expect(res.body.error.request_id).not.toBe('x'.repeat(500))
    expect(res.body.error.request_id.length).toBeLessThanOrEqual(64)
  })

  it('ignores an inbound request id containing control or delimiter characters', async () => {
    const res = await request(app).get('/api/v1/nope').set(REQUEST_ID_HEADER, 'abc def"ghi')
    expect(res.body.error.request_id).not.toContain(' ')
  })
})

describe('error envelope — leakage', () => {
  /** A throwing route, mounted on a private app so the public one keeps no test surface. */
  const leaky = express()
  leaky.use(requestId)
  leaky.get('/boom', () => {
    throw new Error('SELECT secret_column FROM users WHERE password_hash = $1')
  })
  leaky.get('/known', () => {
    throw new AppError('CONFLICT', 'That email address is already registered.')
  })
  leaky.use(errorHandler)

  it('never leaks the message of an unexpected throw', async () => {
    const res = await request(leaky).get('/boom')

    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('INTERNAL_ERROR')
    expect(JSON.stringify(res.body)).not.toContain('SELECT')
    expect(JSON.stringify(res.body)).not.toContain('password_hash')
    expect(res.body.error).not.toHaveProperty('stack')
  })

  it('does surface the message of a deliberate AppError', async () => {
    const res = await request(leaky).get('/known')
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
    expect(res.body.error.message).toContain('already registered')
  })
})

describe('health endpoint — FR-SYS-25', () => {
  it('responds without touching any dependency, so keep-alive pings stay cheap', async () => {
    const res = await request(app).get('/healthz')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(typeof res.body.uptime_s).toBe('number')
  })
})
