import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { authenticate } from '../auth/authController.ts'
import { AppError, notFound, badRequest, type ErrorDetail } from '../../http/errors.ts'
import { getUserId } from '../../http/requestUser.ts'
import { recordDailyLogSafe } from '../engagement/engagementService.ts'
import { cancelForTarget } from '../reminders/remindersRepo.ts'
import {
  listPlants,
  getPlant,
  createPlant,
  type CreatePlantData,
  updatePlant,
  softDeletePlant,
  logCareEvent,
  listCareEvents,
  createGrowthEntry,
  listGrowthEntries,
  softDeleteGrowthEntry,
  listSpecies,
} from './plantsRepo.ts'

const VALID_ACTION_TYPES = ['WATER', 'FERTILIZE', 'PRUNE', 'REPOT', 'MIST', 'ROTATE', 'TREAT']

/**
 * A growth entry's photo lives wherever the user already hosts images; only
 * the reference is stored (BR-PLT-25 cl.1, and the growth_log_entries schema
 * comment). Validation therefore has one job: make sure the string is a URL a
 * browser will fetch as an image.
 *
 * zod's `.url()` is not enough on its own — it accepts any parseable scheme,
 * including `javascript:` and `data:`, and both clients drop this value
 * straight into an `<img src>`. Pinning http(s) here keeps a stored-XSS vector
 * out of the timeline. The 2048 cap mirrors the practical browser URL limit and
 * stops an unbounded string reaching a TEXT column.
 */
const photoUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'photo_url must be an http(s) URL')

/**
 * `.strict()` so an unknown key is a 422 rather than being silently dropped:
 * this object is mapped field-by-field into the repo call, and rejecting
 * surprises outright is what keeps a future refactor from turning a stray
 * `user_id` or `deleted_at` in the body into a mass-assignment hole.
 *
 * The numeric and length caps are the growth_log_entries CHECK constraints
 * restated, so a request that passes validation can never trip a database
 * constraint and surface to the user as a 500. (BR-PLT-24 cl.2 states tighter
 * product limits — 0.1–1000 cm, 500-character note — those belong to the
 * client's guided form, not to the column the API must not violate.)
 */
const growthEntrySchema = z
  .object({
    photo_url: photoUrlSchema,
    photo_storage_key: z.string().trim().min(1).max(512).optional(),
    height_cm: z.number().min(0).max(5000).optional(),
    note: z.string().trim().max(1000).optional(),
    // Same shape the care path and the column CHECK both require.
    local_date_str: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict()

/** Same detail ceiling the sync drain applies, so one bad body cannot return a wall of issues. */
const MAX_DETAILS = 20

function detailsFor(error: z.ZodError): ErrorDetail[] {
  return error.issues.slice(0, MAX_DETAILS).map((issue) => ({
    field: issue.path.join('.') || '(root)',
    issue: issue.message,
  }))
}

/**
 * Route parameters reach Postgres as `uuid` bind values. A malformed one is
 * SQLSTATE 22P02 from the driver, which the terminal handler can only classify
 * as INTERNAL_ERROR — a 500 for what is plainly a client mistake. Reject the
 * shape before it becomes a query parameter.
 */
function requireUuidParam(value: string | undefined, field: string): string {
  const parsed = z.string().uuid().safeParse(value)
  if (!parsed.success) {
    throw badRequest(`${field} must be a UUID.`, [{ field, issue: 'invalid' }])
  }
  return parsed.data
}

export { authenticate }

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const plants = await listPlants(userId)
    res.json(plants)
  } catch (err) {
    next(err)
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const plant = await getPlant(req.params.id!, userId)
    if (!plant) throw notFound()
    res.json(plant)
  } catch (err) {
    next(err)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const body = req.body as Record<string, unknown>

    const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : ''
    if (!nickname || nickname.length > 80) {
      throw badRequest('nickname must be 1–80 characters.', [{ field: 'nickname', issue: 'invalid' }])
    }

    const base = Number(body.base_interval_days)
    if (!Number.isInteger(base) || base < 1 || base > 365) {
      throw badRequest('base_interval_days must be 1–365.', [{ field: 'base_interval_days', issue: 'invalid' }])
    }

    const min = Number(body.min_interval_days)
    const max = Number(body.max_interval_days)
    if (min > max) {
      throw badRequest('min_interval_days must not exceed max_interval_days.', [
        { field: 'min_interval_days', issue: 'invalid' },
      ])
    }

    const plant = await createPlant(userId, body as unknown as CreatePlantData)
    res.status(201).json(plant)
  } catch (err) {
    next(err)
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const plant = await updatePlant(req.params.id!, userId, req.body)
    if (!plant) throw notFound()
    res.json(plant)
  } catch (err) {
    next(err)
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const deleted = await softDeletePlant(req.params.id!, userId)
    if (!deleted) throw notFound()
    // FR-NOT-22 / E-14: reminders for a deleted subject must not fire.
    await cancelForTarget(userId, req.params.id!).catch(() => undefined)
    res.json({ status: 'deleted' })
  } catch (err) {
    next(err)
  }
}

