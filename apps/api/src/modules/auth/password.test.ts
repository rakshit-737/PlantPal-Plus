import { describe, expect, it } from 'vitest'

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PasswordPolicyError,
  assertPasswordPolicy,
  hashPassword,
  verifyPassword,
} from './password.ts'

const VALID = 'correct horse battery staple'

describe('password policy — NFR-SEC-03', () => {
  it('requires at least 12 characters', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12)
    expect(() => assertPasswordPolicy('short')).toThrow(PasswordPolicyError)
    expect(() => assertPasswordPolicy('a'.repeat(12))).not.toThrow()
  })

  it('caps at 128 characters', () => {
    expect(PASSWORD_MAX_LENGTH).toBe(128)
    expect(() => assertPasswordPolicy('a'.repeat(129))).toThrow(PasswordPolicyError)
  })

  it('counts code points, not UTF-16 units, so an emoji passphrase is measured as a user sees it', () => {
    // 12 astral-plane emoji are 24 UTF-16 units but 12 code points, and must pass.
    const emojiPassphrase = '🌱'.repeat(12)
    expect(emojiPassphrase.length).toBe(24)
    expect(() => assertPasswordPolicy(emojiPassphrase)).not.toThrow()
  })

  it('never trims, so leading and trailing spaces are part of the secret', async () => {
    const padded = `  ${VALID}  `
    const hash = await hashPassword(padded)
    expect(await verifyPassword(padded, hash)).toBe(true)
    expect(await verifyPassword(VALID, hash)).toBe(false)
  })
})

describe('hashing round trip', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword(VALID)
    expect(await verifyPassword(VALID, hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword(VALID)
    expect(await verifyPassword('wrong horse battery staple', hash)).toBe(false)
  })

  it('produces a different hash each time, proving a random salt is applied', async () => {
    const a = await hashPassword(VALID)
    const b = await hashPassword(VALID)
    expect(a).not.toBe(b)
    expect(await verifyPassword(VALID, a)).toBe(true)
    expect(await verifyPassword(VALID, b)).toBe(true)
  })

  it('never stores the plaintext inside the hash string', async () => {
    const hash = await hashPassword(VALID)
    expect(hash).not.toContain(VALID)
    expect(hash).not.toContain('correct')
  })

  it('emits a recognised hash format from whichever backend is available', async () => {
    const hash = await hashPassword(VALID)
    // Argon2id when the native module is present, otherwise the documented bcrypt fallback.
    expect(hash.startsWith('$argon2') || hash.startsWith('$2')).toBe(true)
  })

  it('returns false rather than throwing on a malformed stored hash', async () => {
    // A verification that throws would let a caller distinguish "no such user"
    // from "corrupt row", which is an enumeration oracle.
    expect(await verifyPassword(VALID, 'not-a-hash')).toBe(false)
    expect(await verifyPassword(VALID, '')).toBe(false)
  })
})
