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

import { createHmac } from 'node:crypto'
import process from 'node:process'

import express from 'express'

import { createApp } from '../src/app.ts'
import { configureEnv } from '../src/config/env.ts'
import { initPool } from '../src/db/pool.ts'
import { logger } from '../src/logging.ts'
import { runPurgePass } from '../src/modules/account/purgeService.ts'
import { runReminderPass } from '../src/modules/reminders/reminderService.ts'

/** Deno's global, declared rather than imported so `tsc` never needs its types. */
declare const Deno: { env: { get(key: string): string | undefined } }

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
   * Same-origin in the normal case, so this list is a formality — but the
   * mobile app and any separately hosted web build are cross-origin, and the
   * CSRF gate on the cookie session endpoints checks membership of exactly
   * this list. An origin missing here fails closed, which is the right way
   * round.
   */
  CORS_ORIGINS: fromEdge('CORS_ORIGINS', publicOrigin),
  /*
   * The browser sees /functions/v1/<slug>/api/auth/*, so a cookie scoped to
   * /api/auth would be set and never sent back. Scoping to the function's own
   * path keeps it as narrow as this host allows.
   */
  REFRESH_COOKIE_PATH: fromEdge('REFRESH_COOKIE_PATH', `/functions/v1/${SLUG}`),
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
 * Authorised by a derived bearer secret: pg_cron holds the same value and sends
 * it, so the endpoint is reachable by the database and by nobody else. It has
 * to be authorised — an open endpoint that runs a batch of database writes is
 * a denial-of-service lever pointed at a free tier.
 */
const TICK_SECRET = fromEdge('TICK_SECRET', derivedSecret('internal-tick'))

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

host.post(`/${SLUG}/internal/tick`, (req, res) => {
  if (req.get('authorization') !== `Bearer ${TICK_SECRET}`) {
    res.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED' } })
    return
  }
  // Both passes are idempotent and re-derive their work from durable state, so
  // an overlapping tick costs duplicated effort and never a duplicated effect.
  void Promise.allSettled([runReminderPass(), runPurgePass()])
    .then(([reminders, purge]) => {
      logger.info(
        {
          reminders: reminders.status === 'fulfilled' ? reminders.value : 'failed',
          purge: purge.status === 'fulfilled' ? purge.value : 'failed',
        },
        'internal tick complete',
      )
    })
  // Answered immediately: pg_cron is a scheduler, not a consumer of results,
  // and holding its worker open for the length of a batch is how a cron job
  // starts overlapping itself.
  res.status(202).json({ status: 'accepted' })
})

host.use(app)

logger.info({ slug: SLUG, origin: publicOrigin }, 'PlantPal+ API starting on Supabase Edge')

host.listen(8000)
