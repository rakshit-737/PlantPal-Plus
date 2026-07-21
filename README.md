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
| 2 — Design | ⬜ Not started |
| 3 — Implementation | 🟡 In progress — shared domain package and API foundation |
| 4 — Testing | 🟡 In progress — 86 tests |
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
docs/requirements/   Phase 1 requirements package
```

The shared package exists so a business rule lives in exactly one place. The watering algorithm, the Atwater energy identity and the Mifflin-St Jeor equation are each implemented once and consumed identically by the server, the website and the mobile app — the requirements demand bit-for-bit agreement between them.

---

## Getting started

Requires **Node.js 20.11+**.

```bash
git clone https://github.com/rakshit-737/PlantPal-Plus.git
cd PlantPal-Plus
npm install

npm test            # run every workspace's tests
npm run typecheck   # strict TypeScript across all packages
```

To run the API you will need a PostgreSQL database (a free [Neon](https://neon.tech) branch is sufficient):

```bash
cp apps/api/.env.example apps/api/.env
# fill in DATABASE_URL and JWT_ACCESS_SECRET, then:
npm run dev --workspace @plantpal/api
```

The API refuses to start on missing or invalid configuration rather than failing later at the first request that needs it.

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
