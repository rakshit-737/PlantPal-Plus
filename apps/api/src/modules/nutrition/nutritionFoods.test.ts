/**
 * Custom food tests — FR-NUT-10.
 *
 * No PostgreSQL here, so the repository is mocked and these exercise the
 * endpoint contract: the returned shape, the fact that ownership is taken from
 * the authenticated subject rather than the body, the CHECK-derived validation
 * bounds, the NFR-SCAL-03 ceiling, and creator-scoped visibility through the
 * existing search.
 *
 * The repo stand-in keeps an in-memory foods table and reproduces the search
 * predicate of nutritionRepo.searchFoods (`is_custom = false or created_by =
 * caller`). That pins the *wiring* — which user id each layer is handed — not
 * the SQL itself, which only an integration test against a real database can
 * cover.
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

/** The columns searchFoods returns; the create response must match exactly. */
const FOOD_KEYS = [
  'brand',
  'carbs_per_100g',
  'default_serving_grams',
  'default_serving_unit',
  'fat_per_100g',
  'id',
  'kcal_per_100g',
  'name',
  'protein_per_100g',
]

interface StoredFood extends FoodSearchResult {
  is_custom: boolean
  created_by: string | null
}

/** Stand-in for the foods table. Declared before the dynamic imports below,
 *  which is when the mock factory actually runs. */
const foods: StoredFood[] = []
let nextId = 0

vi.mock('./nutritionRepo.ts', () => ({
  MAX_CUSTOM_FOODS_PER_USER: 200,

  createCustomFood: vi.fn(
    async (userId: string, data: CreateCustomFoodInput): Promise<CreateCustomFoodResult> => {
      const food: StoredFood = {
        id: `00000000-0000-4000-8000-00000000000${++nextId}`,
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
      }
      foods.push(food)
      const { is_custom: _c, created_by: _o, ...view } = food
      return { status: 'CREATED', food: view }
    },
  ),

  searchFoods: vi.fn(async (query: string, userId: string): Promise<FoodSearchResult[]> =>
    foods
      .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
      .filter((f) => !f.is_custom || f.created_by === userId)
      .map(({ is_custom: _c, created_by: _o, ...view }) => view),
  ),

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
    })

    const res = await post(VALID)

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
    expect(res.body.error.details[0]).toMatchObject({
      issue: 'limit_exceeded',
      current: 200,
      ceiling: 200,
    })
  })
})

describe('custom food visibility through GET /foods/search', () => {
  const search = (as: string, q = 'sambar') =>
    request(app)
      .get('/api/v1/nutrition/foods/search')
      .query({ q })
      .set('Authorization', `Bearer ${as}`)

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
})
