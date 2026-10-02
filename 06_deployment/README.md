# Deployment

The live deployment of PlantPal+:

| Piece | Where | Source |
|---|---|---|
| Website | **https://plant-pal-plus.vercel.app** (Vercel) | `03_implementation/web`, built with [`03_implementation/vercel.json`](../03_implementation/vercel.json) |
| API | https://mmqqijfgtcjviogqporc.supabase.co/functions/v1/plantpal-api (Supabase Edge Function `plantpal-api`) | `03_implementation/api`, bundled into [`api/index.js`](api/index.js) |
| Database | Supabase Postgres, project `mmqqijfgtcjviogqporc` | `03_implementation/api/src/db` |
| Mirror | https://rakshit-737.github.io/PlantPal-Plus/ (GitHub Pages) | [`deploy-web.yml`](../.github/workflows/deploy-web.yml) |
| Old web URL | https://mmqqijfgtcjviogqporc.supabase.co/functions/v1/plantpal → 308 to the website | [`web_redirect/server.ts`](web_redirect/server.ts) |

[`render.yaml`](render.yaml) still deploys the same API as a long-lived Node
process for anyone who prefers one. Nothing here forks the application: every
host runs the code in [`03_implementation/`](../03_implementation/).

This folder holds only what deployment needs: the committed API bundle
([`api/index.js`](api/index.js)) and the script that builds it
([`build.mjs`](build.mjs)), the scheduler set-up ([`schedule-tick.sql`](schedule-tick.sql)),
the old web address's redirect function ([`web_redirect/`](web_redirect/)) and
the Render blueprint ([`render.yaml`](render.yaml)).

## The website — Vercel

The Vercel project's **Root Directory is `03_implementation`**, the npm
workspace root. Vercel reads [`03_implementation/vercel.json`](../03_implementation/vercel.json)
from there (install, build and output directory are all in the file) and
redeploys on every push to `main`. If the Root Directory setting is ever reset
to the repository root, the build fails at install: there is no `package.json`
at the top level.

**Why the page and the API share an origin.** The refresh token is an httpOnly
cookie. A page on one origin talking to an API on another sends that cookie as
a third-party cookie, which Safari blocks outright and Chrome is phasing out —
sign-in would silently stop surviving a reload. Vercel rewrites `/api/*` to the
API function, so the browser only ever talks to `plant-pal-plus.vercel.app` and
the cookie is first-party.

**Why not Supabase itself.** The page was first served by an edge function next
to the API, which gave the same single origin for free. But Supabase rewrites
`text/html` responses from `*.supabase.co` to `text/plain` — a guard against
functions being used as web hosts — so browsers showed the page's source
instead of the app. The `plantpal` function now only redirects old links,
deep links included, to Vercel.

**One setting on the API side.** The CSRF gate on the cookie endpoints checks
the request's `Origin` against the trusted list, so the website's origin has to
be on it. It is set as a secret on the `plantpal-api` function:

```
EXTRA_CORS_ORIGINS = https://plant-pal-plus.vercel.app,https://rakshit-737.github.io
```

Miss it and the failure is quiet in the worst way: sign-in works, and every
session refresh fifteen minutes later returns 403. The project's own origin is
always trusted, so this adds to the list rather than replacing it. Vercel
preview deployments get their own domain per commit; add the ones you use, or
test previews signed out.

## The API — Supabase Edge Functions

The deployed `plantpal-api` function is a single line that imports the bundled
API from this repository over jsDelivr, pinned to a commit:

```ts
import 'https://cdn.jsdelivr.net/gh/rakshit-737/PlantPal-Plus@<commit>/06_deployment/api/index.js'
```

Supabase packages a function's remote imports at deploy time, so the CDN is a
build-time dependency, not a runtime one, and a deployed function's bytes are
fixed for as long as it is deployed: pushing to the branch cannot change what is
running. Redeploying is what picks up a new build.

`06_deployment/api/index.js` is a build product, committed because the deployment
channel needs a public URL for it. Review [`03_implementation/api/edge/index.ts`](../03_implementation/api/edge/index.ts)
instead — that is the source.

### Deploying a new API build

Run from the repository root (the script runs npm inside `03_implementation`
for you):

```bash
node 06_deployment/build.mjs            # → 06_deployment/api/index.js
git add 06_deployment/api/index.js && git commit && git push
```

Then redeploy `plantpal-api` with the one-line loader above at the commit you
just pushed, with JWT verification **off**. That is not a relaxation: this is a
public REST API, and Supabase's own `verify_jwt` gate would demand a
Supabase-issued token no visitor has. The API authenticates every request
itself — bearer access tokens, refresh-token rotation with reuse detection, and
per-IP rate limits.

