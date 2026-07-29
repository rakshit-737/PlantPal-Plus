/**
 * Password hashing — NFR-SEC-03.
 *
 * Argon2id with the OWASP minimum parameters: 19,456 KiB memory, 2 iterations,
 * parallelism 1, 16-byte random salt, 32-byte output. Those numbers are chosen
 * to fit inside a 512 MB free-tier instance while several requests hash
 * concurrently — raising them is not free here.
 *
 * The requirement documents a fallback: bcrypt at cost factor 12 if a native
 * Argon2 build is unavailable on the host. That fallback is implemented rather
 * than merely described, because the free-tier hosts this product targets do not
 * all ship a toolchain, and a deploy that dies on a native build at 2am is a
 * worse outcome than a documented, slightly weaker hash.
 *
 * Both formats are verifiable, so an account created under one backend keeps
 * working if the host later changes.
 */

import bcrypt from 'bcryptjs'

import { logger } from '../../logging.ts'

/** NFR-SEC-03 — password length bounds, never trimmed and never truncated. */
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export const ARGON2_PARAMS = Object.freeze({
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
  saltLength: 16,
})

const BCRYPT_COST = 12

type Argon2Module = {
  hash: (password: string, options: Record<string, unknown>) => Promise<string>
  verify: (hash: string, password: string) => Promise<boolean>
}

let argon2: Argon2Module | null | undefined

/**
 * Resolve the Argon2 backend once, tolerating its absence.
 *
 * `@node-rs/argon2` ships prebuilt binaries, but an unusual platform can still
 * leave it unavailable. We probe once and cache the outcome so a missing module
 * costs one failed import rather than one per request.
 */
async function getArgon2(): Promise<Argon2Module | null> {
  if (argon2 !== undefined) return argon2
  try {
    const mod = (await import('@node-rs/argon2')) as unknown as Argon2Module
    argon2 = mod
    logger.info({ backend: 'argon2id', params: ARGON2_PARAMS }, 'password hashing backend selected')
  } catch {
    argon2 = null
    logger.warn(
      { backend: 'bcrypt', cost: BCRYPT_COST },
      'Argon2 unavailable, using the documented bcrypt fallback of NFR-SEC-03',
    )
  }
  return argon2
}

export class PasswordPolicyError extends Error {}

/** Validate against the policy without hashing, so callers can report a field error. */
export function assertPasswordPolicy(password: string): void {
  // Counted in code points, not UTF-16 units, so an emoji-containing passphrase
  // is measured the way a user perceives it.
  const length = [...password].length
  if (length < PASSWORD_MIN_LENGTH) {
    throw new PasswordPolicyError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  }
  if (length > PASSWORD_MAX_LENGTH) {
    throw new PasswordPolicyError(`Password must be at most ${PASSWORD_MAX_LENGTH} characters.`)
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password)
  const a2 = await getArgon2()
  if (a2) {
    return a2.hash(password, {
      memoryCost: ARGON2_PARAMS.memoryCost,
      timeCost: ARGON2_PARAMS.timeCost,
      parallelism: ARGON2_PARAMS.parallelism,
      outputLen: ARGON2_PARAMS.outputLen,
      saltLength: ARGON2_PARAMS.saltLength,
    })
  }
  return bcrypt.hash(password, BCRYPT_COST)
}

/**
 * Verify a password against a stored hash.
 *
 * Dispatches on the hash's own prefix rather than on the currently selected
 * backend, so hashes written before a backend change still verify.
 * Never throws on a malformed hash — it returns false, because a verification
 * that throws leaks the difference between "no such user" and "corrupt row".
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    if (storedHash.startsWith('$argon2')) {
      const a2 = await getArgon2()
      if (!a2) {
        logger.error('an Argon2 hash was stored but no Argon2 backend is available')
        return false
      }
      return await a2.verify(storedHash, password)
    }
    if (storedHash.startsWith('$2')) {
      return await bcrypt.compare(password, storedHash)
    }
    logger.error('stored password hash is in an unrecognised format')
    return false
  } catch {
    return false
  }
}
