/**
 * Account controller tests — the deletion grace window (FR-ACC-21, BR-ACC-20).
 *
 * No PostgreSQL here, so the repository is replaced by a small stateful fake
 * that honours the same contract (a repeat request returns `already_pending`
 * with the original instants). That keeps the SQL-level idempotency guard out
 * of scope — it belongs in the integration suite — while still proving the
 * controller never re-stamps or shortens a window that is already running, and
 * that the window it publishes is BR-ACC-20 clause 1's 2 592 000 seconds.
 */

import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/plantpal_test'
process.env['JWT_ACCESS_SECRET'] ??= 'test-secret-that-is-at-least-32-characters-long'

const USER_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const REQUESTED_AT = new Date('2026-07-31T10:00:00.000Z')

/** The caller's stored hash. Never compared here — `verifyPassword` is mocked. */
const STORED_HASH = '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaA'
const CORRECT_PASSWORD = 'Correct-Horse-Battery-9!'
const WRONG_PASSWORD = 'Wrong-Horse-Battery-9!'

vi.mock('./accountRepo.ts', () => ({
  DELETION_GRACE_DAYS: 30,
  getAccountState: vi.fn(),
  requestDeletion: vi.fn(),
  cancelDeletion: vi.fn(),
}))

// The step-up credential lookup (FR-ACC-21 rule 1) reaches into the auth module.
// Only the one narrow function this controller uses is stubbed, so a widening of
// the import surface shows up here as an undefined-is-not-a-function failure
// rather than silently dialling PostgreSQL.
vi.mock('../auth/authRepo.ts', () => ({
  findPasswordHashById: vi.fn(),
}))

// Argon2 verification is the real thing's job (password.test.ts); mocking it
// keeps this suite about the controller's branch — and keeps a 19 MiB hash out
// of every deletion test.
vi.mock('../auth/password.ts', () => ({
  verifyPassword: vi.fn(),
}))

// The routes mount the real authenticate middleware; replace it with one that
// keeps the same contract — Bearer or AUTHENTICATION_REQUIRED — so the suite
// exercises the controller rather than token verification, and still catches a
// route that was wired up outside the middleware.
vi.mock('../auth/authController.ts', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (!req.header('authorization')?.startsWith('Bearer ')) {
      next(
        Object.assign(new Error('Authentication is required.'), {
          code: 'AUTHENTICATION_REQUIRED',
          status: 401,
          __appError: true,
        }),
      )
      return
    }
    ;(req as unknown as Record<string, unknown>).userId = '22222222-2222-4222-8222-222222222222'
    ;(req as unknown as Record<string, unknown>).sessionId = '33333333-3333-4333-8333-333333333333'
    next()
  },
}))

const repo = await import('./accountRepo.ts')
const authRepo = await import('../auth/authRepo.ts')
const passwordModule = await import('../auth/password.ts')
// The grace window is read from the real module, not the mock: the assertions
// below are then genuinely about BR-ACC-20 clause 1 rather than about a fixture.
const { DELETION_GRACE_DAYS } = await vi.importActual<typeof import('./accountRepo.ts')>(
  './accountRepo.ts',
)
const { errorHandler } = await import('../../http/errorHandler.ts')
const { requestId } = await import('../../http/requestId.ts')
const accountRoutes = (await import('./accountRoutes.ts')).default

const app = express()
app.use(requestId)
app.use(express.json())
app.use('/api/v1/account', accountRoutes)
app.use(errorHandler)

/** Every protected call carries a bearer token; the value itself is never parsed. */
const auth = { authorization: 'Bearer test-access-token' }

/**
 * The confirmation body FR-ACC-21 rule 1 now requires. Most tests here are about
 * something else entirely (idempotency, the window arithmetic), so the step-up
 * is expressed once rather than restated in every `.send()`.
 */
const confirm = { password: CORRECT_PASSWORD }

interface FakeState {
  status: string
  deletion_requested_at: Date | null
  purge_after: Date | null
}

let account: FakeState

