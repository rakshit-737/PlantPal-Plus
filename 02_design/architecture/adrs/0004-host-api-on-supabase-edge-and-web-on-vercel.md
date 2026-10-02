# ADR 0004: Host the API on Supabase Edge Functions and the Web App on Vercel

## Status
Accepted (2026-10). Supersedes the hosting plan in `01-system-architecture.md` §2.2 and §4 (API on Render, keep-alive pinger).

## Context
The Phase 2 design put the Express API on a free Render instance with `node-cron` running the reminder engine in-process, and the web app on a static host with `/api/*` rewritten to it. Running that design in production exposed four problems:

- **A sleeping instance kills the scheduler.** Render's free tier sleeps after fifteen idle minutes, and the reminder cron sleeps with it. The documented mitigation — an external pinger — is best-effort and was already the project's highest-impact risk (RSK-01).
- **Free databases pause.** The Supabase project was paused after a week without activity, which took sign-in down until it was restored by hand.
- **Cookies need one origin.** The refresh token is an httpOnly cookie. Served cross-origin it becomes a third-party cookie, which Safari blocks and Chrome is phasing out, so sessions silently stop surviving a reload.
- **Supabase cannot serve HTML.** Responses from `*.supabase.co` functions with `text/html` are rewritten to `text/plain`, so the web app could not be hosted beside the API on the same origin.

## Decision
- **API:** bundle the existing Express app for Deno (`03_implementation/api/edge/`, built by `06_deployment/build.mjs`) and serve it from a Supabase Edge Function, `plantpal-api`, in the same project as the database. The function is a one-line loader that imports the committed bundle from a pinned commit; it derives its configuration from the platform (database URL, HMAC-derived secrets).
- **Scheduled work:** expose the reminder pass and the account-erasure sweep as `POST /internal/tick`, authorised by a bearer secret stored in Supabase Vault, and call it every five minutes from `pg_cron` inside the database (`06_deployment/schedule-tick.sql`).
- **Web:** deploy the static build to Vercel and rewrite `/api/*` to the edge function, so the browser only ever talks to one origin. The old edge-hosted web URL becomes a permanent redirect.
- **Monitoring:** add `/readyz`, which runs a real query, and ping it from a scheduled GitHub Actions workflow.
- Keep `render.yaml` working as an optional self-hosted Node deployment of the same code.

## Consequences
**Positive:**
- The scheduler lives in the database, which never sleeps, and it wakes the API rather than depending on it being awake. RSK-01 is retired.
- The refresh cookie is first-party on every browser.
- One platform holds the database, the API, the secrets and the schedule; every free tier involved stays free.
- Deploys are reproducible: a function's code is fixed by the commit it pins, and pushing to a branch cannot change what is running.

**Negative:**
- The edge runtime cannot load native modules, so password hashing uses a WebAssembly build of Argon2id (`hash-wasm`) instead of `@node-rs/argon2`. Both produce and verify the same standard encoding, which a cross-check test enforces.
- The API bundle is a committed build product, and redeploying means pinning the function to a new commit — a manual step documented in `06_deployment/README.md`.
- `REFRESH_COOKIE_PATH` must be `/`, because the browser sees `/api/auth/*` behind Vercel and `/functions/v1/plantpal-api/api/auth/*` when called directly. Path scoping was defence in depth; httpOnly, Secure, SameSite and the CSRF origin check remain the controls.
- The GitHub Pages mirror still calls the API cross-origin, so its sessions do not survive a reload in Safari; it is documented as a secondary address.
