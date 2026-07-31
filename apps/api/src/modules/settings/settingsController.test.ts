/**
 * Settings controller tests. No PostgreSQL here — the repo layer is mocked and
 * these exercise the PUT contract: field allow-listing, enum/boolean/range
 * validation, Invariant 34 (at least one module enabled) and the BR-NOT-08
 * quiet-hours window rule, all evaluated against the merged result rather than
 * the raw patch.
 *
 * The one exception is the time normalisation, which belongs to the repo and is
 * pulled in through `importActual` past the module mock: it is a pure function
 * of a row, so the shape contract is assertable without a database.
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
  quiet_start_time: '22:00',
  quiet_end_time: '07:00',
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
/** The genuine repo module, reached past the mock above, for its pure normaliser. */
const { normaliseSettingsRow } =
  await vi.importActual<typeof import('./settingsRepo.ts')>('./settingsRepo.ts')
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

/**
 * The read shape. PostgreSQL emits a `time` column as 'HH:MM:SS' and
 * node-postgres has no parser for OID 1083, so the raw string reaches us
 * unchanged; the clients are promised 'HH:MM' and nothing else.
 */
describe('quiet-hours read normalisation', () => {
  it("truncates the 'HH:MM:SS' that node-postgres returns for a time column", () => {
    const row = normaliseSettingsRow({
      ...DEFAULTS,
      quiet_start_time: '22:30:00',
      quiet_end_time: '07:05:00',
    })
    expect(row.quiet_start_time).toBe('22:30')
    expect(row.quiet_end_time).toBe('07:05')
  })

  it('truncates a value carrying sub-second precision', () => {
    const row = normaliseSettingsRow({
      ...DEFAULTS,
      quiet_start_time: '22:00:00.5',
      quiet_end_time: '07:00:00.000',
    })
    expect(row.quiet_start_time).toBe('22:00')
    expect(row.quiet_end_time).toBe('07:00')
  })

  it('passes nulls and already-normalised values through untouched', () => {
    const row = normaliseSettingsRow({
      ...DEFAULTS,
      quiet_start_time: null,
      quiet_end_time: '07:00',
    })
    expect(row.quiet_start_time).toBeNull()
    expect(row.quiet_end_time).toBe('07:00')
  })

  it('leaves the rest of the row alone', () => {
    const row = normaliseSettingsRow({ ...DEFAULTS, quiet_start_time: '22:00:00' })
    expect(row.theme).toBe('SYSTEM')
    expect(row.daily_notification_cap).toBe(12)
  })
})

describe('PUT /api/v1/settings quiet hours', () => {
  it('accepts a well-formed window', async () => {
    const res = await request(app)
      .put('/api/v1/settings')
      .send({ quiet_hours_mode: 'WINDOW', quiet_start_time: '23:15', quiet_end_time: '06:45' })
    expect(res.status).toBe(200)
    expect(res.body.quiet_start_time).toBe('23:15')
    expect(repo.updateSettings).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222', {
      quiet_hours_mode: 'WINDOW',
      quiet_start_time: '23:15',
      quiet_end_time: '06:45',
    })
  })

  it('accepts a cross-midnight window, which BR-NOT-08 defines as legal', async () => {
    // s > e is the 22:00→07:00 case; the controller must not "helpfully" reject it.
    const res = await request(app)
      .put('/api/v1/settings')
      .send({ quiet_start_time: '22:00', quiet_end_time: '07:00' })
    expect(res.status).toBe(200)
  })

  it.each(['7:00', '25:00', '22:60', '22:00:00', '', 700])(
    'rejects %p as a boundary time',
    async (value) => {
      const res = await request(app).put('/api/v1/settings').send({ quiet_start_time: value })
      expect(res.status).toBe(422)
      expect(res.body.error.details[0]).toEqual({
        field: 'quiet_start_time',
        issue: 'must_be_hh_mm_24h_or_null',
      })
      expect(repo.updateSettings).not.toHaveBeenCalled()
    },
  )

  it('rejects WINDOW mode with no boundaries at all (BR-NOT-08)', async () => {
    const res = await request(app)
      .put('/api/v1/settings')
      .send({ quiet_hours_mode: 'WINDOW', quiet_start_time: null, quiet_end_time: null })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.details[0].issue).toBe('window_requires_start_and_end')
    expect(repo.updateSettings).not.toHaveBeenCalled()
  })

  it('rejects clearing one boundary while the mode stays WINDOW', async () => {
    // Merged-state check: the mode is untouched here and comes from the stored row.
    const res = await request(app).put('/api/v1/settings').send({ quiet_end_time: null })
    expect(res.status).toBe(422)
    expect(res.body.error.details[0].issue).toBe('window_requires_start_and_end')
    expect(repo.updateSettings).not.toHaveBeenCalled()
  })

  it('rejects a window whose start equals its end', async () => {
    const res = await request(app)
      .put('/api/v1/settings')
      .send({ quiet_start_time: '22:00', quiet_end_time: '22:00' })
    expect(res.status).toBe(422)
    expect(res.body.error.details[0].issue).toBe('window_start_equals_end')
    expect(repo.updateSettings).not.toHaveBeenCalled()
  })

  it('clears both boundaries when quiet hours are switched OFF', async () => {
    const res = await request(app)
      .put('/api/v1/settings')
      .send({ quiet_hours_mode: 'OFF', quiet_start_time: null, quiet_end_time: null })
    expect(res.status).toBe(200)
    expect(res.body.quiet_start_time).toBeNull()
    expect(res.body.quiet_end_time).toBeNull()
    // null must reach the repo — it is the write that clears the column, and is
    // distinct from the `undefined` that means "field absent from the patch".
    expect(repo.updateSettings).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222', {
      quiet_hours_mode: 'OFF',
      quiet_start_time: null,
      quiet_end_time: null,
    })
  })

  it('leaves a stored WINDOW-with-nulls row writable for unrelated fields', async () => {
    // 001-auth-schema.sql defaults the mode to WINDOW but gives the two time
    // columns no default, so this state is the norm for a user who has never
    // opened the notifications section. A theme change must not fail on it.
    vi.mocked(repo.getSettings).mockResolvedValueOnce({
      ...DEFAULTS,
      quiet_start_time: null,
      quiet_end_time: null,
    })
    const res = await request(app).put('/api/v1/settings').send({ theme: 'DARK' })
    expect(res.status).toBe(200)
    expect(repo.updateSettings).toHaveBeenCalledWith(expect.any(String), { theme: 'DARK' })
  })

  it('still enforces Invariant 34 when the same patch changes quiet hours', async () => {
    const res = await request(app).put('/api/v1/settings').send({
      quiet_hours_mode: 'OFF',
      quiet_start_time: null,
      quiet_end_time: null,
      plant_care_enabled: false,
      fitness_enabled: false,
      nutrition_enabled: false,
    })
    expect(res.status).toBe(422)
    expect(res.body.error.details[0].issue).toBe('at_least_one_module_required')
    expect(repo.updateSettings).not.toHaveBeenCalled()
  })
})
