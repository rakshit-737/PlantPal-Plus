# PlantPal+ testing (04_testing)

Verification of PlantPal+ against the SRS (01_requirements). Requirement-based and risk-based. The SRS is the oracle, never the code. Application code is not modified; defects are logged, not fixed.

## Contents

| Path | What |
|---|---|
| `TEST_EXECUTION_REPORT.md` | Final results, defect log, reconciliations |
| `PlantPal_Test_Workbook.xlsx` | FR register, test register, execution log (RUN-01, RUN-01B, RUN-02), defect log (48 defects), manual results (57), run summary |
| `PlantPal_Manual_Test_Checklist.xlsx` | 57 Must-priority manual cases with results and evidence file names |
| `results/` | Raw Vitest JSON for run-01, run-01b and run-02 |
| `coverage/` | v8 coverage summaries (api, shared) |
| `performance/` | `perf.mjs` and `perf-result.json` (local API latency, 7 scenarios) |
| `security/` | npm audit report and triage, security testing notes |
| `evidence/` | Screenshots and text evidence for manual rows, named `id_RESULT_date` |

The automated tests live in `03_implementation`, in files named `*.verification.test.*` (shared, web, mobile, api) and in `api/src/verification/` (harness and integration suites against a real PostgreSQL).

## Run

```
cd 03_implementation
npm install
npm run build --workspace @plantpal/shared
npm test --workspace @plantpal/shared
npm test --workspace @plantpal/web -- verification
npm test --workspace @plantpal/mobile -- verification
```

The API suites need a disposable PostgreSQL 16:

```
docker run --name pp-test -e POSTGRES_USER=plantpal -e POSTGRES_PASSWORD=plantpal -e POSTGRES_DB=plantpal_test -p 5432:5432 -d postgres:16
# PowerShell: $env:TEST_DATABASE_URL="postgresql://plantpal:plantpal@localhost:5432/plantpal_test"
# bash:       export TEST_DATABASE_URL=postgresql://plantpal:plantpal@localhost:5432/plantpal_test
npm test --workspace @plantpal/api -- verification --no-file-parallelism
npm test --workspace @plantpal/api -- expoPush
```

Without `TEST_DATABASE_URL` the integration suites skip, and a skip is not a pass. Run the API suites serially: the harness cleanup deletes all `@verify.plantpal.example` users, so parallel files break each other.

Performance (local API only, never a live site):

```
node 04_testing/performance/perf.mjs http://localhost:4000 150
```

## Expected result

849 new tests: 813 pass, 36 fail. All 36 failures are deliberate `[DEF-nnn]` tests that fail until the defect is fixed. Run only the expected-pass set with:

```
npx vitest run -t "^(?!.*DEF-)"
```

A failure without a `[DEF-` tag is a new finding or a test bug.

## Conventions

- IDs: automated `TC-module-nnn`, manual `MT-area-nnn`, defects `DEF-nnn`.
- Existing run rows are never edited; retests are new rows.
- Evidence files are named `id_RESULT_date`.
- Security cases and any scan run against a local build only.