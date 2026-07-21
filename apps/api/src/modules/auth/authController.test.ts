/**
 * Auth controller tests.
 *
 * No PostgreSQL is available in this environment, so the repository layer is
 * mocked and these tests exercise the controller's decision logic: the login
 * state machine, the account-enumeration defences, and the lock-out path. Those
 * are exactly the branches where a bug is both likely and expensive, and all
 * three were carrying real defects before this suite existed.
 *
 * Query correctness still needs integration tests against a real database.
 */

import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The controller signs access tokens through the validated configuration, which
// is loaded once and cached. Install a known configuration before any module
// that reads it is imported. The database URL is required by the schema but is
// never dialled here, because the repository layer is mocked below.
process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/plantpal_test'
process.env['JWT_ACCESS_SECRET'] ??= 'test-secret-that-is-at-least-32-characters-long'

vi.mock('./authRepo.js', () => ({
  DUMMY_HASH: '$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXlzYWx0MTIzNA$ZHVtbXloYXNoZHVtbXloYXNoZHVtbXloYQ',
  createUser: vi.fn(),
  createSession: vi.fn(),
  findUserForAuth: vi.fn(),
  recordLoginAttempt: vi.fn(async () => undefined),
  computeLockoutState: vi.fn(async () => ({ failures: 0, lockSeconds: 0, lastFailureAt: null })),
  recordFailedLogin: vi.fn(async () => undefined),
  recordLoginSuccess: vi.fn(async () => undefined),
  findActiveTokenByDigest: vi.fn(),
  consumeAndRotateToken: vi.fn(),
}))

vi.mock('./password.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./password.js')>()
  return { ...actual, verifyPassword: vi.fn(async () => true) }
})

const repo = await import('./authRepo.js')
const passwordModule = await import('./password.js')
const { errorHandler } = await import('../../http/errorHandler.js')
const { requestId } = await import('../../http/requestId.js')
const authRoutes = (await import('./authRoutes.js')).default
const { enforceTimingFloor, LOGIN_TIMING_FLOOR_MS } = await import('./authController.js')

const app = express()
app.use(requestId)
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use(errorHandler)

const ACTIVE_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'kip@example.com',
  status: 'ACTIVE',
  password_hash: '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaA',
  token_version: 1,
  failed_login_count: 0,
  locked_until: null,
  created_at: new Date('2026-01-01T00:00:00Z'),
  email_verified_at: new Date('2026-01-01T00:00:00Z'),
  deletion_requested_at: null,
  purge_after: null,
}

const SESSION = {
  sessionId: '22222222-2222-4222-8222-222222222222',
  refreshToken: 'refresh-token-value',
  tokenFamilyId: '33333333-3333-4333-8333-333333333333',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(repo.computeLockoutState).mockResolvedValue({
    failures: 0,
    lockSeconds: 0,
    lastFailureAt: null,
  } as never)
  vi.mocked(repo.createSession).mockResolvedValue(SESSION as never)
  vi.mocked(passwordModule.verifyPassword).mockResolvedValue(true)
})

describe('login — validation', () => {
  it('rejects a request with no credentials and names both fields', async () => {
    const res = await request(app).post('/api/auth/login').send({})
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'email',
      'password',
    ])
  })
})

describe('login — account enumeration defences (BR-ACC-10)', () => {
  it('returns an identical response for an unknown account and a wrong password', async () => {
    vi.mocked(repo.findUserForAuth).mockResolvedValue(null)
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'a-long-enough-password' })

    vi.mocked(repo.findUserForAuth).mockResolvedValue(ACTIVE_USER as never)
    vi.mocked(passwordModule.verifyPassword).mockResolvedValue(false)
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: ACTIVE_USER.email, password: 'a-long-enough-password' })

    expect(unknown.status).toBe(wrongPassword.status)
    expect(unknown.body.error.code).toBe(wrongPassword.body.error.code)
    expect(unknown.body.error.message).toBe(wrongPassword.body.error.message)
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('verifies a hash even when no account exists, so the work is not skipped', async () => {
    vi.mocked(repo.findUserForAuth).mockResolvedValue(null)
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'a-long-enough-password' })

    expect(passwordModule.verifyPassword).toHaveBeenCalledWith(
      'a-long-enough-password',
      repo.DUMMY_HASH,
    )
  })
})

