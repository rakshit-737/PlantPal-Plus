# Testing

PlantPal+ has **466 automated tests** across the four workspaces, all run with [Vitest](https://vitest.dev). Every push and pull request to `main` runs them in CI, together with strict type-checking and ESLint.

| Workspace | Tests | What they cover |
| --- | ---: | --- |
| `packages/shared` | 53 | The domain algorithms — watering intervals, energy and nutrition maths, one-rep max, streaks — checked against the worked examples published in the requirements. |
| `apps/api` | 239 | Controllers, services, error handling, configuration, the reminder engine, offline sync, account erasure, password hashing — plus 18 integration tests against a real PostgreSQL. |
| `apps/mobile` | 24 | The durable offline outbox: queueing, ordering, retries, idempotency keys. |
| `apps/web` | 150 | Components and pages under jsdom, the API client, design-token contrast and mobile parity, code splitting, and the facts quoted on the landing page. |

## Running the tests

```bash
npm install          # once, at the repository root
npm test             # every workspace
npm run typecheck    # strict TypeScript, every workspace
npm run lint         # ESLint across the repository
```

One workspace at a time:

```bash
npm test --workspace @plantpal/shared
npm test --workspace @plantpal/api
npm test --workspace @plantpal/web
npm test --workspace @plantpal/mobile
```

### Integration tests (real PostgreSQL)

Two suites run against a real database and **skip themselves** unless `TEST_DATABASE_URL` is set:

- `apps/api/src/modules/auth/authRepo.integration.test.ts` — the real login path: session-cap eviction, refresh-token rotation and reuse detection, the deletion grace window.
- `apps/api/src/core-flows.integration.test.ts` — a new account's first day: add and water a plant, log workouts (including the energy estimate and a rejected bad intensity), a malformed id answering 422, and the overall streak with a module switched off.

They apply the migrations (and, where a test needs them, the seed catalogues) themselves, and each test cleans up the users it creates. Use a disposable database — never production:

```bash
createdb plantpal_test
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/plantpal_test npm test --workspace @plantpal/api
```

The migration runner holds an advisory lock, so several suites can start against a fresh database at once.

## How the tests are written

**The specification is the oracle.** The requirements publish worked examples — `7 × 0.80 × 1.10 × 0.80 × 1.00 = 4.928 → 5 days`, `BMR 1345 × 1.375 → 1849 kcal`, `100 kg × (1 + 5/30) = 116.7 kg`, `RUN at MODERATE for 45 min at 72 kg = 529.2 kcal`. Those exact vectors are the test cases, so a behaviour change fails against the requirement rather than against a number the code chose for itself.

**Database-backed code is tested against a database.** Unit suites mock repositories, so they cannot see a query PostgreSQL itself rejects — one such bug (a parameter typed two ways) once made every watering fail in production. The integration suites run the real SQL.

**Accessibility and design rules are tests too.** `apps/web/src/test/tokens.test.ts` measures WCAG contrast for every sanctioned colour pair in both themes and in high-contrast mode, checks the cascade order that makes dark mode work, and fails if the mobile palette drifts from the web one.

**Failure is a state, not an absence.** Page tests assert that a failed request renders a retryable error and never an empty state.

## Continuous integration

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs two jobs on every push to `main` and every pull request:

- **verify** — on Node 20.11 (the supported minimum) and Node 22, with a PostgreSQL 16 service container so the integration suites run on every change. It builds the shared package, type-checks every workspace and runs every test.
- **lint** — ESLint across the monorepo, on Node 22 (ESLint 10 needs Node 20.19 or newer).

The deployment workflows add their own gates: the GitHub Pages build type-checks and runs the web tests before publishing, and refuses to ship if the API it points at does not answer `/healthz`.
