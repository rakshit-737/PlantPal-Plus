/**
 * Custom food tests — FR-NUT-10.
 *
 * No PostgreSQL here, so the repository is mocked and these exercise the
 * endpoint contract: the returned shape, the fact that ownership is taken from
 * the authenticated subject rather than the body, the CHECK-derived validation
 * bounds, the NFR-SCAL-03 ceiling, creator-scoped visibility through the
 * existing search, and the delete path's refusal to admit that anything it will
 * not delete exists.
 *
 * The repo stand-in keeps an in-memory foods table and reproduces three
 * predicates from nutritionRepo: the search scope (`deleted_at is null` and
 * `is_custom = false or created_by = caller`), the delete scope (`created_by =
 * caller and is_custom and deleted_at is null`), and the ceiling scope (live
 * rows plus tombstones younger than the retention window). That pins the
 * *wiring* — which user id each layer is handed, and which of these three
 * outcomes the controller turns into which envelope — not the SQL itself, which
 * only an integration test against a real database can cover.
 */

import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CreateCustomFoodInput,
  CreateCustomFoodResult,
  FoodSearchResult,
} from './nutritionRepo.ts'

process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/plantpal_test'
process.env['JWT_ACCESS_SECRET'] ??= 'test-secret-that-is-at-least-32-characters-long'

const CREATOR = '22222222-2222-4222-8222-222222222222'
const OTHER = '33333333-3333-4333-8333-333333333333'
/** Well-formed and absent from the stand-in table. */
const MISSING = '44444444-4444-4444-8444-444444444444'

const CEILING = 200
const RETENTION_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

/** The columns searchFoods returns; the create response must match exactly. */
const FOOD_KEYS = [
  'brand',
  'carbs_per_100g',
  'default_serving_grams',
  'default_serving_unit',
  'fat_per_100g',
  'id',
  'is_custom',
  'kcal_per_100g',
  'name',
  'protein_per_100g',
]

/**
 * `is_custom` is projected; `created_by` and `deleted_at` are not. That split is
 * the contract the web's delete affordance leans on: inside a response every
 * custom row is already the caller's own, so the flag is an ownership flag and
 * no user id needs to travel to say so.
 */
interface StoredFood extends FoodSearchResult {
  created_by: string | null
  deleted_at: Date | null
}

/** Stand-in for the foods table. Declared before the dynamic imports below,
 *  which is when the mock factory actually runs. */
const foods: StoredFood[] = []
let nextId = 0

/** The projection both repo queries share — everything but the owner column
 *  and the tombstone. */
const view = ({ created_by: _o, deleted_at: _d, ...rest }: StoredFood): FoodSearchResult => rest

/**
 * nutritionRepo.ceilingScopeSql: live rows plus tombstones still inside the
 * retention window. Reproduced here rather than approximated, because the
 * whole point of the delete-then-create tests is which rows this counts.
 */
const countsTowardCeiling = (f: StoredFood, userId: string): boolean =>
  f.created_by === userId &&
  f.is_custom &&
  (f.deleted_at === null || f.deleted_at.getTime() > Date.now() - RETENTION_DAYS * DAY_MS)