beforeEach(() => {
  vi.clearAllMocks()
  account = { status: 'ACTIVE', deletion_requested_at: null, purge_after: null }

  // Default: the caller has a password and it checks out. Tests that care about
  // the step-up override one or the other.
  vi.mocked(authRepo.findPasswordHashById).mockResolvedValue({ password_hash: STORED_HASH })
  vi.mocked(passwordModule.verifyPassword).mockImplementation(
    async (candidate: string) => candidate === CORRECT_PASSWORD,
  )

  vi.mocked(repo.getAccountState).mockImplementation(async () => account)

  vi.mocked(repo.requestDeletion).mockImplementation(async () => {
    if (account.status === 'PENDING_DELETION') return { kind: 'already_pending', state: account }
    account = {
      status: 'PENDING_DELETION',
      deletion_requested_at: REQUESTED_AT,
      purge_after: new Date(REQUESTED_AT.getTime() + DELETION_GRACE_DAYS * 86_400_000),
    }
    return { kind: 'scheduled', state: account }
  })

  vi.mocked(repo.cancelDeletion).mockImplementation(async () => {
    if (account.status !== 'PENDING_DELETION') return { kind: 'not_pending', state: account }
    account = { status: 'ACTIVE', deletion_requested_at: null, purge_after: null }
    return { kind: 'cancelled', state: account }
  })
})

describe('GET /api/v1/account', () => {
  it('returns the status and the (empty) countdown instants', async () => {
    const res = await request(app).get('/api/v1/account').set(auth)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      status: 'ACTIVE',
      deletion_requested_at: null,
      purge_after: null,
      deletion_scheduled_at: null,
    })
  })

  it('reports the countdown once a deletion is scheduled', async () => {
    await request(app).post('/api/v1/account/deletion').set(auth).send(confirm)

    const res = await request(app).get('/api/v1/account').set(auth)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('PENDING_DELETION')
    expect(res.body.purge_after).toBe('2026-08-30T10:00:00.000Z')
    // Same instant under the name the login response and FR-ACC-21 use.
    expect(res.body.deletion_scheduled_at).toBe(res.body.purge_after)
  })

  it('answers 401 when the user row is gone (the FR-ACC-22 sweep has run)', async () => {
    vi.mocked(repo.getAccountState).mockResolvedValueOnce(null)

    const res = await request(app).get('/api/v1/account').set(auth)
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED')
  })
})

describe('POST /api/v1/account/deletion', () => {
  it('schedules deletion 30 days out and revokes against the calling session', async () => {
    const res = await request(app).post('/api/v1/account/deletion').set(auth).send(confirm)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('PENDING_DELETION')
    expect(res.body.already_pending).toBe(false)

    // BR-ACC-20 clause 1 — exactly 30 days / 2 592 000 seconds.
    const windowSeconds =
      (Date.parse(res.body.purge_after) - Date.parse(res.body.deletion_requested_at)) / 1000
    expect(windowSeconds).toBe(2_592_000)

    // FR-ACC-21 rule 3 — the caller's own session is passed down so it can be
    // spared; losing it would put the cancellation behind a fresh login.
    expect(repo.requestDeletion).toHaveBeenCalledWith(USER_ID, SESSION_ID)
  })

  it('is idempotent: a second confirmation neither extends nor shortens the window', async () => {
    const first = await request(app).post('/api/v1/account/deletion').set(auth).send(confirm)
    const second = await request(app).post('/api/v1/account/deletion').set(auth).send(confirm)

    expect(second.status).toBe(200)
    expect(second.body.already_pending).toBe(true)
    expect(second.body.purge_after).toBe(first.body.purge_after)
    expect(second.body.deletion_requested_at).toBe(first.body.deletion_requested_at)
  })

  it('rejects an unrecognised confirmation field rather than discarding it', async () => {
    // The password is present, so the only thing wrong with this body is the
    // extra key — otherwise this would pass for the wrong reason.
    const res = await request(app)
      .post('/api/v1/account/deletion')
      .set(auth)
      .send({ ...confirm, confirmation_phrase: 'DELETE' })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(repo.requestDeletion).not.toHaveBeenCalled()
  })
})

/**
 * FR-ACC-21 rule 1 — the step-up re-authentication.
 *
 * A valid access token is not sufficient authority to revoke every session and
 * start a 30-day countdown, so the password is proved again at the moment of the
 * request. The load-bearing assertion throughout is that `requestDeletion` is
 * never reached on a failed step-up: it stamps the window and revokes sessions
 * as its first act, so "rejected but the write already happened" would be
 * indistinguishable from no protection at all.
 */
