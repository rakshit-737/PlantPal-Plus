/**
 * Growth photo timeline tests — FR-PLT-20/21, BR-PLT-24 cl.5, BR-PLT-36,
 * NFR-SCAL-03.
 *
 * No PostgreSQL here, so the repository is replaced by a tiny in-memory stand-in
 * that keeps the three behaviours the endpoints depend on: ownership is decided
 * inside the repo call, the per-plant ceiling is decided in that same call, and
 * a soft-deleted row stops being listed and stops counting. That is enough to
 * exercise the contract these tests care about — validation, the 404-not-403
 * ownership answer, ordering, the soft delete and the capacity refusal.
 */

import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/plantpal_test'
process.env['JWT_ACCESS_SECRET'] ??= 'test-secret-that-is-at-least-32-characters-long'

/**
 * The store and the fixed ids live in vi.hoisted: vi.mock factories are hoisted
 * above ordinary declarations, so anything they close over has to be hoisted
 * too or it is still in the temporal dead zone when the factory runs.
 */
const fake = vi.hoisted(() => {
  interface Stored {
    row: Record<string, unknown>
    deleted: boolean
  }
  const entries: Stored[] = []
  let seq = 0
  return {
    OWNER: '22222222-2222-4222-8222-222222222222',
    PLANT: '33333333-3333-4333-8333-333333333333',
    /** Exists, but belongs to somebody else — the repo answers as if it were absent. */
    OTHER_PLANT: '44444444-4444-4444-8444-444444444444',
    MISSING_ENTRY: '55555555-5555-4555-8555-555555555555',
    /** NFR-SCAL-03: growth entries per plant. Pinned against the real repo below. */
    CEILING: 40,
    entries,
    reset() {
      entries.length = 0
      seq = 0
    },
    nextId() {
      seq += 1
      return { id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(seq).padStart(12, '0')}`, seq }
    },
  }
})

const { OWNER, PLANT, OTHER_PLANT, MISSING_ENTRY } = fake

vi.mock('./plantsRepo.ts', () => ({
  // Unused by these tests but imported by the controller module.
  listPlants: vi.fn(async () => []),
  createPlant: vi.fn(async () => ({})),
  updatePlant: vi.fn(async () => null),
  softDeletePlant: vi.fn(async () => false),
  logCareEvent: vi.fn(async () => undefined),
  listCareEvents: vi.fn(async () => []),
  listSpecies: vi.fn(async () => []),

  getPlant: vi.fn(async (id: string, userId: string) =>
    id === fake.PLANT && userId === fake.OWNER ? { id, nickname: 'Fiddle Fig' } : null,
  ),

  createGrowthEntry: vi.fn(
    async (userId: string, plantId: string, data: Record<string, unknown>) => {
      // Mirrors the ownership predicate the real INSERT ... SELECT carries.
      if (plantId !== fake.PLANT || userId !== fake.OWNER) return { status: 'NOT_FOUND' }
      // ...and the count guard folded into that same predicate. Live rows only,
      // exactly like the real subquery and like listGrowthEntries.
      const current = fake.entries.filter(
        (e) => !e.deleted && e.row['plant_id'] === plantId,
      ).length
      if (current >= fake.CEILING) {
        return { status: 'LIMIT_EXCEEDED', current, ceiling: fake.CEILING }
      }
      const { id, seq } = fake.nextId()
      const row = {
        id,
        plant_id: plantId,
        user_id: userId,
        photo_url: data['photo_url'],
        photo_storage_key: data['photo_storage_key'],
        height_cm: data['height_cm'] === undefined ? null : String(data['height_cm']),
        note: data['note'] ?? null,
        // Insertion order stands in for now(): later insert, later instant.
        logged_at_utc: new Date(Date.UTC(2026, 6, seq)),
        local_date_str: data['local_date_str'],
        created_at: new Date(Date.UTC(2026, 6, seq)),
      }
      fake.entries.push({ row, deleted: false })
      return { status: 'CREATED', entry: row }
    },
  ),

  listGrowthEntries: vi.fn(async (plantId: string, userId: string, limit = 50) =>
    fake.entries
      .filter((e) => !e.deleted && e.row['plant_id'] === plantId && e.row['user_id'] === userId)
      .sort(
        (a, b) =>
          (b.row['logged_at_utc'] as Date).getTime() - (a.row['logged_at_utc'] as Date).getTime(),
      )
      .slice(0, limit)
      .map((e) => e.row),
  ),

  softDeleteGrowthEntry: vi.fn(async (entryId: string, plantId: string, userId: string) => {
    const hit = fake.entries.find(
      (e) =>
        !e.deleted &&
        e.row['id'] === entryId &&
        e.row['plant_id'] === plantId &&
        e.row['user_id'] === userId,
    )
    if (!hit) return false
    hit.deleted = true
    return true
  }),
}))

vi.mock('../engagement/engagementService.ts', () => ({
  recordDailyLogSafe: vi.fn(async () => undefined),
}))

vi.mock('../reminders/remindersRepo.ts', () => ({
  cancelForTarget: vi.fn(async () => undefined),
}))

// The routes mount the real authenticate middleware; bypass it and stamp a
// fixed subject so the tests exercise the controller, not token verification.
vi.mock('../auth/authController.ts', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    ;(req as unknown as Record<string, unknown>).userId = OWNER
    next()
  },
}))

const repo = await import('./plantsRepo.ts')
/**
 * The unmocked module, imported only for its exported ceiling: the stand-in
 * above enforces `fake.CEILING`, and pinning that to the real constant is what
 * stops these tests from passing against a repo whose limit has drifted from
 * the 40 NFR-SCAL-03 fixes. Importing it is inert — plantsRepo touches the pool
 * lazily, inside each query function.
 */
const actualRepo = await vi.importActual<typeof import('./plantsRepo.ts')>('./plantsRepo.ts')
const engagement = await import('../engagement/engagementService.ts')
const { errorHandler } = await import('../../http/errorHandler.ts')
const { requestId } = await import('../../http/requestId.ts')
const plantsRoutes = (await import('./plantsRoutes.ts')).default

const app = express()
app.use(requestId)
app.use(express.json())
app.use('/api/v1/plants', plantsRoutes)
app.use(errorHandler)

const PHOTO = 'https://images.example.com/plants/fig-2026-07-20.jpg'

function postEntry(plantId: string, body: Record<string, unknown>) {
  return request(app).post(`/api/v1/plants/${plantId}/growth`).send(body)
}

/**
 * Fill a timeline to `count` live entries directly rather than through `count`
 * HTTP round-trips: the create path itself is covered above, and these tests
 * are about what happens once the plant is full.
 */
function seedEntries(count: number, plantId: string = PLANT): void {
  for (let i = 0; i < count; i += 1) {
    const { id, seq } = fake.nextId()
    fake.entries.push({
      row: {
        id,
        plant_id: plantId,
        user_id: OWNER,
        photo_url: PHOTO,
        photo_storage_key: PHOTO,
        height_cm: null,
        note: null,
        logged_at_utc: new Date(Date.UTC(2026, 5, seq)),
        local_date_str: '2026-06-01',
        created_at: new Date(Date.UTC(2026, 5, seq)),
      },
      deleted: false,
    })
  }
}

/** Live (non-tombstoned) rows for a plant — what the ceiling counts. */
function liveCount(plantId: string = PLANT): number {
  return fake.entries.filter((e) => !e.deleted && e.row['plant_id'] === plantId).length
}

beforeEach(() => {
  fake.reset()
  vi.clearAllMocks()
})

describe('POST /api/v1/plants/:id/growth', () => {
  it('creates an entry and defaults the storage key to the photo URL', async () => {
    const res = await postEntry(PLANT, {
      photo_url: PHOTO,
      height_cm: 42.5,
      note: 'New leaf unfurling.',
      local_date_str: '2026-07-20',
    })

    expect(res.status).toBe(201)
    expect(res.body.photo_url).toBe(PHOTO)
    // No object storage account: the URL is its own key.
    expect(res.body.photo_storage_key).toBe(PHOTO)
    expect(res.body.local_date_str).toBe('2026-07-20')
    expect(repo.createGrowthEntry).toHaveBeenCalledWith(
      OWNER,
      PLANT,
      expect.objectContaining({ photo_storage_key: PHOTO, height_cm: 42.5 }),
    )
  })

  it('keeps a supplied storage key distinct from the URL', async () => {
    const res = await postEntry(PLANT, {
      photo_url: PHOTO,
      photo_storage_key: 'growth/33333333/2026-07-20.jpg',
      local_date_str: '2026-07-20',
    })

    expect(res.status).toBe(201)
    expect(res.body.photo_storage_key).toBe('growth/33333333/2026-07-20.jpg')
  })

  it('rejects a photo_url that is not a URL at all', async () => {
    const res = await postEntry(PLANT, { photo_url: 'not-a-url', local_date_str: '2026-07-20' })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.details[0].field).toBe('photo_url')
    expect(repo.createGrowthEntry).not.toHaveBeenCalled()
  })

  it('rejects a non-http(s) scheme even though it parses as a URL', async () => {
    // zod's .url() accepts this; the explicit scheme check is what stops it
    // reaching an <img src> in either client.
    const res = await postEntry(PLANT, {
      photo_url: 'javascript:alert(document.cookie)',
      local_date_str: '2026-07-20',
    })

    expect(res.status).toBe(422)
    expect(repo.createGrowthEntry).not.toHaveBeenCalled()
  })

  it('rejects a malformed local_date_str and an out-of-range height', async () => {
    const badDate = await postEntry(PLANT, { photo_url: PHOTO, local_date_str: '20-07-2026' })
    expect(badDate.status).toBe(422)

    const badHeight = await postEntry(PLANT, {
      photo_url: PHOTO,
      height_cm: 9000,
      local_date_str: '2026-07-20',
    })
    expect(badHeight.status).toBe(422)
    expect(repo.createGrowthEntry).not.toHaveBeenCalled()
  })

  it('rejects unknown body fields rather than dropping them silently', async () => {
    const res = await postEntry(PLANT, {
      photo_url: PHOTO,
      local_date_str: '2026-07-20',
      user_id: '99999999-9999-4999-8999-999999999999',
    })

    expect(res.status).toBe(422)
    expect(repo.createGrowthEntry).not.toHaveBeenCalled()
  })

  it("answers 404, not 403, for another user's plant (BR-PLT-36 cl.3)", async () => {
    const res = await postEntry(OTHER_PLANT, { photo_url: PHOTO, local_date_str: '2026-07-20' })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('does not advance the plant-care streak — a photo is not a care action', async () => {
    await postEntry(PLANT, { photo_url: PHOTO, local_date_str: '2026-07-20' })
    expect(engagement.recordDailyLogSafe).not.toHaveBeenCalled()
  })
})

/**
 * NFR-SCAL-03 — "Growth entries per plant | 40 | Server-side count check at
 * create | LIMIT_EXCEEDED", status 409. Nothing else bounds this table: no rate
 * limiter is mounted on /api/v1, so the refusal below is the whole defence
 * against one account filling the free-tier database for everybody.
 */
describe('POST /api/v1/plants/:id/growth — per-plant ceiling (NFR-SCAL-03)', () => {
  it('enforces the ceiling the requirement fixes at 40', () => {
    expect(actualRepo.MAX_GROWTH_ENTRIES_PER_PLANT).toBe(40)
    // The stand-in refuses at the same number the real repo does.
    expect(fake.CEILING).toBe(actualRepo.MAX_GROWTH_ENTRIES_PER_PLANT)
  })

  it('refuses the create at the ceiling with 409 and states the counts', async () => {
    seedEntries(fake.CEILING)

    const res = await postEntry(PLANT, { photo_url: PHOTO, local_date_str: '2026-07-21' })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
    // NFR-USAB-03: a ceiling is never enforced silently — the body carries the
    // current count, the limit and, in the message, the way out.
    expect(res.body.error.details[0]).toMatchObject({
      issue: 'limit_exceeded',
      current: 40,
      ceiling: 40,
    })
    expect(res.body.error.message).toContain('40')
  })

  it('writes no row when it refuses', async () => {
    seedEntries(fake.CEILING)

    await postEntry(PLANT, { photo_url: PHOTO, local_date_str: '2026-07-21' })

    // The guard and the INSERT are one statement, so a refusal cannot leave a
    // row behind — the timeline is still exactly at the ceiling, not past it.
    expect(liveCount()).toBe(fake.CEILING)
    const timeline = await request(app).get(`/api/v1/plants/${PLANT}/growth`)
    expect(timeline.body).toHaveLength(fake.CEILING)
  })

  it('still creates the entry that lands exactly on the ceiling', async () => {
    seedEntries(fake.CEILING - 1)

    const res = await postEntry(PLANT, { photo_url: PHOTO, local_date_str: '2026-07-21' })

    expect(res.status).toBe(201)
    expect(liveCount()).toBe(fake.CEILING)
  })

  it('frees a slot when an entry is soft-deleted — tombstones do not count', async () => {
    seedEntries(fake.CEILING)
    const doomed = fake.entries[0]!.row['id'] as string

    expect((await request(app).delete(`/api/v1/plants/${PLANT}/growth/${doomed}`)).status).toBe(200)

    // The count shares listGrowthEntries' `deleted_at IS NULL` predicate, so
    // deleting a photo is the recovery route the 409 message points at.
    const res = await postEntry(PLANT, { photo_url: PHOTO, local_date_str: '2026-07-21' })
    expect(res.status).toBe(201)
    expect(liveCount()).toBe(fake.CEILING)
  })

  it("answers 404, not the ceiling error, for a plant that is not the caller's", async () => {
    // The caller's own plant is full; the target plant is somebody else's. A
    // 409 here would confirm that OTHER_PLANT exists (BR-PLT-36 cl.3), so
    // not-found has to be decided before the ceiling.
    seedEntries(fake.CEILING)

    const res = await postEntry(OTHER_PLANT, { photo_url: PHOTO, local_date_str: '2026-07-21' })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

describe('GET /api/v1/plants/:id/growth', () => {
  it('returns entries newest-first', async () => {
    const first = await postEntry(PLANT, { photo_url: PHOTO, local_date_str: '2026-07-01' })
    const second = await postEntry(PLANT, { photo_url: PHOTO, local_date_str: '2026-07-20' })

    const res = await request(app).get(`/api/v1/plants/${PLANT}/growth`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].id).toBe(second.body.id)
    expect(res.body[1].id).toBe(first.body.id)
    expect(res.body[0].local_date_str).toBe('2026-07-20')
  })

  it('never exposes the tombstone column', async () => {
    await postEntry(PLANT, { photo_url: PHOTO, local_date_str: '2026-07-20' })
    const res = await request(app).get(`/api/v1/plants/${PLANT}/growth`)
    expect(res.body[0]).not.toHaveProperty('deleted_at')
  })

  it("answers 404 for another user's plant instead of an empty list", async () => {
    // An empty list would still confirm the plant id resolves for someone.
    const res = await request(app).get(`/api/v1/plants/${OTHER_PLANT}/growth`)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(repo.listGrowthEntries).not.toHaveBeenCalled()
  })

  it('rejects a plant id that is not a UUID before it reaches SQL', async () => {
    const res = await request(app).get('/api/v1/plants/not-a-uuid/growth')

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(repo.getPlant).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/v1/plants/:id/growth/:entryId', () => {
  it('soft-deletes an entry and hides it from the timeline', async () => {
    const kept = await postEntry(PLANT, { photo_url: PHOTO, local_date_str: '2026-07-01' })
    const doomed = await postEntry(PLANT, { photo_url: PHOTO, local_date_str: '2026-07-20' })

    const del = await request(app).delete(
      `/api/v1/plants/${PLANT}/growth/${doomed.body.id}`,
    )
    expect(del.status).toBe(200)
    expect(del.body).toEqual({ status: 'deleted' })

    const res = await request(app).get(`/api/v1/plants/${PLANT}/growth`)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe(kept.body.id)
  })

  it('answers 404 on a second delete of the same entry', async () => {
    const entry = await postEntry(PLANT, { photo_url: PHOTO, local_date_str: '2026-07-20' })

    expect((await request(app).delete(`/api/v1/plants/${PLANT}/growth/${entry.body.id}`)).status)
      .toBe(200)

    const again = await request(app).delete(`/api/v1/plants/${PLANT}/growth/${entry.body.id}`)
    expect(again.status).toBe(404)
    expect(again.body.error.code).toBe('NOT_FOUND')
  })

  it('answers 404 for an entry that never existed', async () => {
    const res = await request(app).delete(`/api/v1/plants/${PLANT}/growth/${MISSING_ENTRY}`)
    expect(res.status).toBe(404)
  })

  it("answers 404 when the entry hangs off another user's plant", async () => {
    const entry = await postEntry(PLANT, { photo_url: PHOTO, local_date_str: '2026-07-20' })

    const res = await request(app).delete(
      `/api/v1/plants/${OTHER_PLANT}/growth/${entry.body.id}`,
    )

    expect(res.status).toBe(404)
    // Still listed under its real plant: the failed delete wrote nothing.
    const timeline = await request(app).get(`/api/v1/plants/${PLANT}/growth`)
    expect(timeline.body).toHaveLength(1)
  })
})
