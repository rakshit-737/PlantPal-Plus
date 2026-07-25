/**
 * Notifications tests: the device-registration contract (FR-NOT-14) and the
 * pure Expo push batching. The repository is mocked — registration rules that
 * need real SQL (LRU eviction, reassignment) are exercised at the repo layer
 * once a database is available in CI.
 */

import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/plantpal_test'
process.env['JWT_ACCESS_SECRET'] ??= 'test-secret-that-is-at-least-32-characters-long'

vi.mock('./devicesRepo.js', () => ({
  registerToken: vi.fn(async () => ({
    id: '55555555-5555-4555-8555-555555555555',
    devices: [],
  })),
}))

vi.mock('../auth/authController.js', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    ;(req as unknown as Record<string, unknown>).userId =
      '22222222-2222-4222-8222-222222222222'
    next()
  },
}))

const repo = await import('./devicesRepo.js')
const { errorHandler } = await import('../../http/errorHandler.js')
const { requestId } = await import('../../http/requestId.js')
const devicesRoutes = (await import('./devicesRoutes.js')).default
const { chunkMessages, EXPO_PUSH_BATCH_LIMIT } = await import('./expoPush.js')

const app = express()
app.use(requestId)
app.use(express.json())
app.use('/api/v1/devices', devicesRoutes)
app.use(errorHandler)

const VALID_BODY = {
  expo_push_token: 'ExponentPushToken[abcdefghijklmnopqrstuv]',
  platform: 'ANDROID',
  client_installation_id: '44444444-4444-4444-8444-444444444444',
  permission_status: 'GRANTED',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/v1/devices', () => {
  it('registers a valid token', async () => {
    const res = await request(app).post('/api/v1/devices').send(VALID_BODY)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe('55555555-5555-4555-8555-555555555555')
    expect(repo.registerToken).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      expect.objectContaining({ expo_push_token: VALID_BODY.expo_push_token }),
    )
  })

  it('accepts the ExpoPushToken[...] variant too', async () => {
    const res = await request(app)
      .post('/api/v1/devices')
      .send({ ...VALID_BODY, expo_push_token: 'ExpoPushToken[abcdefghijklmnopqrstuv]' })
    expect(res.status).toBe(200)
  })

  it('rejects a token that is not an Expo push token', async () => {
    const res = await request(app)
      .post('/api/v1/devices')
      .send({ ...VALID_BODY, expo_push_token: 'fcm:not-an-expo-token-aaaaaaaaaaaa' })
    expect(res.status).toBe(422)
    expect(repo.registerToken).not.toHaveBeenCalled()
  })

  it('rejects WEB platform — deferred to v1.1 under D-10', async () => {
    const res = await request(app)
      .post('/api/v1/devices')
      .send({ ...VALID_BODY, platform: 'WEB' })
    expect(res.status).toBe(422)
  })

  it('requires a client_installation_id UUID', async () => {
    const res = await request(app)
      .post('/api/v1/devices')
      .send({ ...VALID_BODY, client_installation_id: 'install-1' })
    expect(res.status).toBe(422)
  })
})

describe('chunkMessages', () => {
  it('splits at the Expo batch limit', () => {
    const messages = Array.from({ length: 250 }, (_, i) => ({ to: `t${i}` }))
    const chunks = chunkMessages(messages)
    expect(chunks.map((c) => c.length)).toEqual([
      EXPO_PUSH_BATCH_LIMIT,
      EXPO_PUSH_BATCH_LIMIT,
      50,
    ])
    expect(chunks.flat()).toEqual(messages)
  })

  it('returns no chunks for no messages', () => {
    expect(chunkMessages([])).toEqual([])
  })
})
