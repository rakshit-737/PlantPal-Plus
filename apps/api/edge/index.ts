/**
 * Supabase Edge Functions entrypoint for the PlantPal+ API.
 *
 * A second front door onto the same Express app that `src/server.ts` serves on
 * Render — not a second implementation. Everything below is host adaptation:
 * configuration assembled from what the edge runtime injects, a mount prefix
 * declared, a pool opened. No route, controller or rule is redefined here, so
 * there is exactly one API and the tests that cover it cover this deployment.
 *
 * Why this host at all: Render's blueprint needs a human to click through the
 * dashboard once, and until someone does, the web app has no API to talk to.
 * The database already lives in this Supabase project, and a function deployed
 * beside it shares the origin with the web bundle — which is what keeps the
 * refresh cookie first-party rather than a third-party cookie Safari drops.
 *
 * Three deliberate differences from the Render deployment:
 *
 *  1. **No migrations or seeds at boot.** `src/server.ts` runs both, which is
 *     right for a long-lived process that owns its database. An edge function
 *     is invoked concurrently and re-instantiated freely; several cold starts
 *     racing the same migration is a way to corrupt a schema, not to apply one.
 *     Migrations stay a deliberate act here (`npm run migrate`, or the
 *     dashboard).
 *  2. **No in-process cron.** node-cron needs a process that outlives the
 *     request, and this one does not exist between invocations. The reminder
 *     pass and the erasure sweep are exposed at `/internal/tick` instead and
 *     driven by pg_cron from inside the database, which is strictly more
 *     reliable than RSK-01's sleeping instance: the database never sleeps.
 *  3. **Secrets are derived, not configured.** See `derivedSecret`.
 */

import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import process from 'node:process'

import express from 'express'

import { createApp } from '../src/app.ts'
import { configureEnv } from '../src/config/env.ts'
import { getPool, initPool } from '../src/db/pool.ts'
import { logger } from '../src/logging.ts'
import { runPurgePass } from '../src/modules/account/purgeService.ts'
import { runReminderPass } from '../src/modules/reminders/reminderService.ts'

/** Deno's global, declared rather than imported so `tsc` never needs its types. */
declare const Deno: { env: { get(key: string): string | undefined } }

/**
 * Supabase's edge-runtime global. `waitUntil` keeps the worker alive for work
 * that outlives the response; absent off-platform, hence optional.
 */
declare const EdgeRuntime: { waitUntil?(promise: Promise<unknown>): void } | undefined

/** The function slug, which is also the path prefix the runtime routes under. */
const SLUG = Deno.env.get('SUPABASE_FUNCTION_SLUG') ?? 'plantpal-api'

/**
 * A stable, per-project secret for a purpose, derived from one the platform
 * already injects.
 *
 * Edge function secrets are set through the Supabase dashboard or CLI, and this
 * deployment has neither to hand. Generating a random secret at boot is not an
 * option: every cold start would produce a new one, and every access token
 * issued by the previous instance would stop verifying — users would be signed
 * out at random. Deriving it keyed on the service-role key gives the same value
 * on every instance for the life of the project, and the label domain-separates
 * the uses so the JWT key and the audit pepper are unrelated.
 *
 * The derived value is never the service-role key itself, and HMAC is one-way,
 * so a token signed with it discloses nothing about the key it came from.
 * Setting a real `JWT_ACCESS_SECRET` in the dashboard overrides this — the
 * explicit value always wins.
 */
function derivedSecret(label: string): string {
  const root =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_DB_URL')
  if (!root) {
    throw new Error(
      'No platform secret to derive from: set JWT_ACCESS_SECRET on the function explicitly.',
    )
  }
  return createHmac('sha256', root).update(`plantpal:${label}`).digest('hex')
}

function fromEdge(key: string, fallback: string): string {
  const value = Deno.env.get(key)
  return value && value.length > 0 ? value : fallback
}

