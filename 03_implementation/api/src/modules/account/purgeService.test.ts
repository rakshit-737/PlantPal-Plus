/**
 * Erasure sweep tests — FR-ACC-22 and BR-ACC-20 clause 4.
 *
 * No PostgreSQL here: the repository is mocked, so what is under test is the
 * pass's own contract — the batch ceiling it asks for, that one account's
 * failure never costs the rest of the batch their erasure, that an account
 * cancelled between the scan and the row lock is counted as skipped rather
 * than erased, and that per-table counts are summed across the batch for the
 * observability requirement.
 *
 * The two properties this suite cannot see are asserted where they live: the
 * `for update` re-check that makes the cancellation race safe is SQL, and the
 * cascade that Table H rides on is schema.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/plantpal_test'
process.env['JWT_ACCESS_SECRET'] ??= 'test-secret-that-is-at-least-32-characters-long'

vi.mock('./purgeRepo.ts', async () => {
  // The batch ceiling and the subject hash are the real implementations: the
  // first is a constant the pass is asserted to honour, and the second is pure.
  const actual = await vi.importActual<typeof import('./purgeRepo.ts')>('./purgeRepo.ts')
  return {
    PURGE_BATCH_CEILING: actual.PURGE_BATCH_CEILING,
    USER_SCOPED_TABLES: actual.USER_SCOPED_TABLES,
    subjectHash: actual.subjectHash,
    findAccountsDueForPurge: vi.fn(async () => []),
    purgeAccount: vi.fn(async () => ({ erased: true, counts: {} })),
  }
})

const repo = await import('./purgeRepo.ts')
const { runPurgePass, PURGE_CRON } = await import('./purgeService.ts')

const ACCOUNT_A = { id: '11111111-1111-4111-8111-111111111111', email_normalised: 'a@example.com' }
const ACCOUNT_B = { id: '22222222-2222-4222-8222-222222222222', email_normalised: 'b@example.com' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runPurgePass', () => {
  it('asks for at most the BR-ACC-20 clause 4 ceiling of 100 accounts', async () => {
    vi.mocked(repo.findAccountsDueForPurge).mockResolvedValue([])

    await runPurgePass()

    expect(repo.PURGE_BATCH_CEILING).toBe(100)
    expect(repo.findAccountsDueForPurge).toHaveBeenCalledWith(100)
  })

  it('does no work and touches no account when nothing is due', async () => {
    vi.mocked(repo.findAccountsDueForPurge).mockResolvedValue([])

    const result = await runPurgePass()

    expect(result).toEqual({ due: 0, erased: 0, skipped: 0, failed: 0, counts: {} })
    expect(repo.purgeAccount).not.toHaveBeenCalled()
  })

  it('erases every due account and sums per-table counts across the batch', async () => {
    vi.mocked(repo.findAccountsDueForPurge).mockResolvedValue([ACCOUNT_A, ACCOUNT_B])
    vi.mocked(repo.purgeAccount)
      .mockResolvedValueOnce({ erased: true, counts: { plants: 3, meals: 10, users: 1 } })
      .mockResolvedValueOnce({ erased: true, counts: { plants: 1, workouts: 4, users: 1 } })

    const result = await runPurgePass()

    expect(result.due).toBe(2)
    expect(result.erased).toBe(2)
    expect(result.counts).toEqual({ plants: 4, meals: 10, workouts: 4, users: 2 })
  })

  /**
   * The cancellation race. `purgeAccount` reports `erased: false` when its
   * `for update` re-read finds the account is no longer PENDING_DELETION — a
   * user who cancelled after the scan listed them. Counting that as an erasure
   * would put a false "account erased" line in the log for an account that is
   * very much still there.
   */
  it('counts an account cancelled between the scan and the lock as skipped', async () => {
    vi.mocked(repo.findAccountsDueForPurge).mockResolvedValue([ACCOUNT_A, ACCOUNT_B])
    vi.mocked(repo.purgeAccount)
      .mockResolvedValueOnce({ erased: false, counts: {} })
      .mockResolvedValueOnce({ erased: true, counts: { users: 1 } })

    const result = await runPurgePass()

    expect(result).toMatchObject({ due: 2, erased: 1, skipped: 1, failed: 0 })
  })

  /**
   * FR-ACC-22 rule 7 / the "transaction fails partway" alternate flow: the
   * failure is contained to its own account. A batch that aborted on the first
   * error would let one stuck row hold every other user's deletion open for as
   * long as it stayed stuck.
   */
  it('keeps erasing the batch after one account throws, and reports the failure', async () => {
    vi.mocked(repo.findAccountsDueForPurge).mockResolvedValue([ACCOUNT_A, ACCOUNT_B])
    vi.mocked(repo.purgeAccount)
      .mockRejectedValueOnce(new Error('deadlock detected'))
      .mockResolvedValueOnce({ erased: true, counts: { users: 1 } })

    const result = await runPurgePass()

    expect(result).toMatchObject({ due: 2, erased: 1, skipped: 0, failed: 1 })
    expect(repo.purgeAccount).toHaveBeenCalledTimes(2)
  })

  it('runs hourly, as BR-ACC-20 clause 4 specifies', () => {
    expect(PURGE_CRON).toBe('0 * * * *')
  })
})

describe('subjectHash', () => {
  /**
   * Table I's whole claim is that the retained subject cannot be walked back to
   * the user id. A plain digest would fail that against an enumerable UUID
   * space, so the test that matters is that the key changes the output.
   */
  it('is keyed: the same user id under a different pepper yields a different subject', () => {
    const a = repo.subjectHash(ACCOUNT_A.id, 'pepper-one-that-is-32-characters-long')
    const b = repo.subjectHash(ACCOUNT_A.id, 'pepper-two-that-is-32-characters-long')

    expect(a).not.toBe(b)
    expect(a).toHaveLength(64)
  })

  it('is stable, so tombstones written in different runs correlate', () => {
    const pepper = 'pepper-one-that-is-32-characters-long'

    expect(repo.subjectHash(ACCOUNT_A.id, pepper)).toBe(repo.subjectHash(ACCOUNT_A.id, pepper))
    expect(repo.subjectHash(ACCOUNT_A.id, pepper)).not.toBe(repo.subjectHash(ACCOUNT_B.id, pepper))
  })
})
