# Changelog

Notable changes to PlantPal+, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

PlantPal+ is deployed continuously from `main` and has no numbered releases yet, so changes are grouped by the date they reached `main`, with the pull requests that carried them.

## [Unreleased]

### Changed

- The repository is organised by project phase, one numbered folder each: `01_requirements`, `02_design`, `03_implementation`, `04_testing`, `05_documentation` and `06_deployment` ([ADR 0005](../02_design/architecture/adrs/0005-organise-the-repository-by-project-phase.md)). Every numbered folder has a README.
- `03_implementation` is the npm workspace root: `package.json`, the lockfile, `vercel.json` and the TypeScript, ESLint, Prettier and Node version files moved there, and npm commands run from that folder. The workspaces are `api`, `web`, `mobile` and `shared`. No dependency versions changed.
- The contributing guide, code of conduct and security policy moved into `.github/`; the changelog and third-party licences into `05_documentation/`; the Render blueprint into `06_deployment/`.
- The Vercel project builds from `03_implementation` (its Root Directory setting), where a `.vercelignore` keeps the API's source out of the website deployment. The CI and GitHub Pages workflows run npm there too.
- The committed API bundle is `06_deployment/api/index.js`, so the edge loader imports that path from the next API deploy on.
- Every link and path in the documentation, comments and configuration points at the new folders.

## 2026-10-02 — Repository organisation (#9)

### Added

- A contributing guide, code of conduct, security policy and this changelog.
- Issue forms for bug reports and feature requests, a pull-request template and code owners.
- A README for every workspace, a documentation index, a testing guide and a guide to the ER diagrams.
- ADR 0004, recording why the API runs on Supabase Edge Functions and the website on Vercel.
- Screenshots of the app and the project logo in `docs/assets/`.
- `.editorconfig`, `.nvmrc` and a Prettier configuration that records the house style.
- A `lint` job in CI. `npm run lint` now fails on warnings as well as errors (NFR-MAIN-02).

### Changed

- The README is rewritten as the project's landing page.
- The design language (v4.0 "Conservatory"), the component inventory and the navigation flow now describe the interface as built.
- The system architecture adds the deployed topology, and the API reference documents the base URLs, the readiness probe and the verification flag returned at sign-up.
- The CI and GitHub Pages workflows use `actions/checkout` and `actions/setup-node` v5, which run on Node 24, clearing the Node 20 deprecation warnings.
- `.gitignore` keeps per-developer Claude Code settings (`settings.local.json`) out of the repository and drops a duplicate entry.

### Removed

- Internal working notes: an agent hand-off note, an AI design prompt and two superseded deployment runbooks. They remain in the git history.
- A duplicate `apps/web/vercel.json`. The Vercel project builds from the root `vercel.json`.

### Fixed

- The nutrition diary showed floating-point residue in the day's totals, such as a fat total of 27.299999999999997 g. The API now rounds each sum to the one decimal place it is stored with.
- Three `no-useless-assignment` lint findings in the API.
- Code comments and ADR 0003 cite NFR-MAIN-04 for the single-implementation rule; they named NFR-MAIN-03, the test-coverage requirement.
- The eraser.io ER diagram states the current table and foreign-key counts.

## 2026-10-02 — "Conservatory" redesign and production hardening (#6, #7, #8)

### Added

- Design language v4.0 "Conservatory": a contrast-measured palette, Fraunces with Geist, glass panes, progress rings and a fuller motion scale, applied to every page of the website.
- A glass sidebar on wide screens, a tab dock on phones, grouped navigation with new icons, route transitions, a brand mark, a theme toggle and plant avatars.
- `/readyz`, a readiness probe that checks the database, and a workflow that calls it every six hours.
- Integration tests for a new account's first day: adding and watering a plant, logging workouts and the overall streak.
- An energy estimate on every timed workout, including workouts logged offline.
- `REQUIRE_EMAIL_VERIFICATION`, off until a mail provider is wired.

### Changed

- The website is served by Vercel, which forwards `/api/*` to the API so the refresh cookie stays first-party. The old Supabase web address redirects there permanently.
- The scheduler's `/internal/tick` secret is read from Supabase Vault and compared in constant time.
- Argon2id runs on the edge through a WebAssembly build where the native module cannot load.
- Mobile preview and production builds point at the live API, and the mobile palette mirrors v4.0.

### Fixed

- Logging a watering failed on the type of the interval parameter.
- The overall streak counted modules the user had switched off.
- New accounts waited on a verification email that could never arrive; they are active at sign-up while no mail provider is wired.
- Page loads from a shared network could exhaust the sign-in rate limit and sign out everyone behind that address. Session endpoints now have their own budget.
- Cancelling an account deletion ignored the verification switch.
- Input that PostgreSQL rejects answers 422 or 409 instead of 500.
- Two migration runners starting together could collide. Migrations now hold an advisory lock.
- The landing page header, hero, code sample and streak tiles at phone width.

## 2026-10-01 — Vercel deployment path (#5)

### Fixed