vi.mock('./nutritionRepo.ts', () => ({
  MAX_CUSTOM_FOODS_PER_USER: CEILING,
  CUSTOM_FOOD_RETENTION_DAYS: RETENTION_DAYS,

  createCustomFood: vi.fn(
    async (userId: string, data: CreateCustomFoodInput): Promise<CreateCustomFoodResult> => {
      const counted = foods.filter((f) => countsTowardCeiling(f, userId))
      if (counted.length >= CEILING) {
        return {
          status: 'LIMIT_EXCEEDED',
          current: counted.length,
          ceiling: CEILING,
          deleted: counted.filter((f) => f.deleted_at !== null).length,
        }
      }

      const food: StoredFood = {
        id: `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
        name: data.name,
        brand: data.brand ?? null,
        kcal_per_100g: data.kcal_per_100g,
        protein_per_100g: data.protein_per_100g,
        carbs_per_100g: data.carbs_per_100g,
        fat_per_100g: data.fat_per_100g,
        default_serving_unit: data.default_serving_unit,
        default_serving_grams: data.default_serving_grams ?? null,
        // Written as SQL constants by the real repo; the input type cannot
        // carry them, which is what makes them unspoofable.
        is_custom: true,
        created_by: userId,
        deleted_at: null,
      }
      foods.push(food)
      return { status: 'CREATED', food: view(food) }
    },
  ),

  searchFoods: vi.fn(async (query: string, userId: string): Promise<FoodSearchResult[]> =>
    foods
      .filter((f) => f.deleted_at === null)
      .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
      .filter((f) => !f.is_custom || f.created_by === userId)
      .map(view),
  ),

  // The real predicate is `id and created_by and is_custom and deleted_at is
  // null`; a row failing any clause is simply not matched, and the repo reports
  // that as one indistinguishable false.
  softDeleteCustomFood: vi.fn(async (foodId: string, userId: string): Promise<boolean> => {
    const food = foods.find(
      (f) => f.id === foodId && f.created_by === userId && f.is_custom && f.deleted_at === null,
    )
    if (!food) return false
    food.deleted_at = new Date()
    return true
  }),

  getDailySummary: vi.fn(),
  logMeal: vi.fn(),
  logWater: vi.fn(),
}))

// Mirrors the real middleware's contract: no Bearer header means
// AUTHENTICATION_REQUIRED, and the token stands in for the subject so a test
// can act as two different users. The duck-typed marker is the escape hatch
// errorHandler already honours, which keeps this factory import-free.
vi.mock('../auth/authController.ts', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const header = req.header('authorization')
    if (!header?.startsWith('Bearer ')) {
      next(
        Object.assign(new Error('Authentication is required.'), {
          __appError: true,
          code: 'AUTHENTICATION_REQUIRED',
        }),
      )
      return
    }
    ;(req as unknown as Record<string, unknown>).userId = header.slice(7)
    next()
  },
}))

const repo = await import('./nutritionRepo.ts')
/**
 * The unmocked module, imported only for its exported constants: the stand-in
 * above enforces CEILING and RETENTION_DAYS, and pinning those to the real ones
 * is what stops these tests passing against a repo whose numbers have drifted
 * from NFR-SCAL-03's 200 and NFR-PRIV-04's 30 days. Importing it is inert —
 * nutritionRepo touches the pool lazily, inside each query function.
 */
const actualRepo = await vi.importActual<typeof import('./nutritionRepo.ts')>(
  './nutritionRepo.ts',
)
const { errorHandler } = await import('../../http/errorHandler.ts')
const { requestId } = await import('../../http/requestId.ts')
const nutritionRoutes = (await import('./nutritionRoutes.ts')).default

const app = express()
app.use(requestId)
app.use(express.json())
app.use('/api/v1/nutrition', nutritionRoutes)
app.use(errorHandler)

const VALID = {
  name: 'Amma Sambar',
  brand: 'Homemade',
  kcal_per_100g: 62.5,
  protein_per_100g: 3.1,
  carbs_per_100g: 8.4,
  fat_per_100g: 1.9,
  default_serving_unit: 'CUP',
  default_serving_grams: 240,
  barcode: '8901234567890',
}

const post = (body: Record<string, unknown>, as: string = CREATOR) =>
  request(app).post('/api/v1/nutrition/foods').set('Authorization', `Bearer ${as}`).send(body)

const del = (id: string, as: string = CREATOR) =>
  request(app).delete(`/api/v1/nutrition/foods/${id}`).set('Authorization', `Bearer ${as}`)

const search = (as: string, q = 'sambar') =>
  request(app)
    .get('/api/v1/nutrition/foods/search')
    .query({ q })
    .set('Authorization', `Bearer ${as}`)