describe('POST /api/v1/account/deletion — password step-up (FR-ACC-21 rule 1)', () => {
  it('schedules the deletion when the password is correct', async () => {
    const res = await request(app).post('/api/v1/account/deletion').set(auth).send(confirm)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('PENDING_DELETION')
    // The submitted password is checked against THIS caller's stored hash —
    // not a hash from the body, and not a different account's.
    expect(authRepo.findPasswordHashById).toHaveBeenCalledWith(USER_ID)
    expect(passwordModule.verifyPassword).toHaveBeenCalledWith(CORRECT_PASSWORD, STORED_HASH)
    expect(repo.requestDeletion).toHaveBeenCalledTimes(1)
  })

  it('rejects a wrong password with 401 and never touches the repository', async () => {
    const res = await request(app)
      .post('/api/v1/account/deletion')
      .set(auth)
      .send({ password: WRONG_PASSWORD })

    expect(res.status).toBe(401)
    // The code the login path uses for a bad password — the registry is closed
    // (BR-SYS-28) and a step-up failure is an authentication failure.
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
    expect(repo.requestDeletion).not.toHaveBeenCalled()
  })

  it('leaves the account untouched after a rejected attempt', async () => {
    await request(app).post('/api/v1/account/deletion').set(auth).send({ password: WRONG_PASSWORD })

    const state = await request(app).get('/api/v1/account').set(auth)
    expect(state.body.status).toBe('ACTIVE')
    expect(state.body.deletion_scheduled_at).toBeNull()
  })

  it('rejects a missing password as a validation error, naming the field', async () => {
    const res = await request(app).post('/api/v1/account/deletion').set(auth).send({})

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('password')
    // Nothing was verified either — a missing field must not reach a hash
    // comparison against `undefined`.
    expect(passwordModule.verifyPassword).not.toHaveBeenCalled()
    expect(repo.requestDeletion).not.toHaveBeenCalled()
  })

  it('rejects an empty password rather than treating it as supplied', async () => {
    const res = await request(app).post('/api/v1/account/deletion').set(auth).send({ password: '' })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(repo.requestDeletion).not.toHaveBeenCalled()
  })

  it('rejects a non-string password rather than coercing it', async () => {
    const res = await request(app)
      .post('/api/v1/account/deletion')
      .set(auth)
      .send({ password: { toString: 'nice try' } })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(repo.requestDeletion).not.toHaveBeenCalled()
  })

  it('explains itself when the account has no password to prove (OAuth-only)', async () => {
    vi.mocked(authRepo.findPasswordHashById).mockResolvedValue({ password_hash: null })

    const res = await request(app).post('/api/v1/account/deletion').set(auth).send(confirm)

    // Nothing the caller sent was wrong, so this is a validation failure rather
    // than INVALID_CREDENTIALS: the re-authentication simply cannot be performed.
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.details[0].field).toBe('password')
    expect(repo.requestDeletion).not.toHaveBeenCalled()
  })

  it('answers 401 when the user row is gone (the FR-ACC-22 sweep has run)', async () => {
    vi.mocked(authRepo.findPasswordHashById).mockResolvedValue(null)

    const res = await request(app).post('/api/v1/account/deletion').set(auth).send(confirm)

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED')
    expect(repo.requestDeletion).not.toHaveBeenCalled()
  })
})

// Cancellation carries no password on purpose — see the module note. These
// tests send none, so a step-up accidentally added to the undo path fails here.
describe('DELETE /api/v1/account/deletion', () => {
  it('cancels a pending deletion and clears both instants', async () => {
    await request(app).post('/api/v1/account/deletion').set(auth).send(confirm)

    const res = await request(app).delete('/api/v1/account/deletion').set(auth)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      status: 'ACTIVE',
      deletion_requested_at: null,
      purge_after: null,
      deletion_scheduled_at: null,
    })
  })

  it('returns 409 CONFLICT when no deletion is pending', async () => {
    const res = await request(app).delete('/api/v1/account/deletion').set(auth)

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
  })
})

describe('authentication', () => {
  const routes = [
    ['get', '/api/v1/account'],
    ['post', '/api/v1/account/deletion'],
    ['delete', '/api/v1/account/deletion'],
  ] as const

  it.each(routes)('rejects an unauthenticated %s %s', async (method, path) => {
    const res = await request(app)[method](path)

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED')
    expect(repo.getAccountState).not.toHaveBeenCalled()
    expect(repo.requestDeletion).not.toHaveBeenCalled()
    expect(repo.cancelDeletion).not.toHaveBeenCalled()
    // The step-up is an addition to authentication, not a replacement: an
    // anonymous caller must be turned away before any credential is looked up.
    expect(authRepo.findPasswordHashById).not.toHaveBeenCalled()
  })
})
