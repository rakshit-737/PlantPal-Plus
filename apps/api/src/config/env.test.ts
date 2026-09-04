/**
 * Configuration tests — the load/install distinction, and the bug it hid.
 *
 * `loadEnv` validates a source and returns it. `configureEnv` validates a
 * source and makes it the one `env()` answers with. An entrypoint that reaches
 * for the first when it means the second still boots, still validates, and
 * still starts serving — and then every module that asks `env()` for a secret
 * silently gets a different configuration, loaded from `process.env`.
 *
 * That shipped, and cost an afternoon: on Supabase Edge Functions, where the
 * configuration arrives through `Deno.env` rather than `process.env`, login
 * 500ed at the line that asks for the signing secret while registration —
 * which never asks for one — succeeded. These tests are here so that
 * distinction cannot quietly rot back.
 */

import { afterEach, describe, expect, it } from 'vitest'

import { configureEnv, env, loadEnv, setEnvForTesting, type Env } from './env.ts'

const COMPLETE: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pw@db.example.com:5432/plantpal',
  JWT_ACCESS_SECRET: 'a-secret-that-is-at-least-32-characters-long',
  CORS_ORIGINS: 'https://example.com,https://www.example.com',
  REFRESH_COOKIE_PATH: '/functions/v1/plantpal-api',
}

afterEach(() => {
  setEnvForTesting(undefined)
})

describe('configureEnv', () => {
  it('makes the configuration it validated the one env() answers with', () => {
    configureEnv(COMPLETE)

    expect(env().JWT_ACCESS_SECRET).toBe(COMPLETE.JWT_ACCESS_SECRET)
    expect(env().REFRESH_COOKIE_PATH).toBe('/functions/v1/plantpal-api')
    expect(env().CORS_ORIGINS).toEqual(['https://example.com', 'https://www.example.com'])
  })

  /**
   * The regression. `env()` must not fall back to `process.env` once an
   * entrypoint has installed a configuration — on a host whose configuration
   * does not live in `process.env`, that fallback is the whole bug.
   */
  it('stops env() falling back to process.env', () => {
    configureEnv(COMPLETE)

    // Nothing in the ambient process environment names this secret, so an
    // env() that re-read process.env could not return it.
    expect(process.env['JWT_ACCESS_SECRET']).not.toBe(COMPLETE.JWT_ACCESS_SECRET)
    expect(env().JWT_ACCESS_SECRET).toBe(COMPLETE.JWT_ACCESS_SECRET)
  })

  it('rejects an invalid source without installing it', () => {
    configureEnv(COMPLETE)

    expect(() => configureEnv({ ...COMPLETE, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      /JWT_ACCESS_SECRET must be at least 32 characters/,
    )
    // The previous, valid configuration survives a rejected one.
    expect(env().JWT_ACCESS_SECRET).toBe(COMPLETE.JWT_ACCESS_SECRET)
  })
})

describe('loadEnv', () => {
  it('validates without installing — it is pure, and that is the trap', () => {
    const loaded: Env = loadEnv(COMPLETE)

    expect(loaded.JWT_ACCESS_SECRET).toBe(COMPLETE.JWT_ACCESS_SECRET)

    /*
     * env() is untouched by that call, and this is the gap configureEnv
     * closes — stated here in its sharpest form. Asking env() now does not
     * return a stale configuration, it re-reads process.env and throws,
     * because this process's environment holds no DATABASE_URL. On the edge
     * deployment that throw landed inside a request handler, mid-login, as an
     * opaque 500.
     */
    expect(() => env()).toThrow(/Invalid environment configuration/)
  })

  it('defaults the refresh cookie path to the domain-root deployment', () => {
    const { REFRESH_COOKIE_PATH: path } = loadEnv({
      ...COMPLETE,
      REFRESH_COOKIE_PATH: undefined,
    })

    expect(path).toBe('/api/auth')
  })

  it('refuses a wildcard CORS origin in production (NFR-SEC-06)', () => {
    expect(() => loadEnv({ ...COMPLETE, CORS_ORIGINS: '*' })).toThrow(/must not contain "\*"/)
  })
})
