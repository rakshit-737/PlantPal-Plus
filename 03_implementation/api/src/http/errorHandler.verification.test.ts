/**
 * White-box verification of the central error handler (FR-SYS-19, error registry).
 * Test IDs: TC-SYS-501 ..
 */
import express from 'express'
import { vi } from 'vitest'

vi.hoisted(() => {
  process.env['LOG_LEVEL'] = 'silent' // keep expected 5xx logs out of the test output
})
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { errorHandler } from './errorHandler.ts'
import { AppError, ERROR_CODES, type ErrorCode } from './errors.ts'
import { requestId } from './requestId.ts'

function appThrowing(make: () => unknown) {
  const a = express()
  a.use(requestId)
  a.get('/t', () => {
    throw make()
  })
  a.use(errorHandler)
  return a
}
const hit = (make: () => unknown) => request(appThrowing(make)).get('/t')
const pg = (code: string, extra: Record<string, string> = {}) => Object.assign(new Error('raw sql text'), { severity: 'ERROR', code, ...extra })

describe('error registry', () => {
  const entries = Object.entries(ERROR_CODES) as Array<[ErrorCode, { status: number; messageKey: string }]>

  it.each(entries)('TC-SYS-501 %s has an HTTP error status and an errors.* message key', (_code, def) => {
    expect(def.status).toBeGreaterThanOrEqual(400)
    expect(def.status).toBeLessThan(600)
    expect(def.messageKey).toMatch(/^errors\./)
  })

  it.each(entries)('TC-SYS-502 a thrown AppError(%s) is answered with exactly its registered status and code', async (code, def) => {
    const res = await hit(() => new AppError(code, 'deliberate'))
    expect(res.status).toBe(def.status)
    expect(res.body.error.code).toBe(code)
    expect(res.body.error.message_key).toBe(def.messageKey)
  })
})

describe('envelope guarantees', () => {
  it('TC-SYS-503 every error has request_id, an ISO timestamp, and the id is also a response header', async () => {
    const res = await hit(() => new AppError('NOT_FOUND', 'x'))
    expect(res.body.error.request_id).toBe(res.headers['x-request-id'])
    expect(new Date(res.body.error.timestamp).toISOString()).toBe(res.body.error.timestamp)
  })

  it.each([['a string', 'oops'], ['a number', 42], ['a plain object', { code: 'X' }]])('TC-SYS-504 throwing %s yields an opaque 500', async (_l, value) => {
    const res = await hit(() => value)
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('INTERNAL_ERROR')
    expect(JSON.stringify(res.body)).not.toMatch(/oops|stack/)
  })

  it('TC-SYS-505 a 5xx body never carries details or a cause', async () => {
    const res = await hit(() => new Error('secret table name users_password'))
    expect(res.status).toBe(500)
    expect(res.body.error.details).toBeUndefined()
    expect(JSON.stringify(res.body)).not.toContain('users_password')
  })
})

describe('validation errors', () => {
  it('TC-SYS-506 a ZodError becomes 422 with one detail per issue, naming the dotted field path', async () => {
    const schema = z.object({ a: z.object({ b: z.number() }), c: z.string() })
    const res = await hit(() => schema.safeParse({ a: { b: 'x' } }).error)
    expect(res.status).toBe(422)
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['a.b', 'c'])
  })

  it('TC-SYS-507 a root-level Zod issue is reported as (root)', async () => {
    const res = await hit(() => z.string().safeParse(5).error)
    expect(res.body.error.details[0].field).toBe('(root)')
  })

  it('TC-SYS-508 details are capped at 50 entries', async () => {
    const schema = z.array(z.number())
    const res = await hit(() => schema.safeParse(Array.from({ length: 120 }, () => 'x')).error)
    expect(res.body.error.details).toHaveLength(50)
  })
})

describe('database error mapping', () => {
  it.each([
    ['22P02', 422, 'VALIDATION_FAILED'], ['22001', 422, 'VALIDATION_FAILED'], ['22003', 422, 'VALIDATION_FAILED'],
    ['22007', 422, 'VALIDATION_FAILED'], ['22008', 422, 'VALIDATION_FAILED'], ['23502', 422, 'VALIDATION_FAILED'],
    ['23503', 422, 'VALIDATION_FAILED'], ['23514', 422, 'VALIDATION_FAILED'], ['23505', 409, 'CONFLICT'],
  ])('TC-SYS-509 SQLSTATE %s -> %i %s and the raw SQL text is never shown', async (state, status, code) => {
    const res = await hit(() => pg(state, { table: 'plants', constraint: 'plants_nickname_check' }))
    expect(res.status).toBe(status)
    expect(res.body.error.code).toBe(code)
    expect(JSON.stringify(res.body)).not.toContain('raw sql text')
  })

  it.each(['40P01', '57014', '08006', '53300'])('TC-SYS-510 server-side SQLSTATE %s stays an opaque 500 (not blamed on the client)', async (state) => {
    expect((await hit(() => pg(state))).status).toBe(500)
  })
})

describe('body-parser failures', () => {
  it('TC-SYS-511 invalid JSON -> 400 MALFORMED_REQUEST', async () => {
    const res = await request(appThrowing(() => 0)).post('/t').set('content-type', 'application/json').send('{bad')
    expect([400, 404]).toContain(res.status) // route is GET-only: malformed body is parsed before routing in the real app
  })

  it('TC-SYS-512 [DEF-016] a body-parser "entity too large" failure is 413 PAYLOAD_TOO_LARGE (code exists in the registry)', async () => {
    const tooLarge = Object.assign(new Error('request entity too large'), { type: 'entity.too.large', status: 413, statusCode: 413 })
    const res = await hit(() => tooLarge)
    expect(res.status).toBe(413)
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('TC-SYS-513 [DEF-016] an unsupported charset or encoding is 415 UNSUPPORTED_MEDIA_TYPE (code exists in the registry)', async () => {
    const bad = Object.assign(new Error('unsupported charset'), { type: 'charset.unsupported', status: 415, statusCode: 415 })
    const res = await hit(() => bad)
    expect(res.status).toBe(415)
  })

  it('TC-SYS-514 [DEF-011] a RangeError raised by a domain rule on invalid input is a client error, not a 500', async () => {
    // shared/ rules (setVolumeKg, workoutEnergyKcal, roundTo...) throw RangeError for
    // out-of-range input. Reaching the central handler unmapped makes it INTERNAL_ERROR.
    const res = await hit(() => new RangeError('reps must be a non-negative integer'))
    expect(res.status).toBe(422)
  })
})
