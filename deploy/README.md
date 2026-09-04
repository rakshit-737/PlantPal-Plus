# Deployment — Supabase Edge Functions

The live deployment of PlantPal+. Two functions in the Supabase project that
already hosts the database:

| Function | Serves | URL |
|---|---|---|
| `plantpal` | the web app | `https://<ref>.supabase.co/functions/v1/plantpal/` |
| `plantpal-api` | the REST API | `https://<ref>.supabase.co/functions/v1/plantpal-api/` |

`<ref>` is the Supabase project reference, `mmqqijfgtcjviogqporc` for the
deployment this repository is configured against.

This sits alongside — not instead of — the deployment paths in the root README.
[`render.yaml`](../render.yaml) still deploys the same API as a long-lived Node
process, and [`deploy-web.yml`](../.github/workflows/deploy-web.yml) still
publishes the same web app to GitHub Pages. Nothing here forks the application:
both functions run the code in `apps/`, built by `deploy/build.mjs`.

## Why both halves are one origin

The refresh token is an httpOnly cookie. A page served from one origin talking
to an API on another sends that cookie as a third-party cookie — which Safari
blocks outright and Chrome is phasing out, so sign-in silently stops working for
a growing share of users. That is the flaw the root README notes in the GitHub
Pages path.

Two functions in one project share an origin: `…supabase.co/functions/v1/plantpal`
and `…supabase.co/functions/v1/plantpal-api` differ only by path. The cookie is
first-party, CORS never enters into it, and no rewrite rule has to be
maintained anywhere.

The one thing the mount prefix costs is cookie scope. The browser matches a
cookie's path against the URL it requested, not against the path Express sees
once the prefix is stripped, so `REFRESH_COOKIE_PATH` widens from `/api/auth` to
`/functions/v1/plantpal-api`. Left at the default, the cookie would be set and
then never sent back, and every refresh would fail with nothing to show for it.

## Why the built output is committed

`deploy/api/index.js` and `deploy/web/` are build products, and committing build
products is normally wrong. They are here because the deployment channel
requires a public URL for them:

- The API is ~100 kB bundled. The deployed function is a one-line loader that
  imports it from this repository over jsDelivr, pinned to a commit. Supabase
  packages a function's remote imports into the deployed artefact at deploy
  time, so the CDN is a build-time dependency, not a runtime one.
- The web bundle is ~500 kB across ten hashed files, fetched by the static
  server function on first request per instance and held in memory.

Both are pinned to an exact commit, so a deployed function's bytes are fixed
for as long as it is deployed: pushing to the branch cannot change what is
already running. Redeploying is what picks up a new build.

`deploy/api/index.js` is generated. Review `apps/api/edge/index.ts` instead —
that is the source, and it is 180 lines.

## Deploying

```bash
node deploy/build.mjs      # → deploy/api/index.js, deploy/web/
git add deploy && git commit && git push
```

Then deploy both functions at the commit you just pushed, substituting it for
`__COMMIT__`:

- **`plantpal-api`** — a single line:
  ```ts
  import 'https://cdn.jsdelivr.net/gh/rakshit-737/PlantPal-Plus@__COMMIT__/deploy/api/index.js'
  ```
- **`plantpal`** — [`deploy/web/server.ts`](web/server.ts), with the same
  substitution.

Both are deployed with JWT verification **off**. That is not a relaxation: these
functions are a public website and a public REST API, and Supabase's own
`verify_jwt` gate would demand a Supabase-issued token that no visitor has. The
API authenticates every request itself, exactly as it does on Render — bearer
access tokens, refresh-token rotation with reuse detection, and per-IP rate
limits.

jsDelivr serves a new commit's files within a minute or two of the push. A
deploy that 404s on the bundle was made before the CDN caught up; redeploy.

## Configuration

The function reads its configuration from what the edge runtime injects, so
there is nothing to set for a working deployment:

| Setting | Value |
|---|---|
| `DATABASE_URL` | `SUPABASE_DB_URL`, injected by the platform |
| `JWT_ACCESS_SECRET` | derived: `HMAC-SHA256(SUPABASE_SERVICE_ROLE_KEY, "plantpal:jwt-access")` |
| `AUDIT_PEPPER` | derived the same way, under a different label |
| `CORS_ORIGINS` | the project origin |
| `REFRESH_COOKIE_PATH` | `/functions/v1/plantpal-api` |

Every one of these is overridden by setting the same-named secret on the
function, and an explicit value always wins.

Deriving the JWT secret rather than generating one is deliberate: a random
secret per cold start would invalidate every access token the previous instance
issued, signing users out at random. Deriving it gives the same value on every
instance for the life of the project, and HMAC is one-way, so a token signed
with it tells an attacker nothing about the key it came from.

**Rotating the service-role key rotates both derived secrets.** Access tokens
issued before the rotation stop verifying — users sign in again — and audit
tombstones written before it no longer correlate with ones written after. Set
`JWT_ACCESS_SECRET` and `AUDIT_PEPPER` explicitly on the function if you need
them to outlive the key.

## Scheduled work

`node-cron` needs a process that outlives a request, and an edge function does
not have one. The reminder pass and the FR-ACC-22 erasure sweep are exposed at
`POST /internal/tick` instead, authorised by a derived bearer secret, and driven
by `pg_cron` from inside the database:

```sql
select cron.schedule('plantpal-tick', '*/5 * * * *', $$
  select net.http_post(
    url    := 'https://<ref>.supabase.co/functions/v1/plantpal-api/internal/tick',
    headers:= jsonb_build_object('Authorization', 'Bearer ' || '<tick-secret>')
  );
$$);
```

This is strictly better than the arrangement RSK-01 describes. There, the cron
tick lives inside a free instance that sleeps after fifteen idle minutes, and an
external pinger has to keep it awake or reminders silently stop. Here the
scheduler is the database, which does not sleep, and it wakes the function
rather than depending on it already being awake.

The tick secret is `HMAC-SHA256(SUPABASE_SERVICE_ROLE_KEY, "plantpal:internal-tick")`.
It has to be authorised: an open endpoint that runs a batch of database writes
is a denial-of-service lever pointed at a free tier.

## Known limitation of this host

**Argon2 is unavailable.** `@node-rs/argon2` ships a native binding the edge
runtime cannot load, so password hashing falls back to bcrypt at cost 12 — the
fallback NFR-SEC-03 documents, and the reason it was implemented rather than
merely described.

The consequence is worth stating plainly: an account whose password was hashed
by a Node deployment (Argon2) cannot sign in against this one, because there is
no Argon2 backend here to verify it with. `verifyPassword` logs that case rather
than failing quietly. Accounts created here use bcrypt, which verifies on both
hosts, so this deployment's own accounts are unaffected — and so is a later move
to Render.
