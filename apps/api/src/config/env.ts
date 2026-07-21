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

  /* CORS allow-list (NFR-SEC-06). Comma-separated; never "*" in production. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((o) => o.trim()).filter(Boolean)),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
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
