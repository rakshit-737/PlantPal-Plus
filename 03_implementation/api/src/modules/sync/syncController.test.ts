/**
 * Sync controller tests.
 *
 * No PostgreSQL is available here, so the repository layers are mocked and
 * these tests exercise the drain contract itself: batch validation, per-event
 * isolation, replay short-circuiting, unique-violation reconciliation, and
 * TERMINAL failure classification (FR-SYS-03/05, D-04).
 */

import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/plantpal_test'
process.env['JWT_ACCESS_SECRET'] ??= 'test-secret-that-is-at-least-32-characters-long'

vi.mock('./syncRepo.ts', () => ({
  recordEvent: vi.fn(),
  markProcessed: vi.fn(async () => undefined),
  markFailed: vi.fn(async () => undefined),
  findEntityIdByKey: vi.fn(async () => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
}))

vi.mock('../plants/plantsRepo.ts', () => ({
  logCareEvent: vi.fn(async () => undefined),
}))

vi.mock('../fitness/fitnessRepo.ts', () => ({
  createWorkout: vi.fn(async () => ({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' })),
}))

vi.mock('../nutrition/nutritionRepo.ts', () => ({
  logMeal: vi.fn(async () => ({ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' })),
  logWater: vi.fn(async () => ({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })),
}))

// Engagement decorates the drain but must not reach for the (absent) pool.
vi.mock('../engagement/engagementService.ts', () => ({
  recordDailyLogSafe: vi.fn(async () => undefined),
  evaluateAchievementsSafe: vi.fn(async () => undefined),
}))

// The routes mount the real authenticate middleware; bypass it and stamp a
// fixed subject so the tests exercise the controller, not token verification.
vi.mock('../auth/authController.ts', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    ;(req as unknown as Record<string, unknown>).userId =
      '22222222-2222-4222-8222-222222222222'
    next()
  },
}))

const syncRepo = await import('./syncRepo.ts')
const plantsRepo = await import('../plants/plantsRepo.ts')
const { errorHandler } = await import('../../http/errorHandler.ts')
const { requestId } = await import('../../http/requestId.ts')
const syncRoutes = (await import('./syncRoutes.ts')).default

const app = express()
app.use(requestId)
app.use(express.json())
app.use('/api/v1/sync', syncRoutes)
app.use(errorHandler)

const KEY = '9f8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

function freshRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    client_idempotency_key: KEY,
    entity_type: 'WATER_LOG',
    status: 'PENDING',
    result_entity_id: null,
    error_code: null,
    ...overrides,
  }
}

const WATER_EVENT = {
  client_idempotency_key: KEY,
  entity_type: 'WATER_LOG',
  payload: { amount_ml: 250, local_date_str: '2026-07-25' },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(syncRepo.recordEvent).mockResolvedValue({ row: freshRow() as never, replay: false })
})

describe('POST /api/v1/sync/outbox', () => {
  it('processes a fresh water-log event and reports its entity id', async () => {
    const res = await request(app).post('/api/v1/sync/outbox').send({ events: [WATER_EVENT] })

    expect(res.status).toBe(200)
    expect(res.body.results).toEqual([
      {
        client_idempotency_key: KEY,
        status: 'PROCESSED',
        replay: false,
        entity_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        error_code: null,
      },
    ])
    expect(syncRepo.markProcessed).toHaveBeenCalledOnce()
  })

  it('returns the stored outcome on a replayed key without reprocessing', async () => {
    vi.mocked(syncRepo.recordEvent).mockResolvedValue({
      row: freshRow({ status: 'PROCESSED', result_entity_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) as never,
      replay: true,
    })

    const res = await request(app).post('/api/v1/sync/outbox').send({ events: [WATER_EVENT] })

    expect(res.status).toBe(200)
    expect(res.body.results[0]).toMatchObject({ status: 'PROCESSED', replay: true })
    // The destination write must not run again (FR-SYS-03: never reprocess).
    expect(syncRepo.markProcessed).not.toHaveBeenCalled()
  })

  it('classifies a malformed payload as a TERMINAL per-event failure', async () => {
    const res = await request(app)
      .post('/api/v1/sync/outbox')
      .send({
        events: [
          { ...WATER_EVENT, payload: { amount_ml: 'not-a-number', local_date_str: '2026-07-25' } },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.results[0]).toMatchObject({ status: 'FAILED', error_code: 'VALIDATION_FAILED' })
    expect(syncRepo.markFailed).toHaveBeenCalledOnce()
  })

  it('one failing event does not strand the rest of the batch (FR-SYS-05)', async () => {
    const key2 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
    vi.mocked(syncRepo.recordEvent)
      .mockResolvedValueOnce({ row: freshRow() as never, replay: false })
      .mockResolvedValueOnce({
        row: freshRow({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', client_idempotency_key: key2 }) as never,
        replay: false,
      })

    const res = await request(app)
      .post('/api/v1/sync/outbox')
      .send({
        events: [
          { ...WATER_EVENT, payload: { bad: true } },
          { ...WATER_EVENT, client_idempotency_key: key2 },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(2)
    expect(res.body.results[0].status).toBe('FAILED')
    expect(res.body.results[1].status).toBe('PROCESSED')
  })

  it('reconciles a unique violation as a successful replay of the destination row', async () => {
    const uniqueViolation = Object.assign(new Error('duplicate key'), { code: '23505' })
    const nutrition = await import('../nutrition/nutritionRepo.ts')
    vi.mocked(nutrition.logWater).mockRejectedValueOnce(uniqueViolation)

    const res = await request(app).post('/api/v1/sync/outbox').send({ events: [WATER_EVENT] })

    expect(res.status).toBe(200)
    expect(res.body.results[0]).toMatchObject({
      status: 'PROCESSED',
      replay: true,
      entity_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    })
  })

  it('classifies a missing parent plant as PARENT_NOT_FOUND', async () => {
    vi.mocked(plantsRepo.logCareEvent).mockRejectedValueOnce(
      Object.assign(new Error('Plant not found'), { __notFound: true }),
    )

    const res = await request(app)
      .post('/api/v1/sync/outbox')
      .send({
        events: [
          {
            client_idempotency_key: KEY,
            entity_type: 'PLANT_CARE_EVENT',
            payload: {
              plant_id: '44444444-4444-4444-8444-444444444444',
              action_type: 'WATER',
              local_date_str: '2026-07-25',
            },
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.results[0]).toMatchObject({ status: 'FAILED', error_code: 'PARENT_NOT_FOUND' })
  })

  it('rejects a batch with a malformed idempotency key outright', async () => {
    const res = await request(app)
      .post('/api/v1/sync/outbox')
      .send({ events: [{ ...WATER_EVENT, client_idempotency_key: 'not-a-uuid' }] })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects an empty batch', async () => {
    const res = await request(app).post('/api/v1/sync/outbox').send({ events: [] })
    expect(res.status).toBe(422)
  })
})