/** Push a row straight into the stand-in table, bypassing the create path. */
function seedFood(over: Partial<StoredFood> = {}): StoredFood {
  const food: StoredFood = {
    id: `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
    name: 'Seeded food',
    brand: null,
    kcal_per_100g: 100,
    protein_per_100g: 0,
    carbs_per_100g: 0,
    fat_per_100g: 0,
    default_serving_unit: 'GRAM',
    default_serving_grams: null,
    is_custom: true,
    created_by: CREATOR,
    deleted_at: null,
    ...over,
  }
  foods.push(food)
  return food
}

/** A row nobody owns — the CHECK constraint forces created_by null when
 *  is_custom is false, which is what makes it undeletable by anyone. */
const seedCatalogueFood = (name = 'Idli') =>
  seedFood({ name, is_custom: false, created_by: null })

/** Fill an account to `count` counted rows directly rather than through `count`
 *  HTTP round-trips: the create path is covered above, and these tests are
 *  about what happens once the account is full. */
function seedToCeiling(owner: string = CREATOR, count = CEILING): void {
  for (let i = 0; i < count; i += 1) seedFood({ name: `Filler ${i}`, created_by: owner })
}

beforeEach(() => {
  vi.clearAllMocks()
  foods.length = 0
  nextId = 0
})

describe('POST /api/v1/nutrition/foods', () => {
  it('creates a food and returns it in the search shape', async () => {
    const res = await post(VALID)

    expect(res.status).toBe(201)
    expect(Object.keys(res.body).sort()).toEqual(FOOD_KEYS)
    expect(res.body).toMatchObject({
      name: 'Amma Sambar',
      brand: 'Homemade',
      kcal_per_100g: 62.5,
      protein_per_100g: 3.1,
      carbs_per_100g: 8.4,
      fat_per_100g: 1.9,
      default_serving_unit: 'CUP',
      default_serving_grams: 240,
    })
    // The barcode is stored but is not part of the loggable projection.
    expect(res.body.barcode).toBeUndefined()
  })

  it('defaults the macros and the serving unit exactly as the columns do', async () => {
    const res = await post({ name: 'Filter Coffee', kcal_per_100g: 40 })

    expect(res.status).toBe(201)
    expect(repo.createCustomFood).toHaveBeenCalledWith(CREATOR, {
      name: 'Filter Coffee',
      brand: undefined,
      kcal_per_100g: 40,
      protein_per_100g: 0,
      carbs_per_100g: 0,
      fat_per_100g: 0,
      default_serving_unit: 'GRAM',
    })
    expect(res.body.brand).toBeNull()
  })

  it('takes ownership from the authenticated subject, not the body', async () => {
    await post(VALID, OTHER)

    const [ownerArg, payload] = vi.mocked(repo.createCustomFood).mock.calls[0]!
    expect(ownerArg).toBe(OTHER)
    expect(payload).not.toHaveProperty('is_custom')
    expect(payload).not.toHaveProperty('created_by')
    expect(payload).not.toHaveProperty('source')
    // The stored row is custom and owned by the caller regardless of the body.
    expect(foods[0]).toMatchObject({ is_custom: true, created_by: OTHER })
  })

  it('refuses a body that tries to set is_custom, created_by or source', async () => {
    const res = await post({ ...VALID, is_custom: false, created_by: OTHER, source: 'SEED' })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(repo.createCustomFood).not.toHaveBeenCalled()
  })

  it('rejects a macro outside its 0..100 CHECK bound', async () => {
    const res = await post({ ...VALID, protein_per_100g: 150 })

    expect(res.status).toBe(422)
    expect(res.body.error.details[0].field).toBe('protein_per_100g')
    expect(repo.createCustomFood).not.toHaveBeenCalled()
  })

  it('rejects energy above the 9000 kcal CHECK bound', async () => {
    const res = await post({ ...VALID, kcal_per_100g: 12000 })

    expect(res.status).toBe(422)
    expect(res.body.error.details[0].field).toBe('kcal_per_100g')
  })

  it('rejects a barcode that is not 8 to 14 digits', async () => {
    const res = await post({ ...VALID, barcode: '12ab' })

    expect(res.status).toBe(422)
    expect(res.body.error.details[0]).toMatchObject({
      field: 'barcode',
      issue: 'must be 8 to 14 digits',
    })
    expect(repo.createCustomFood).not.toHaveBeenCalled()
  })

  it('rejects an empty or over-long name', async () => {
    expect((await post({ ...VALID, name: '   ' })).status).toBe(422)
    expect((await post({ ...VALID, name: 'x'.repeat(121) })).status).toBe(422)
    expect(repo.createCustomFood).not.toHaveBeenCalled()
  })

  it('rejects a serving unit outside the enum', async () => {
    const res = await post({ ...VALID, default_serving_unit: 'HANDFUL' })

    expect(res.status).toBe(422)
    expect(res.body.error.details[0].field).toBe('default_serving_unit')
  })

  it('rejects an unauthenticated request without touching the repo', async () => {
    const res = await request(app).post('/api/v1/nutrition/foods').send(VALID)

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED')
    expect(repo.createCustomFood).not.toHaveBeenCalled()
  })

  it('refuses a create beyond the per-user ceiling with 409 and the counts', async () => {
    vi.mocked(repo.createCustomFood).mockResolvedValueOnce({
      status: 'LIMIT_EXCEEDED',
      current: 200,
      ceiling: 200,
      deleted: 3,
    })

    const res = await post(VALID)

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
    // NFR-SCAL-03's conditions want three figures, not two: the count, the
    // ceiling, and how much of the count is already deleted and clearing
    // itself. Without the third the advice to delete something reads as a lie
    // to whoever just did.
    expect(res.body.error.details[0]).toMatchObject({
      issue: 'limit_exceeded',
      current: 200,
      ceiling: 200,
      deleted: 3,
      retention_days: RETENTION_DAYS,
    })
  })
})

describe('custom food visibility through GET /foods/search', () => {
  beforeEach(async () => {
    await post(VALID)
  })

  it('returns the creator their own custom food', async () => {
    const res = await search(CREATOR)

    expect(res.status).toBe(200)
    expect(res.body.foods).toHaveLength(1)
    expect(res.body.foods[0]).toMatchObject({ id: foods[0]!.id, name: 'Amma Sambar' })
    expect(Object.keys(res.body.foods[0]).sort()).toEqual(FOOD_KEYS)
  })

  it("never leaks it into another account's search", async () => {
    const res = await search(OTHER)

    expect(res.status).toBe(200)
    expect(res.body.foods).toEqual([])
    // Same needle, different subject — the only variable is the caller.
    expect(repo.searchFoods).toHaveBeenCalledWith('sambar', OTHER)
  })

  it('marks the row as the caller\'s own, which is what a delete affordance needs', async () => {
    const catalogue = seedCatalogueFood('Sambar powder')

    const res = await search(CREATOR)

    // Two rows, told apart by one flag. The response carries no created_by,
    // and does not need to: a custom row reaching this caller is theirs by
    // construction of the search predicate.
    expect(res.body.foods).toHaveLength(2)
    expect(res.body.foods.find((f: { id: string }) => f.id === foods[0]!.id).is_custom).toBe(true)
    expect(res.body.foods.find((f: { id: string }) => f.id === catalogue.id).is_custom).toBe(false)
    expect(res.body.foods[0]).not.toHaveProperty('created_by')
  })
})

describe('DELETE /api/v1/nutrition/foods/:id', () => {
  it('lets the creator remove their own custom food', async () => {
    const created = await post(VALID)

    const res = await del(created.body.id)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'deleted' })
    expect(repo.softDeleteCustomFood).toHaveBeenCalledWith(created.body.id, CREATOR)
    // Soft: the row is still there, carrying a tombstone. That is what keeps
    // meal_items.food_id pointing at something and what gives NFR-PRIV-04's
    // purge job a row to sweep in 30 days.
    expect(foods[0]!.deleted_at).toBeInstanceOf(Date)
  })

  /**
   * BR-ACC-01 — the four refusals below must be one indistinguishable answer.
   * A caller who can tell "not yours" from "does not exist" can walk the id
   * space and learn which foods other accounts have created.
   */
  it("answers 404 for another account's custom food, and leaves it alone", async () => {
    const created = await post(VALID)

    const res = await del(created.body.id, OTHER)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(foods[0]!.deleted_at).toBeNull()
  })

  it('answers the same 404 for a catalogue food, and leaves it alone', async () => {
    const catalogue = seedCatalogueFood()

    const res = await del(catalogue.id)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(catalogue.deleted_at).toBeNull()
  })

  it('answers the same 404 for an id that does not exist', async () => {
    const res = await del(MISSING)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('answers the same 404 for a second delete rather than re-stamping the tombstone', async () => {
    const created = await post(VALID)
    await del(created.body.id)
    const stamped = foods[0]!.deleted_at

    const res = await del(created.body.id)

    expect(res.status).toBe(404)
    // Re-stamping would silently restart the retention window and push the
    // freed ceiling slot another 30 days out.
    expect(foods[0]!.deleted_at).toBe(stamped)
  })

  it('gives every one of those refusals the identical body but for the request id', async () => {
    const created = await post(VALID)
    const bodies = [
      (await del(created.body.id, OTHER)).body.error,
      (await del(seedCatalogueFood('Poha').id)).body.error,
      (await del(MISSING)).body.error,
    ]

    for (const body of bodies) {
      expect(body).toMatchObject({
        code: bodies[0]!.code,
        message: bodies[0]!.message,
        message_key: bodies[0]!.message_key,
      })
      expect(body.details).toBeUndefined()
    }
  })

  it('rejects an unauthenticated request without touching the repo', async () => {
    const res = await request(app).delete(`/api/v1/nutrition/foods/${MISSING}`)

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED')
    expect(repo.softDeleteCustomFood).not.toHaveBeenCalled()
  })

  it('rejects a malformed id before it can become a uuid bind value', async () => {
    const res = await del('not-a-uuid')

    // 422, not the 404 above: this is decided from the syntax of the string
    // the caller sent, before any query, so it reveals nothing about which ids
    // exist. Letting it through would surface as SQLSTATE 22P02 and a 500.
    expect(res.status).toBe(422)
    expect(res.body.error.details[0]).toMatchObject({ field: 'id', issue: 'invalid' })
    expect(repo.softDeleteCustomFood).not.toHaveBeenCalled()
  })

  it('takes a deleted food out of its creator\'s search', async () => {
    const created = await post(VALID)
    expect((await search(CREATOR)).body.foods).toHaveLength(1)

    await del(created.body.id)

    // No change to the search predicate was needed: searchFoods already
    // filtered `deleted_at is null`, which is half of why the delete is soft.
    expect((await search(CREATOR)).body.foods).toEqual([])
  })
})

/**
 * The ceiling after a delete — NFR-SCAL-03.
 *
 * These pin the decision rather than an accident. NFR-SCAL-03's conditions say
 * soft-deleted records count "inside their 30-day retention window", so a
 * delete does NOT hand the slot back at once; it hands it back when the row
 * stops occupying storage. The repo's count used to have no window at all,
 * which — once delete existed — would have kept a tombstone counted for ever
 * and made the ceiling genuinely unescapable.
 */
describe('the ceiling and its tombstones (NFR-SCAL-03)', () => {
  it('enforces the numbers the requirements fix, not the stand-in\'s own', () => {
    expect(actualRepo.MAX_CUSTOM_FOODS_PER_USER).toBe(200)
    expect(actualRepo.CUSTOM_FOOD_RETENTION_DAYS).toBe(30)
    expect(CEILING).toBe(actualRepo.MAX_CUSTOM_FOODS_PER_USER)
    expect(RETENTION_DAYS).toBe(actualRepo.CUSTOM_FOOD_RETENTION_DAYS)
  })

  it('still refuses right after a delete, and says how much of the count is already deleted', async () => {
    seedToCeiling()
    expect((await post(VALID)).status).toBe(409)

    const res = await del(foods[0]!.id)
    expect(res.status).toBe(200)

    const refused = await post(VALID)
    expect(refused.status).toBe(409)
    expect(refused.body.error.details[0]).toMatchObject({
      current: CEILING,
      ceiling: CEILING,
      // The one figure that makes this refusal survivable: the user is not
      // being told to do again what they just did.
      deleted: 1,
      retention_days: RETENTION_DAYS,
    })
  })

  it('hands the slot back once the tombstone leaves the retention window', async () => {
    seedToCeiling()
    const doomed = foods[0]!
    await del(doomed.id)
    expect((await post(VALID)).status).toBe(409)

    // One day past the window, at which point NFR-PRIV-04's purge has hard
    // deleted the row and it cannot still be occupying anything.
    doomed.deleted_at = new Date(Date.now() - (RETENTION_DAYS + 1) * DAY_MS)

    const res = await post(VALID)

    expect(res.status).toBe(201)
    expect(res.body.name).toBe(VALID.name)
  })

  it("counts only the caller's own rows, so another account's deletes are irrelevant", async () => {
    seedToCeiling(OTHER)

    // OTHER is full; CREATOR owns nothing and is unaffected either way.
    expect((await post(VALID, OTHER)).status).toBe(409)
    expect((await post(VALID, CREATOR)).status).toBe(201)
  })
})
