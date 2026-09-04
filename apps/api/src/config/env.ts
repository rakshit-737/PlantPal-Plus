/**
 * Environment configuration, validated at boot.
 *
 * The process refuses to start on an invalid or missing variable rather than
 * failing later at the first request that needs it. A misconfigured secret that
 * surfaces at 3am under load is far more expensive than one that stops the
 * deploy.
 *
 * NFR-SEC-09: no secret is ever committed. `.env.example` documents the shape
 * and carries no real values.
 */

import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DATABASE_URL: z.string().url().describe('PostgreSQL connection string'),

  /* Token secrets. Minimum length is enforced so a placeholder such as "secret" cannot reach production. */
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),

  /*
   * BR-ACC-20 Table I — the HMAC key under which an erased account's audit
   * tombstone is filed. Optional: purgeService falls back to
   * JWT_ACCESS_SECRET, which is already a secret of the required length, so a
   * deployment that never sets this still writes keyed subjects rather than a
   * reversible plain hash.
   */
  AUDIT_PEPPER: z
    .string()
    .min(32, 'AUDIT_PEPPER must be at least 32 characters')
    .optional(),

  /* CORS allow-list (NFR-SEC-06). Comma-separated; never "*" in production. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((o) => o.trim()).filter(Boolean)),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /*
   * Path scope of the refresh cookie. The default keeps the cookie off every
   * request that is not a session operation, which is what a deployment served
   * at the domain root wants.
   *
   * A host that mounts the API under a prefix — a Supabase Edge Function lives
   * at /functions/v1/<name> — must widen this, because the browser matches the
   * cookie against the URL it sees, not against the path Express sees after the
   * prefix is stripped. Left at the default there, the cookie is set and then
   * never sent back, and every refresh fails with no visible cause.
   */
  REFRESH_COOKIE_PATH: z.string().startsWith('/').default('/api/auth'),
})

export type Env = z.infer<typeof schema>

let cached: Env | undefined

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.errors
      .map((e) => `  - ${e.path.join('.') || '(root)'}: ${e.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.CORS_ORIGINS.includes('*')) {
    throw new Error('CORS_ORIGINS must not contain "*" in production (NFR-SEC-06)')
  }
  return parsed.data
}

export function env(): Env {
  cached ??= loadEnv()
  return cached
}

/** Test seam: lets a suite install a known configuration without mutating process.env. */
export function setEnvForTesting(value: Env | undefined): void {
  cached = value
}
