# PlantPal+ — continuation prompt

Paste the block below into a fresh agent session (Antigravity, or any other IDE agent) to pick up this project with full context.

---

I'm continuing **PlantPal+**, a full SDLC software-engineering project. Repo: https://github.com/rakshit-737/PlantPal-Plus — clone it or open the local working copy at `e:\PlantPal+`.

## The product

One cross-platform app unifying three daily-habit trackers, because plant care, fitness and nutrition all share the same loop — schedule, remind, log, streak, reflect — so the loop is built once and reused:

1. **Plant Care** — plants by species, watering reminders that adapt to species + season + light + pot + environment, growth log with photo timeline
2. **Fitness** — workouts, steps, goals, streaks, progress charts
3. **Calories** — meals with calories/macros, daily targets, water intake

Shared: unified daily dashboard, one notification/scheduling engine, streaks & achievements, accounts with cloud sync.

## Fixed technology stack — do not propose alternatives

TypeScript monorepo (npm workspaces). Mobile: React Native (Expo) + Expo Push. Web: React + Vite. Backend: Node.js + Express + TypeScript, REST. DB: PostgreSQL (Neon/Supabase). Photos: Supabase Storage/Cloudinary. Scheduling: node-cron. Hosting: Render/Railway + Vercel/Netlify + Expo EAS. CI: GitHub Actions. **Everything must run on permanently free tiers.**

UI layer for Phase 2: gluestack-ui or NativeWind shared components, shadcn/ui + Tailwind on web, React Native Paper on mobile, Lucide icons, Lottie + Reanimated/Framer Motion, Recharts (web) / Victory Native (mobile).

## Phase status

| Phase | State |
|---|---|
| 1 — Requirements | ✅ Complete — 36 documents in `docs/requirements/` |
| 2 — Design | ⬜ Not started |
| 3 — Implementation | 🟡 Shared domain package + API auth foundation done |
| 4 — Testing | 🟡 86 tests passing |
| 5 — Documentation | ⬜ Not started |
| 6 — Deployment | ⬜ Not started |

Phase 1 contains **228 functional requirements, 307 business rules, 111 NFRs, 119 user stories with Gherkin criteria, 89 use cases, 119 Mermaid diagrams**, a conceptual domain model, glossary, risk register and traceability matrix.

## THE CENTRAL RULE: the requirements are the source of truth

`docs/requirements/` is not background reading — it is the specification you implement against.

- Before writing any domain logic, **find and read the business rule that governs it**. Formulas, thresholds, enumerations and multiplier tables are all written out explicitly.
- Every non-trivial function carries a comment citing the requirement ID it implements (`BR-PLT-08`, `NFR-SEC-03`, `FR-SYS-19`).
- **Tests assert against the specification's own published worked examples**, not against numbers the implementation produced. Existing examples: `7 × 0.80 × 1.10 × 0.80 × 1.00 = 4.928 → 5 days`, `BMR 1345 × 1.375 → 1849 kcal`, `100 kg × (1 + 5/30) = 116.7`, `3 × 5 × 100 = 1500 kg`.
- If the code and the spec disagree, **the spec wins** — or the spec gets an explicit, dated amendment. Do not silently diverge.

Identifier scheme: `FR-<MOD>-nn` functional, `BR-<MOD>-nn` business rule, `US-`/`UC-` story/use case, `NFR-<CAT>-nn`, plus `ASM/CON/RSK/DEP/OQ/GOAL/MET/STK/PER`. Module prefixes: `ACC` accounts, `DSH` dashboard, `SET` settings, `PLT` plants, `FIT` fitness, `NUT` nutrition, `NOT` notifications, `GAM` gamification, `SYS` platform/sync. Never renumber an existing identifier — other documents cite it.

## Locked decisions — honour these, do not relitigate

