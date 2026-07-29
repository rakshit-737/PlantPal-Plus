/**
 * Settings controller tests. No PostgreSQL here — the repo layer is mocked and
 * these exercise the PUT contract: field allow-listing, enum/boolean/range
 * validation, and Invariant 34 (at least one module enabled) evaluated against
 * the merged result rather than the raw patch.
 */

import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/plantpal_test'
process.env['JWT_ACCESS_SECRET'] ??= 'test-secret-that-is-at-least-32-characters-long'

const DEFAULTS = {
  timezone: 'UTC',
  hemisphere: 'NORTHERN',
  locale: 'en-US',
  unit_system: 'METRIC',
  theme: 'SYSTEM',
  week_start_day: 'MONDAY',
  plant_care_enabled: true,
  fitness_enabled: true,
  nutrition_enabled: true,
  quiet_hours_mode: 'WINDOW',
  daily_notification_cap: 12,
  reduce_motion: false,
  larger_text: false,
  high_contrast: false,
  analytics_opt_in: false,
}

vi.mock('./settingsRepo.ts', () => ({
  getSettings: vi.fn(async () => ({ ...DEFAULTS })),
  updateSettings: vi.fn(async (_userId: string, patch: Record<string, unknown>) => ({
    ...DEFAULTS,
    ...patch,
  })),
}))

vi.mock('../auth/authController.ts', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    ;(req as unknown as Record<string, unknown>).userId =
      '22222222-2222-4222-8222-222222222222'
    next()
  },
}))

const repo = await import('./settingsRepo.ts')
const { errorHandler } = await import('../../http/errorHandler.ts')
const { requestId } = await import('../../http/requestId.ts')
const settingsRoutes = (await import('./settingsRoutes.ts')).default

const app = express()
app.use(requestId)
app.use(express.json())
app.use('/api/v1/settings', settingsRoutes)
app.use(errorHandler)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/v1/settings', () => {
  it('returns the settings row', async () => {
    const res = await request(app).get('/api/v1/settings')
    expect(res.status).toBe(200)
    expect(res.body.theme).toBe('SYSTEM')
    expect(res.body.plant_care_enabled).toBe(true)
  })
})

describe('PUT /api/v1/settings', () => {
  it('applies a valid patch of enums and booleans', async () => {
    const res = await request(app)
      .put('/api/v1/settings')
      .send({ theme: 'DARK', fitness_enabled: false, daily_notification_cap: 5 })
    expect(res.status).toBe(200)
    expect(res.body.theme).toBe('DARK')
    expect(res.body.fitness_enabled).toBe(false)
    expect(repo.updateSettings).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      expect.objectContaining({ theme: 'DARK', fitness_enabled: false, daily_notification_cap: 5 }),
    )
  })

  it('rejects an out-of-enum value with 422', async () => {
    const res = await request(app).put('/api/v1/settings').send({ theme: 'NEON' })
    expect(res.status).toBe(422)
    expect(res.body.error.details[0].field).toBe('theme')
    expect(repo.updateSettings).not.toHaveBeenCalled()
  })

  it('rejects a non-boolean module toggle with 422', async () => {
    const res = await request(app)
      .put('/api/v1/settings')
      .send({ nutrition_enabled: 'yes' })
    expect(res.status).toBe(422)
    expect(repo.updateSettings).not.toHaveBeenCalled()
  })

  it('rejects an out-of-range notification cap', async () => {
    const res = await request(app)
      .put('/api/v1/settings')
      .send({ daily_notification_cap: 40 })
    expect(res.status).toBe(422)
  })

  it('refuses to disable the last enabled module (Invariant 34)', async () => {
    const res = await request(app)
      .put('/api/v1/settings')
      .send({ plant_care_enabled: false, fitness_enabled: false, nutrition_enabled: false })
    expect(res.status).toBe(422)
    expect(res.body.error.details[0].issue).toBe('at_least_one_module_required')
    expect(repo.updateSettings).not.toHaveBeenCalled()
  })

  it('ignores unknown fields rather than writing them', async () => {
    const res = await request(app)
      .put('/api/v1/settings')
      .send({ is_admin: true, theme: 'LIGHT' })
    expect(res.status).toBe(200)
    expect(repo.updateSettings).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({ is_admin: true }),
    )
  })
})