export async function logCare(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const body = req.body as Record<string, unknown>

    const actionType = body.action_type as string
    if (!actionType || !VALID_ACTION_TYPES.includes(actionType)) {
      throw badRequest('action_type must be one of: ' + VALID_ACTION_TYPES.join(', '), [
        { field: 'action_type', issue: 'invalid' },
      ])
    }

    const localDateStr = body.local_date_str as string
    if (!localDateStr) {
      throw badRequest('local_date_str is required.', [{ field: 'local_date_str', issue: 'required' }])
    }

    try {
      await logCareEvent(
        userId,
        req.params.id!,
        actionType,
        body.note as string | undefined,
        localDateStr,
        body.client_idempotency_key as string | undefined,
      )
    } catch (err: unknown) {
      if (err && typeof err === 'object' && '__notFound' in (err as Record<string, unknown>)) {
        throw notFound()
      }
      throw err
    }
    // FR-NOT-22: the watering resolves the nag — a live reminder for this
    // plant must not keep firing.
    if (actionType === 'WATER') {
      await cancelForTarget(userId, req.params.id!).catch(() => undefined)
    }
    // BR-GAM-02: a resolved care task may complete the plant-care day.
    await recordDailyLogSafe(userId, 'PLANT_CARE', localDateStr)
    res.status(201).json({ status: 'logged' })
  } catch (err) {
    next(err)
  }
}

export async function getCareHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const events = await listCareEvents(req.params.id!, userId)
    res.json(events)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/plants/:id/growth — FR-PLT-20.
 *
 * No engagement or reminder side effect on purpose: a growth entry is an
 * observation, not a care action, so it must not close a care task or advance
 * the PLANT_CARE streak day that BR-GAM-02 reserves for logged care.
 */
export async function logGrowth(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const plantId = requireUuidParam(req.params.id, 'id')

    const parsed = growthEntrySchema.safeParse(req.body)
    if (!parsed.success) {
      throw badRequest('The request failed validation.', detailsFor(parsed.error))
    }
    const body = parsed.data

    const result = await createGrowthEntry(userId, plantId, {
      photo_url: body.photo_url,
      // The column is NOT NULL because BR-PLT-25 assumes an object-storage
      // asset. A user with no bucket hosts the image somewhere they already
      // own, so the URL is its own key — a stable identifier either way, and
      // the shape stays right for the day a real storage key arrives.
      photo_storage_key: body.photo_storage_key ?? body.photo_url,
      // Spread rather than assign: under exactOptionalPropertyTypes an omitted
      // optional and one explicitly set to undefined are different types, and
      // "the client said nothing" is what the repo turns into a SQL NULL.
      ...(body.height_cm !== undefined ? { height_cm: body.height_cm } : {}),
      ...(body.note !== undefined ? { note: body.note } : {}),
      local_date_str: body.local_date_str,
    })
    // NOT_FOUND means "not your plant, or no such plant" — indistinguishable by
    // design (BR-PLT-36 cl.3), and the same 404 the care endpoints answer with.
    // It is checked first so a full plant belonging to somebody else answers
    // 404 rather than confirming its existence with a ceiling error.
    if (result.status === 'NOT_FOUND') throw notFound()

    if (result.status === 'LIMIT_EXCEEDED') {
      // NFR-SCAL-03 caps the timeline at 40 entries per plant and names the
      // refusal LIMIT_EXCEEDED at HTTP 409; the closed code registry
      // (FR-SYS-19) has no such member and CONFLICT is its 409, which is the
      // mapping createCustomFood already uses for its ceiling. The counts ride
      // in the details, and the message names the recovery route, because a
      // ceiling must never be enforced silently (NFR-USAB-03).
      throw new AppError(
        'CONFLICT',
        `This plant already has the maximum of ${result.ceiling} growth entries. Delete an older entry to add a new one.`,
        {
          details: [
            {
              field: 'growth',
              issue: 'limit_exceeded',
              current: result.current,
              ceiling: result.ceiling,
            },
          ],
        },
      )
    }

    res.status(201).json(result.entry)
  } catch (err) {
    next(err)
  }
}

/** GET /api/v1/plants/:id/growth — FR-PLT-21, newest-first, soft-deleted rows excluded. */
export async function getGrowthHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const plantId = requireUuidParam(req.params.id, 'id')

    // The parent is resolved first, and only because of BR-PLT-36 cl.3:
    // querying the entries alone would answer an unowned plant with `[]` and a
    // missing plant with `[]`, but a plant the caller *does* own and that has
    // photos with a non-empty list — which turns the endpoint into an
    // ownership oracle for anyone holding a plant id.
    const plant = await getPlant(plantId, userId)
    if (!plant) throw notFound()

    res.json(await listGrowthEntries(plantId, userId))
  } catch (err) {
    next(err)
  }
}

/** DELETE /api/v1/plants/:id/growth/:entryId — BR-PLT-24 cl.5, soft delete. */
export async function removeGrowthEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const plantId = requireUuidParam(req.params.id, 'id')
    const entryId = requireUuidParam(req.params.entryId, 'entryId')

    // One predicate covers ownership, wrong-plant and already-deleted; all
    // three are a 404, so no case reveals that the row exists.
    const deleted = await softDeleteGrowthEntry(entryId, plantId, userId)
    if (!deleted) throw notFound()

    res.json({ status: 'deleted' })
  } catch (err) {
    next(err)
  }
}

export async function searchSpecies(req: Request, res: Response, next: NextFunction) {
  try {
    const species = await listSpecies(req.query.q as string | undefined)
    res.json(species)
  } catch (err) {
    next(err)
  }
}