- **D-04 offline-light**: only append-only log events queue offline (water, care task, workout, steps, meal, water intake, growth entry), each with a client-generated UUID idempotency key; server upserts by that key. Append-only ⇒ conflict-free by construction ⇒ **there is deliberately no merge algorithm, no CRDT, no last-write-wins**. Everything else requires connectivity. Do not reintroduce conflict resolution.
- Seeded PostgreSQL catalogues are canonical (~60 species, ~300 foods); Open Food Facts + Perenual are optional enrichment behind feature flags. **The product must work fully with every integration disabled.**
- Minimum age **16** (`OQ-09` closed 2026-07-21; product policy, not a universal legal floor — some jurisdictions permit 13).
- Concurrent sessions capped at **10**; the eleventh evicts the least-recently-used with `revoke_reason = FAMILY_CAP_REACHED`, and the eviction is disclosed to the user.
- Auth: Argon2id (19,456 KiB, t=2, p=1), documented bcrypt-cost-12 fallback; 15-min JWT access + 30-day opaque refresh stored only as SHA-256 digests, rotated every use, family revoked on reuse.
- Mobile gets Expo Push; web gets in-app + optional email digest in v1.0 (Web Push deferred to v1.1). English-only but i18n-ready. Metric canonical storage, imperial display. **Not medical advice** — no eating-disorder-adjacent features, no shaming copy.
- Licence MIT.

## What already exists

```
packages/shared/src/domain/   rounding, enums, season, watering, nutrition, fitness  (42 tests)
apps/api/src/
  http/        errors.ts (21-code registry), errorHandler.ts (FR-SYS-19 envelope), requestId.ts
  config/      env.ts (zod-validated, refuses to boot on bad config)
  db/          pool.ts (+ transaction helper), migrate.ts, migrations/001-auth-schema.sql
  modules/auth/ password.ts, tokens.ts, authRepo.ts, authController.ts, authRoutes.ts
docs/requirements/   36 documents
```

`packages/shared` is where business rules live. **A domain calculation must exist in exactly one place** (`NFR-MAIN-03`) — the requirements demand bit-for-bit agreement between server, web and mobile. If you find yourself writing a formula inside `apps/`, it belongs in `packages/shared` instead.

## Verify before and after every change

```bash
npm install
npm test              # 86 tests must stay green
npm run typecheck     # strict TS: noUncheckedIndexedAccess, exactOptionalPropertyTypes
```

## Known gaps — these are real, please don't paper over them

1. **`authRepo.ts` (373 lines) has no integration tests.** Session-cap eviction, refresh-token reuse detection and transaction rollback are covered only by mocks. No Docker/PostgreSQL was available locally. **Highest-value next task:** point `DATABASE_URL` at a free Neon branch and write real integration tests for register / login / refresh / logout, covering reuse detection, the 10-session eviction, and login during the `PENDING_DELETION` grace window.
2. **The Phase 1 adversarial review never ran.** Structural integrity is verified (zero dangling identifiers, zero duplicate sections, all 119 diagrams lint-clean, all cross-references resolve) and the domain maths was hand-verified, but no independent pass has challenged requirement *quality* or domain realism.
3. **No CI yet.** A GitHub Actions workflow gating `npm test` + `npm run typecheck` on every push is a quick, high-value win.
4. Three defects were found and fixed in the auth login path by strict typechecking alone — most notably, users in their 30-day deletion grace window could not sign in, which is the only way to cancel deletion (`FR-ACC-02` clause 5). Treat `tsc` failures as bug reports, not annoyances.

## What I want you to do next

Pick up at **[STATE YOUR TASK HERE]**. Suggested order if you have no preference:

1. Integration tests for the auth repository against a real PostgreSQL (closes gap 1)
2. GitHub Actions CI (closes gap 3)
3. **Phase 2 Design** in `docs/design/` — Software Architecture Document (IEEE-1016/ISO-42010, C4 diagrams in Mermaid), full ER diagram + normalised SQL DDL, OpenAPI 3.1 spec, sequence diagrams for the critical flows (watering-reminder scheduling, offline queue + sync, Atwater calc, auth, photo upload), UI/UX design language and wireframes, and ADRs. Every design element must cite the FR/NFR/UC identifiers it satisfies.
4. Remaining backend modules: plants, fitness, nutrition, the node-cron reminder engine, the idempotent sync endpoint

Ask me when a decision is genuinely mine to make; otherwise proceed and tell me what you decided and why.
