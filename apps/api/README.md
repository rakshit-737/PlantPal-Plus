# @plantpal/api

The PlantPal+ REST API — Node.js, Express and TypeScript over PostgreSQL. One codebase runs two ways: as a long-lived Node process (local development, Render) and, bundled for Deno, as a Supabase Edge Function (production).

## Scripts

Run from the repository root:

```bash
npm run dev --workspace @plantpal/api        # watch mode on http://localhost:4000 (Node's TypeScript type stripping)
npm run build --workspace @plantpal/api      # compile to dist/
npm start --workspace @plantpal/api          # run the compiled server
npm run migrate --workspace @plantpal/api    # apply schema migrations
npm run seed --workspace @plantpal/api       # load the species, food, exercise and achievement catalogues
npm test --workspace @plantpal/api           # unit tests; integration tests need TEST_DATABASE_URL
npm run typecheck --workspace @plantpal/api
```

`npm run dev` and `npm start` apply migrations and seeds on boot, so a fresh database is ready after the first start.

## Configuration

Copy [`.env.example`](.env.example) to `.env`. Configuration is validated with Zod at startup, and the process refuses to start on a missing or invalid value rather than failing at the first request that needs it.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | PostgreSQL connection string. For Supabase, the **session pooler** string (port 5432) with `?sslmode=require`. |
| `JWT_ACCESS_SECRET` | yes | — | Access-token signing key, 32+ characters. |
| `PORT` | | `3000` | `.env.example` sets `4000`, which the web dev server proxies to. |
| `NODE_ENV` | | `development` | `development`, `test` or `production`. |
| `LOG_LEVEL` | | `info` | Pino log level. |
| `CORS_ORIGINS` | | `http://localhost:5173` | Comma-separated allow-list; never `*` in production. Also gates cookie-bearing requests by `Origin`. |
| `AUDIT_PEPPER` | | falls back to `JWT_ACCESS_SECRET` | HMAC key for the audit tombstone of an erased account. |
| `REFRESH_COOKIE_PATH` | | `/api/auth` | Path scope of the refresh cookie. Hosts that mount the API under a prefix must widen it (the edge deployment uses `/`). |
| `REQUIRE_EMAIL_VERIFICATION` | | `false` | When `true`, unverified accounts are refused after the 7-day grace window. Keep it off until a mail provider is wired. |

## Structure

```
src/
  server.ts       Node entry point: config, migrations, seeds, listen, reminder cron, graceful shutdown
  app.ts          createApp(): middleware, health routes, module routers, 404 and error handlers
  config/         Zod-validated environment
  db/             pool, migration runner (advisory-locked), seed runner, migrations/ and seeds/ (SQL)
  http/           error types, the single error handler (FR-SYS-19 envelope), rate limits, request ids
  logging.ts      structured logging
  modules/
    auth/         register, login, refresh rotation with reuse detection, logout, sessions, password hashing
    account/      profile, account deletion with a 30-day grace window, erasure sweep
    plants/       plants, species catalogue, care events, watering schedule, growth log
    fitness/      workouts, sets, exercise catalogue, personal records, weekly summary, energy estimate
    nutrition/    meals, foods (catalogue and custom), water, daily summary
    dashboard/    the aggregated day view
    engagement/   daily logs, streaks
    achievements/ badges and streak read-outs
    reminders/    the reminder engine and its schedule
    notifications/ device push tokens and Expo push delivery
    settings/     per-user preferences and module switches
    sync/         the offline outbox endpoint (idempotent, append-only)
edge/
  index.ts        Deno entry point for Supabase Edge Functions: platform-derived config, /internal/tick
  build.mjs       bundles the API into deploy/api/index.js
```

Each feature module follows the same shape: `*Routes.ts` (Express router) → `*Controller.ts` (validation, HTTP) → `*Repo.ts` (SQL), with services for logic that spans tables.

## Conventions

- **One error envelope.** Every failure is `{ error: { code, message, message_key, details?, request_id, timestamp } }`. Bad input is a 422 with field details, never a 500 — including input PostgreSQL itself rejects.
- **Derived figures are computed here, from `@plantpal/shared`.** Set volume, estimated one-rep max, energy estimates and watering intervals are never trusted from a client.
- **Requirement identifiers in comments.** `FR-`, `BR-` and `NFR-` references point to the clause a piece of code implements.
- **Offline writes are idempotent.** Every append-only event carries a client UUID, and a replay is absorbed rather than duplicated.

## Further reading

- [API reference](../../docs/api-reference.md) and the [OpenAPI 3.1 spec](../../docs/architecture/openapi.yaml)
- [Database schema](../../docs/architecture/02-database-schema.md)
- [Testing guide](../../docs/testing.md)
- [Deployment guide](../../deploy/README.md)