- The Vercel rewrite pointed at an API host that did not exist, and the refresh cookie's path did not match the rewritten URL, so sessions would have ended silently after fifteen minutes. The cookie is scoped to `/`, and configured origins add to the trusted list instead of replacing it.
- The landing-page headline rotator, and the landing page and dashboard now use the full width of the screen.

## 2026-09-04 — Account erasure and the edge deployment (#3, #4)

### Added

- The FR-ACC-22 erasure sweep. Accounts past their 30-day deletion window are erased, each in its own transaction, leaving an anonymised audit tombstone.
- The API runs on Supabase Edge Functions: a Deno entry point, a single-file bundle, and reminders and the erasure sweep driven by `pg_cron`.

### Changed

- The database SSL options, the refresh-cookie path and the mount prefix are configuration instead of being hard-coded.

### Fixed

- Validated configuration was returned but never installed.
- Deno is detected by its own global, and structured logs reach non-Node runtimes.

## 2026-08-31 — "Glasshouse" interface (#2)

### Added

- Design language v3.0 "Glasshouse": glass panes, layered elevation, an ambient background and layout animation, rolled out across the UI primitives, the app shell, the landing and sign-in pages and the dashboard.
- `--color-border-control`, so interactive edges reach 3:1 contrast.
- Route-level code splitting and loading skeletons.

## 2026-08-09 — Database moved to Supabase

### Changed

- The database moved from Neon to Supabase Postgres.

## 2026-08-07 — Dependency and deployment hardening (#1)

### Added

- An ESLint configuration (typescript-eslint and React Hooks), with every finding fixed.
- Tests for the reminder service.

### Fixed

- Vercel builds of the monorepo: development dependencies are installed, test-only types stay out of the production build, and the mobile test configuration loads as an ES module on Node 20.11.
- The GitHub Pages workflow refuses to deploy without an API URL instead of publishing a site that cannot sign in.

### Security

- Dependency upgrades that clear the critical and fixable high audit findings, including Vitest 4 and React Router 7.

## 2026-07-31 — Account lifecycle, growth log and offline outbox

### Added

- Account deletion with a 30-day reversible grace window, behind a password step-up.
- A growth log for each plant, with a photo timeline and a height trend.
- Custom foods, quiet hours for reminders and a two-step onboarding flow.
- The mobile offline outbox: waterings, workouts, meals and water intake are queued durably and sent in order when the connection returns.
- Toasts, an error state with retry on every page, accessible select and combobox controls, focus-trapped modals, a skip link, per-page titles and working reduce-motion, larger-text and high-contrast settings.
- The "field notebook" theme on mobile, and a plant detail screen.

### Fixed

- Scheduling a deletion rejected every existing session at once instead of at the end of the grace window.

## 2026-07-29 — Catalogues, settings and plant detail

### Added

- An Indian plant and food catalogue, 94 species and 180 foods, browsable and searchable. Choosing a species fills in its care defaults.
- The settings module: theme, units, locale, time zone, module switches, quiet hours, a notification cap and accessibility flags. The last enabled module cannot be switched off.
- A plant detail page with the watering countdown, seven care actions and the care history.
- The "field notebook" redesign of the website (design language v2.0), a bottom tab bar on phones and the API reference.

### Fixed

- `npm run dev` for the API under Node's TypeScript type stripping.

## 2026-07-27 — Audit fixes and the first deployment

### Added

- Deployment: the GitHub Pages workflow, a Render blueprint, EAS build profiles and PostgreSQL in CI.
- An authentication integration suite against a real PostgreSQL.

### Fixed

- The reminder pipeline: a conflict clause that stopped every run, repeated notifications and lifecycle gaps.
- Offline replays of pending events reported success without being processed.
- Race conditions in the engagement loop, rate limiting, numeric casts in fitness, client dates and identity restore.
- The migrate and seed commands on Windows.

### Security

- An SQL injection in plant updates, where column names were taken from request keys.
- Refresh-token reuse detection, which did not work, and four further authentication findings: lockout, token-family forks, the family cap and a timing oracle.

## 2026-07-25 — Mobile app, sync, reminders and engagement

### Added

- The Expo mobile app: sign-in, the five core screens, an add-plant flow and push-reminder registration.
- The idempotent offline sync endpoint (FR-SYS-02, FR-SYS-03).
- The reminder engine for watering schedules, and push delivery through Expo (FR-NOT-14, FR-NOT-15).
- Streaks that advance and achievements that unlock when you log (BR-GAM-07).
- The rest of Phase 2: sequence diagrams, ADRs and the OpenAPI specification.

## 2026-07-23 — Core API and web pages

### Added

- API modules for plants, fitness, nutrition and the dashboard, with their web pages and the first UI primitives.

## 2026-07-22 — Phase 2 design and the web scaffold

### Added

- The Phase 2 architecture and design package.
- The web app scaffold: sign-in, the dashboard shell and the design system.
- CI that runs the tests and type-checks on every push and pull request.

## 2026-07-21 — Phase 1 requirements and the foundation

### Added

- The Phase 1 requirements package: the SRS, 228 functional requirements, 307 business rules, 111 non-functional requirements, 119 user stories and 89 use cases.
- The monorepo foundation, and the API's authentication module with its database schema.
