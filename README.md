# PlantPal+

**One app for three daily habits.** Plant care, fitness and nutrition are all daily-cadence habits that share an identical loop — schedule, remind, log, streak, reflect. PlantPal+ builds that loop once and reuses it across all three, instead of asking you to run three separate apps with three logins and three notification streams.

| | |
|---|---|
| **Plant Care** | Add plants by species; watering reminders that adapt to species, season, light, pot and environment; growth log with a photo timeline |
| **Fitness** | Log workouts and steps, set goals, keep streaks, view progress charts |
| **Calories** | Log meals with calories and macros, daily targets, water intake |
| **Shared** | Unified daily dashboard, one reminder engine, streaks and achievements, accounts with cloud sync |

> **Not medical advice.** PlantPal+ is a wellness tracker, not a medical device. Energy and body-composition figures are estimates carrying a stated error band.

---

## Project status

This is a full software-engineering project delivered phase by phase, with every artefact traceable to the requirement it satisfies.

| Phase | Status |
|---|---|
| 1 — Requirement analysis | ✅ Complete — 36 documents in [docs/requirements/](docs/requirements/) |
| 2 — Design | ✅ Complete — architecture, OpenAPI 3.1, sequence diagrams and ADRs in [docs/architecture/](docs/architecture/), design package in [docs/design/](docs/design/) |
| 3 — Implementation | ✅ Core complete — REST API (auth, account lifecycle, plants + growth log, fitness, nutrition + custom foods, dashboard, achievements, reminders + Expo Push, offline sync outbox, settings, engagement loop), web app (responsive, toasts, full error/retry states, accessible pickers), Expo mobile app with a durable offline outbox. Seeded Indian catalogue: 94 plant species, 180 foods, browsable + searchable. Open: binary photo upload (the growth log stores image links — see [Known gaps](#known-gaps)), email digest |
| 4 — Testing | ✅ 462 tests across all four workspaces — 53 shared (algorithm vectors from the requirements), 235 API incl. 18 integration tests against real PostgreSQL (auth lifecycle and the first-day core flows; skipped without `TEST_DATABASE_URL`, run in CI via a service container), 24 mobile offline-outbox, 150 web component/behaviour tests under jsdom. Two adversarial multi-agent audits found and closed 6 critical and 4 major defects |
| 5 — Documentation | ✅ Complete — install + deployment in this README, endpoint index in [docs/api-reference.md](docs/api-reference.md), OpenAPI 3.1 in [docs/architecture/](docs/architecture/) |
| 6 — Deployment | ✅ Live — website on Vercel (**[plant-pal-plus.vercel.app](https://plant-pal-plus.vercel.app)**), API on Supabase Edge Functions, database on Supabase Postgres; GitHub Pages mirror; mobile via EAS |

### Phase 1 at a glance

| Artefact | Count |
|---|---|
| Functional requirements | 228 |
| Business rules | 307 |
| Non-functional requirements | 111 across 13 quality attributes |
| User stories with Gherkin criteria | 119 |
| Use cases with full specifications | 89 |
| Mermaid diagrams | 119 |

Start at **[docs/requirements/SRS.md](docs/requirements/SRS.md)** for the Software Requirements Specification, or **[docs/requirements/README.md](docs/requirements/README.md)** for a guided reading path.

---

## Repository layout

```
packages/shared/     Domain logic shared by backend, web and mobile
apps/api/            Express + TypeScript REST API
apps/web/            React + Vite web application
apps/mobile/         React Native (Expo) mobile application
docs/requirements/   Phase 1 requirements package
docs/architecture/   Phase 2 architecture (system design, DB schema, REST API spec, OpenAPI, ADRs)
docs/design/         Phase 2 design (design language, components, wireframes, navigation)
```

The shared package exists so a business rule lives in exactly one place. The watering algorithm, the Atwater energy identity and the Mifflin-St Jeor equation are each implemented once and consumed identically by the server, the website and the mobile app — the requirements demand bit-for-bit agreement between them.

---

## Installation

Requires **Node.js 20.11+** and npm. One install at the repository root covers every workspace (API, website, mobile app, shared package):

```bash
git clone https://github.com/rakshit-737/PlantPal-Plus.git
cd PlantPal-Plus
npm install

npm test            # run every workspace's tests (307; the 12 auth integration
                    # tests skip themselves unless DATABASE_URL is set)
npm run typecheck   # strict TypeScript across all packages
```

### 1. The API server (required by both clients)

You will need a PostgreSQL database — a free [Neon](https://neon.tech) or [Supabase](https://supabase.com) instance is sufficient, or any local PostgreSQL 15+.

```bash
cp apps/api/.env.example apps/api/.env
# fill in DATABASE_URL and JWT_ACCESS_SECRET (32+ chars), then:

npm run migrate --workspace @plantpal/api   # apply schema migrations 001–007
npm run seed --workspace @plantpal/api      # load species, exercise and achievement catalogues
npm run dev --workspace @plantpal/api       # API on http://localhost:4000
```

The API refuses to start on missing or invalid configuration rather than failing later at the first request that needs it.

### 2. The website (React + Vite)

```bash
cp apps/web/.env.example apps/web/.env   # set VITE_API_TARGET (default http://localhost:4000)
npm run dev --workspace @plantpal/web    # Vite dev server on http://localhost:5173
```

The dev server proxies `/api` to the target, so no CORS setup is needed locally. For a production deployment:

```bash
npm run build --workspace @plantpal/web  # static bundle in apps/web/dist/
```

Serve `apps/web/dist/` from any static host (Vercel/Netlify free tiers work) with `/api/*` rewritten to the deployed API origin.

### 3. The mobile application (React Native + Expo)

The fastest way to run it on your own phone is [Expo Go](https://expo.dev/go) (free, App Store / Play Store):

```bash
cd apps/mobile
npx expo start                            # prints a QR code
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS) — the app loads over your LAN. Emulators work too: press `a` for the Android emulator or `i` for the iOS simulator.

**Pointing the app at your API:** by default the Android emulator uses `http://10.0.2.2:4000` (the emulator's alias for your machine) and the iOS simulator uses `http://localhost:4000`. A physical phone needs your computer's LAN IP:

```bash
cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_API_URL=http://192.168.x.x:4000  (your machine's LAN address)
```

**Installable binaries** are built with [EAS](https://docs.expo.dev/build/introduction/) (free tier):

```bash
npm install -g eas-cli
eas build --platform android --profile preview   # produces an installable .apk
```

Every push and pull request to `main` runs `npm run typecheck` and `npm test` — including an auth integration suite against a real PostgreSQL service container — on Node 20.11 and 22 via [GitHub Actions](.github/workflows/ci.yml).

---

## Deployment

Everything runs on permanently free tiers.

| | Live at |
|---|---|
| **Website** | **https://plant-pal-plus.vercel.app** — Vercel, rewrites `/api/*` to the API |
| **API** | https://mmqqijfgtcjviogqporc.supabase.co/functions/v1/plantpal-api — Supabase Edge Function (`/healthz`, `/readyz`) |
| Database | Supabase Postgres, same project as the API |
| Mirror | https://rakshit-737.github.io/PlantPal-Plus/ — GitHub Pages, rebuilt on every push to `main` |

How each piece is built, deployed and configured — and the one thing the edge
host cannot do (no Argon2 binding, so the documented bcrypt fallback engages) —
is in [deploy/README.md](deploy/README.md).

**Website — Vercel.** The Vercel project builds from the repository root with
the checked-in [`vercel.json`](vercel.json) and redeploys on every push to
`main`. Its `/api/*` rewrite puts the page and the API on one origin, so the
refresh cookie stays first-party and sign-in survives on every browser. The old
`…/functions/v1/plantpal/` address redirects here: Supabase serves function
responses as plain text, so it cannot host the page itself.

**API — Supabase Edge Functions.** A one-line function loads the bundled API
([`deploy/api/index.js`](deploy/api/index.js)) pinned to a commit. It configures
itself from the platform (database URL, derived secrets); reminders and the
account-erasure sweep are driven by `pg_cron` from inside the database
([`deploy/schedule-tick.sql`](deploy/schedule-tick.sql)), and
[keepalive.yml](.github/workflows/keepalive.yml) pings `/readyz` every six hours
so a paused project shows up as a red run rather than as failed sign-ins.

**GitHub Pages mirror.** [deploy-web.yml](.github/workflows/deploy-web.yml)
publishes the same web app to Pages, calling the API cross-origin through the
`PLANTPAL_API_URL` repository variable. Pages cannot rewrite `/api/*`, so there
the refresh cookie is third-party, which Safari blocks — sessions may not
survive a reload. Prefer the Vercel address.

**Render (optional, self-hosted Node).** [render.yaml](render.yaml) is a Render
Blueprint for running the same API as a long-lived Node process: dashboard → New
→ Blueprint → select this repo. It needs `DATABASE_URL` — for this project, the
Supabase **session pooler** connection string (port 5432) with the database
password. Migrations and seeds run at boot. The free instance sleeps after 15
idle minutes, which is why the live API is on the edge instead.

**Mobile app — EAS build.** [apps/mobile/eas.json](apps/mobile/eas.json) is configured; building needs a free [Expo account](https://expo.dev):

```bash
npm install -g eas-cli
eas login
cd apps/mobile
eas build --platform android --profile preview   # installable .apk, API URL baked in
```

The `preview`/`production` profiles bake `EXPO_PUBLIC_API_URL` as the live API above — edit `eas.json` to point a build at another deployment.

---

## Technology

TypeScript monorepo throughout. **Mobile:** React Native (Expo) + Expo Push. **Web:** React + Vite. **Backend:** Node.js + Express, REST. **Database:** PostgreSQL. **Scheduling:** node-cron. **CI/CD:** GitHub Actions. Everything is designed to run on permanently free tiers.

**Object storage is not integrated.** Supabase Storage / Cloudinary are the intended providers for binary uploads, but nothing in the repo talks to either one — there is no bucket, no SDK dependency and no upload endpoint. Growth-log photos are stored as `http(s)` links to images the user already hosts (see [Known gaps](#known-gaps)).

---

## Notable engineering decisions

**Offline sync with no merge algorithm.** Only append-only log events may be queued offline — logging a watering, a workout, a meal. Each carries a client-generated UUID idempotency key and the server upserts by it, so a replay is safe. Because these events are append-only they are conflict-free by construction, which removes the need for CRDTs or last-write-wins resolution entirely. Everything else requires connectivity and says so plainly.

**Tests assert against the specification, not the implementation.** The requirements publish worked examples — `7 × 0.80 × 1.10 × 0.80 × 1.00 = 4.928 → 5 days`, `BMR 1345 × 1.375 → 1849 kcal`, `100 kg × (1 + 5/30) = 116.7`. Those exact vectors are the test cases, so a behaviour change fails against the requirement rather than against a number the code chose for itself.

**The free-tier reality is designed for, not wished away.** A sleeping instance means `node-cron` never fires and reminders silently die. That is recorded as the project's highest-impact risk with an explicit keep-alive mitigation and its residual risk stated honestly.

**A failed request never masquerades as an empty one.** Every screen keeps its error state separate from its empty state: an unreachable server produces a retryable notice, not "No plants yet". The distinction matters most on a mobile connection, which is where the app is actually used.

---

## Known gaps

Stated plainly rather than left to be discovered:

- **Photos are links, not uploads.** The growth log stores an image URL; there is no object-storage bucket, so a file picker would need a Supabase/Cloudinary/R2 account. The API validates that the link is `http(s)`.
- **No email delivery.** `DELETION_SCHEDULED`, `DELETION_CANCELLED` and `DELETION_COMPLETED` (BR-ACC-20 cl.11) are specified but no mail provider is wired, so the erasure sweep runs without sending the final message.
- **Erasure is rows only, not objects.** The FR-ACC-22 sweep erases every row in BR-ACC-20 Table H, but rule 4's object-storage queue has nothing to talk to — there is no bucket (see the photo gap above), so there are no stored objects to enqueue.
- **No password reset or email verification delivery.** Both token tables exist; there is no mail provider wired, so the UI does not offer a flow it cannot complete. New accounts are therefore active at sign-up; set `REQUIRE_EMAIL_VERIFICATION=true` on the API once mail is wired to restore the 7-day confirmation window.
- **Reminders have no retry after a failed push** — the in-app list is the delivery baseline.

---

## Licence

[MIT](LICENSE) © 2026 Rakshit