describe('enforceTimingFloor — BR-ACC-10 clause 5', () => {
  it('pads a fast path up to the floor', async () => {
    const started = Date.now()
    await enforceTimingFloor(started, 120)
    expect(Date.now() - started).toBeGreaterThanOrEqual(115)
  })

  it('does not add delay when the work already exceeded the floor', async () => {
    // The regression this guards: measuring elapsed time *after* the expensive
    // work made the floor a constant delay added to a variable cost, which
    // preserved the timing difference it was meant to hide.
    const longAgo = Date.now() - 5_000
    const before = Date.now()
    await enforceTimingFloor(longAgo, LOGIN_TIMING_FLOOR_MS)
    expect(Date.now() - before).toBeLessThan(50)
  })
})

describe('login — account states (FR-ACC-02 clause 5)', () => {
  it('lets a PENDING_DELETION account sign in and returns the restore prompt', async () => {
    // The 30-day grace window exists so a user can change their mind, and
    // signing in is the only route to cancelling. Refusing the login would make
    // the grace period unusable.
    const purgeAfter = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
    vi.mocked(repo.findUserForAuth).mockResolvedValue({
      ...ACTIVE_USER,
      status: 'PENDING_DELETION',
      deletion_requested_at: new Date(),
      purge_after: purgeAfter,
    } as never)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ACTIVE_USER.email, password: 'a-long-enough-password' })

    expect(res.status).toBe(200)
    expect(res.body.account_pending_deletion).toBe(true)
    expect(res.body.deletion_scheduled_at).toBe(purgeAfter.toISOString())
  })

  it('treats an account whose purge date has already passed as non-existent', async () => {
    // DELETED and never-existed must stay indistinguishable, so a late sweep
    // must not become a way to discover that an account once existed.
    vi.mocked(repo.findUserForAuth).mockResolvedValue({
      ...ACTIVE_USER,
      status: 'PENDING_DELETION',
      purge_after: new Date(Date.now() - 60_000),
    } as never)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ACTIVE_USER.email, password: 'a-long-enough-password' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('signs in an ACTIVE account', async () => {
    vi.mocked(repo.findUserForAuth).mockResolvedValue(ACTIVE_USER as never)
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ACTIVE_USER.email, password: 'a-long-enough-password' })

    expect(res.status).toBe(200)
    expect(res.body.access_token).toEqual(expect.any(String))
    expect(res.body.expires_in).toBe(900)
    expect(res.body).not.toHaveProperty('account_pending_deletion')
  })

  it('refuses an unverified account once its 168-hour grace has elapsed', async () => {
    vi.mocked(repo.findUserForAuth).mockResolvedValue({
      ...ACTIVE_USER,
      status: 'PENDING_VERIFICATION',
      email_verified_at: null,
      created_at: new Date(Date.now() - 200 * 60 * 60 * 1000),
    } as never)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ACTIVE_USER.email, password: 'a-long-enough-password' })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED')
  })

  it('allows an unverified account still inside its grace window', async () => {
    vi.mocked(repo.findUserForAuth).mockResolvedValue({
      ...ACTIVE_USER,
      status: 'PENDING_VERIFICATION',
      email_verified_at: null,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
    } as never)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ACTIVE_USER.email, password: 'a-long-enough-password' })

    expect(res.status).toBe(200)
  })
})

describe('login — lock-out (BR-ACC-09)', () => {
  it('returns a single well-formed 429 with Retry-After, not a double response', async () => {
    // The regression this guards: the handler previously wrote a JSON body, then
    // set a header, then called next() — producing ERR_HTTP_HEADERS_SENT and a
    // second write attempt on every lock-out.
    vi.mocked(repo.computeLockoutState).mockResolvedValue({
      failures: 5,
      lockSeconds: 900,
      lastFailureAt: new Date(),
    } as never)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ACTIVE_USER.email, password: 'a-long-enough-password' })

    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('ACC_ACCOUNT_LOCKED')
    expect(res.headers['retry-after']).toBeDefined()
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    // Uniform envelope (FR-SYS-19), not a hand-rolled body.
    expect(res.body.error).toHaveProperty('message_key')
    expect(res.body.error).toHaveProperty('request_id')
    expect(res.body.error).toHaveProperty('timestamp')
  })

  it('does not lock out below the failure threshold', async () => {
    vi.mocked(repo.computeLockoutState).mockResolvedValue({
      failures: 4,
      lockSeconds: 900,
      lastFailureAt: new Date(),
    } as never)
    vi.mocked(repo.findUserForAuth).mockResolvedValue(ACTIVE_USER as never)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ACTIVE_USER.email, password: 'a-long-enough-password' })

    expect(res.status).toBe(200)
  })
})
