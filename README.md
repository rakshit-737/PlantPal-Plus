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
| 3 — Implementation | 🟡 In progress — REST API (auth, plants, fitness, nutrition, dashboard, achievements, reminders, offline sync), web app, and the Expo mobile app; photo upload pipeline still open |
| 4 — Testing | 🟡 In progress — 108 tests, gated by CI |
| 5 — Documentation | ⬜ Not started |
| 6 — Deployment | ⬜ Not started |

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

npm test            # run every workspace's tests (92)
npm run typecheck   # strict TypeScript across all packages
```

### 1. The API server (required by both clients)

You will need a PostgreSQL database — a free [Neon](https://neon.tech) or [Supabase](https://supabase.com) instance is sufficient, or any local PostgreSQL 15+.

```bash
cp apps/api/.env.example apps/api/.env
# fill in DATABASE_URL and JWT_ACCESS_SECRET (32+ chars), then:

npm run migrate --workspace @plantpal/api   # apply schema migrations 001–006
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

Every push and pull request to `main` runs `npm run typecheck` and `npm test` on Node 20.11 and 22 via [GitHub Actions](.github/workflows/ci.yml).

---

## Technology

TypeScript monorepo throughout. **Mobile:** React Native (Expo) + Expo Push. **Web:** React + Vite. **Backend:** Node.js + Express, REST. **Database:** PostgreSQL. **Storage:** Supabase Storage / Cloudinary. **Scheduling:** node-cron. **CI/CD:** GitHub Actions. Everything is designed to run on permanently free tiers.

---

## Notable engineering decisions

**Offline sync with no merge algorithm.** Only append-only log events may be queued offline — logging a watering, a workout, a meal. Each carries a client-generated UUID idempotency key and the server upserts by it, so a replay is safe. Because these events are append-only they are conflict-free by construction, which removes the need for CRDTs or last-write-wins resolution entirely. Everything else requires connectivity and says so plainly.

**Tests assert against the specification, not the implementation.** The requirements publish worked examples — `7 × 0.80 × 1.10 × 0.80 × 1.00 = 4.928 → 5 days`, `BMR 1345 × 1.375 → 1849 kcal`, `100 kg × (1 + 5/30) = 116.7`. Those exact vectors are the test cases, so a behaviour change fails against the requirement rather than against a number the code chose for itself.

**The free-tier reality is designed for, not wished away.** A sleeping instance means `node-cron` never fires and reminders silently die. That is recorded as the project's highest-impact risk with an explicit keep-alive mitigation and its residual risk stated honestly.

---

## Licence

[MIT](LICENSE) © 2026 Rakshit