jsDelivr serves a new commit's files within a minute or two of the push. A
deploy that fails to fetch the bundle was made before the CDN caught up;
redeploy.

### Configuration

The function reads its configuration from what the edge runtime injects, so
there is nothing to set for a working deployment:

| Setting | Value |
|---|---|
| `DATABASE_URL` | `SUPABASE_DB_URL`, injected by the platform |
| `JWT_ACCESS_SECRET` | derived: `HMAC-SHA256(SUPABASE_SERVICE_ROLE_KEY, "plantpal:jwt-access")` |
| `AUDIT_PEPPER` | derived the same way, under a different label |
| `CORS_ORIGINS` | the project origin, plus anything in `EXTRA_CORS_ORIGINS` |
| `REFRESH_COOKIE_PATH` | `/` |
| `REQUIRE_EMAIL_VERIFICATION` | `false` — no mail provider is wired, so accounts are active at sign-up |

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

**Cookie scope.** The browser matches a cookie's path against the URL it
requested, not the path Express sees once the mount prefix is stripped. Behind
Vercel that path is `/api/auth/*`; called directly it is
`/functions/v1/plantpal-api/api/auth/*`. The two share no prefix but the root,
so `REFRESH_COOKIE_PATH` is `/`. Path scoping was defence in depth here, never
the control: httpOnly, Secure, SameSite and the CSRF origin gate are what hold.

### Health

| Endpoint | Answers |
|---|---|
| `GET /healthz` | `{"status":"ok"}` whenever the function runs — no dependencies |
| `GET /readyz` | `{"status":"ready","database":"up"}` after a real query, `503` when the database is unreachable (cached for 30 s) |

[`keepalive.yml`](../.github/workflows/keepalive.yml) pings `/readyz` every six
hours. A free Supabase project is paused after a week without activity — this
one was, once, and every sign-in failed until it was restored by hand — and a
red run of that workflow is the early warning.

## Scheduled work

`node-cron` needs a process that outlives a request, and an edge function does
not have one. The reminder pass and the FR-ACC-22 erasure sweep are exposed at
`POST /internal/tick` instead, authorised by a bearer secret, and driven by
`pg_cron` from inside the database every five minutes.

[`schedule-tick.sql`](schedule-tick.sql) sets that up — run it once in the SQL
editor. It generates the secret inside the database and stores it in Vault; the
cron job reads it from Vault at run time and the function reads the same entry,
so the secret is never printed or copied anywhere. The script is safe to re-run.

This is sturdier than a Node process with an in-process cron: a free instance
that sleeps takes its cron with it, while here the scheduler is the database,
which does not sleep, and it wakes the function rather than depending on it
already being awake.

## The GitHub Pages mirror

[`deploy-web.yml`](../.github/workflows/deploy-web.yml) builds the web app for
`/<repo>/` on every push to `main` and points it at the API through the
`PLANTPAL_API_URL` repository variable (the API URL above). The build refuses
to ship if that variable is unset or the URL does not answer `/healthz`.

Pages cannot rewrite `/api/*`, so the mirror calls the API cross-origin and its
refresh cookie is third-party: Safari blocks it, and sessions there may not
survive a reload. Use the Vercel address for real use.

## Render (optional)

[`render.yaml`](render.yaml) runs the same API as a Node service. The file is
not at the repository root, so a Render Blueprint created from it needs its
**Blueprint path** set to `06_deployment/render.yaml`; the service itself runs
from `03_implementation` (`rootDir` in the file). Point its
`DATABASE_URL` at this project's database using the Supabase **session pooler**
connection string (Dashboard → Connect → Session pooler, port 5432) with the
database password. Migrations need a session-mode or direct connection: they
hold an advisory lock for the whole run and the files carry their own
transactions, neither of which survives a transaction-mode pooler.

## Password hashing on the edge

`@node-rs/argon2` ships a native binding the edge runtime cannot load, so the
edge uses a WebAssembly build of Argon2id (`hash-wasm`) with the same
NFR-SEC-03 parameters and the same standard encoding. Hashes written by either
build verify on the other, so accounts created on a Node host (Render, local
development) sign in on the edge and vice versa. bcrypt at cost 12, the
fallback NFR-SEC-03 documents, remains only for a runtime with no WebAssembly,
and existing bcrypt hashes keep verifying everywhere.

This matters more than it looks: before the WebAssembly build, an Argon2 hash
was simply unverifiable on the edge, and the only thing its owner saw was
"wrong password".