/**
 * Additional trusted web origins, comma-separated — a Vercel or Netlify domain
 * put in front of this API, or a separately hosted build.
 *
 * `CORS_ORIGINS` is accepted under its own name too, so the variable the rest
 * of the project documents does the expected thing here.
 */
const extraOrigins = (Deno.env.get('EXTRA_CORS_ORIGINS') ?? Deno.env.get('CORS_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const databaseUrl = Deno.env.get('DATABASE_URL') ?? Deno.env.get('SUPABASE_DB_URL')
if (!databaseUrl) throw new Error('Neither DATABASE_URL nor SUPABASE_DB_URL is set.')

/** The origin this function is served from — also the web app's origin. */
const publicOrigin = new URL(Deno.env.get('SUPABASE_URL') ?? 'https://localhost').origin

/*
 * Hand the app's own validated loader a complete environment rather than
 * bypassing it. A missing or malformed value must fail here, at boot, with the
 * same message it would produce on Render — not at the first request that
 * happens to need it.
 *
 * `configureEnv`, not `loadEnv`: this configuration has to be the one every
 * module sees. `loadEnv` would validate it and hand it back, leaving `env()`
 * to lazily load `process.env` instead — which on this host holds none of it.
 */
const env = configureEnv({
  ...process.env,
  NODE_ENV: 'production',
  DATABASE_URL: databaseUrl,
  JWT_ACCESS_SECRET: fromEdge('JWT_ACCESS_SECRET', derivedSecret('jwt-access')),
  AUDIT_PEPPER: fromEdge('AUDIT_PEPPER', derivedSecret('audit-pepper')),
  LOG_LEVEL: fromEdge('LOG_LEVEL', 'info'),
  /*
   * This project's own origin, plus anything configured.
   *
   * A union rather than a replacement: the function serves the web app from
   * this same origin, so trusting it is not a policy choice but a description
   * of the deployment. Making CORS_ORIGINS overwrite that would mean adding a
   * Vercel domain silently switched off the built-in site — a footgun with a
   * slow fuse, since sign-in would keep working and only session refresh would
   * start failing.
   *
   * The list matters beyond CORS: the CSRF gate on the cookie session
   * endpoints checks membership of exactly it, so a front-end whose origin is
   * missing can sign in and then fail every refresh. Fails closed, which is
   * the right way round, but it is the thing to set when putting another host
   * in front of this API.
   */
  CORS_ORIGINS: [publicOrigin, ...extraOrigins].join(','),
  /*
   * Scoped to the root, because the path a browser matches a cookie against is
   * the one it requested — not the one Express sees.
   *
   * Served directly, that path is /functions/v1/<slug>/api/auth/*. Behind a
   * host that rewrites /api/* to this function (Vercel, Netlify), the browser
   * only ever sees /api/auth/*. The two share no prefix but the root, so any
   * narrower value works for exactly one of the two deployments and silently
   * breaks refresh on the other. Narrower scoping was defence in depth here,
   * never the control: httpOnly, Secure, SameSite and the CSRF origin gate
   * above are what actually hold.
   */
  REFRESH_COOKIE_PATH: fromEdge('REFRESH_COOKIE_PATH', '/'),
} as NodeJS.ProcessEnv)

/*
 * A small pool: an edge instance serves few concurrent requests and there may
 * be many instances, so the scarce resource is the database's connection slots,
 * not this instance's. `rejectUnauthorized: false` is the one concession — the
 * runtime has no way to install Supabase's CA, and the connection never leaves
 * the project's own network.
 */
initPool(env.DATABASE_URL, 3, { rejectUnauthorized: false })

/**
 * FR-ACC-22 and the reminder pass, on a pull rather than a push.
 *
 * Authorised by a bearer secret pg_cron sends, so the endpoint is reachable by
 * the database and by nobody else. It has to be authorised — an open endpoint
 * that runs a batch of database writes is a denial-of-service lever pointed at
 * a free tier.
 *
 * Where the secret comes from, in order:
 *
 *  1. `TICK_SECRET` set on the function — an explicit value always wins.
 *  2. Supabase Vault, under `plantpal_tick_secret`. This is the normal case:
 *     the secret is generated inside the database by the scheduling migration
 *     (deploy/schedule-tick.sql), the cron job reads it from the same place
 *     at run time, and it never exists anywhere else — not in a dashboard, not
 *     in a workflow file, not in anyone's clipboard.
 *  3. The derived value, for a project whose Vault has no such secret.
 *
 * The Vault lookup is cached, but a miss is only cached for a minute, so the
 * job can be scheduled after this instance started without a redeploy.
 */
const EXPLICIT_TICK_SECRET = Deno.env.get('TICK_SECRET') || undefined
const DERIVED_TICK_SECRET = derivedSecret('internal-tick')
let vaultTickSecret: { value: string | null; at: number } | undefined

async function tickSecret(): Promise<string> {
  if (EXPLICIT_TICK_SECRET) return EXPLICIT_TICK_SECRET
  const fresh =
    vaultTickSecret && (vaultTickSecret.value !== null || Date.now() - vaultTickSecret.at < 60_000)
  if (!fresh) {
    try {
      const { rows } = await getPool().query<{ secret: string }>(
        `select decrypted_secret as secret
           from vault.decrypted_secrets
          where name = 'plantpal_tick_secret'
          limit 1`,
      )
      vaultTickSecret = { value: rows[0]?.secret ?? null, at: Date.now() }
    } catch (err) {
      // Not cached: a transient database error must not pin this instance to
      // the fallback for its whole lifetime.
      logger.warn({ err }, 'internal tick: Vault lookup failed, using the derived secret')
      return DERIVED_TICK_SECRET
    }
  }
  return vaultTickSecret?.value ?? DERIVED_TICK_SECRET
}

/** Constant-time comparison, so the check cannot be timed one byte at a time. */
function sameSecret(presented: string, expected: string): boolean {
  const a = Buffer.from(presented)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

const app = createApp({
  corsOrigins: env.CORS_ORIGINS,
  basePath: `/${SLUG}`,
})

/*
 * The tick lives on a wrapper in front of the API rather than on the API
 * itself, because `createApp` finishes by installing the 404 and error
 * handlers — anything registered on it afterwards is unreachable, which is
 * exactly what a smoke test caught here. Mounting in front also keeps this
 * operational endpoint out of the app the tests exercise: it is a property of
 * this host, not of the API.
 */
const host = express()

host.post(`/${SLUG}/internal/tick`, async (req, res) => {
  const presented = (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  let authorised: boolean
  try {
    authorised = presented.length > 0 && sameSecret(presented, await tickSecret())
  } catch {
    authorised = false
  }
  if (!authorised) {
    res.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED' } })
    return
  }
  // Both passes are idempotent and re-derive their work from durable state, so
  // an overlapping tick costs duplicated effort and never a duplicated effect.
  const work = Promise.allSettled([runReminderPass(), runPurgePass()]).then(
    ([reminders, purge]) => {
      logger.info(
        {
          reminders: reminders.status === 'fulfilled' ? reminders.value : 'failed',
          purge: purge.status === 'fulfilled' ? purge.value : 'failed',
        },
        'internal tick complete',
      )
    },
  )
  // The batch outlives the response. Without waitUntil the platform is free to
  // reclaim the worker the moment the 202 is written, cutting the pass off
  // part-way — harmless (it is idempotent) but it would never finish.
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime?.waitUntil?.(work)
  // Answered immediately: pg_cron is a scheduler, not a consumer of results,
  // and holding its worker open for the length of a batch is how a cron job
  // starts overlapping itself.
  res.status(202).json({ status: 'accepted' })
})

host.use(app)

logger.info({ slug: SLUG, origin: publicOrigin }, 'PlantPal+ API starting on Supabase Edge')

host.listen(8000)
