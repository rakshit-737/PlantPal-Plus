# Contributing to PlantPal+

Thanks for helping improve PlantPal+. This guide covers setting the project up, how a change is made, and what a pull request needs before it is merged.

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Security problems are reported privately as described in [SECURITY.md](SECURITY.md), never in a public issue.

## Ways to contribute

- **Report a bug.** [Open a bug report](https://github.com/rakshit-737/PlantPal-Plus/issues/new?template=bug_report.yml) with the steps that reproduce it.
- **Suggest a feature.** [Open a feature request](https://github.com/rakshit-737/PlantPal-Plus/issues/new?template=feature_request.yml). Check the [requirements](../01_requirements/) first: many features are already specified and assigned to a release.
- **Improve the documentation.** Typo fixes and clarifications need no issue first.
- **Fix or build something.** Comment on the issue first so work is not duplicated, and for anything bigger than a small fix, agree on the approach there before writing code.

## Setting up

You need **Node.js 20.11 or newer** (22 recommended; `nvm use` reads [`.nvmrc`](../03_implementation/.nvmrc)), npm, and **PostgreSQL 15 or newer** to run the API and its integration tests.

```bash
git clone https://github.com/rakshit-737/PlantPal-Plus.git
cd PlantPal-Plus/03_implementation   # the npm workspace root: run every npm command here
npm install                          # installs every workspace and builds shared/
```

Then follow [Getting started](../README.md#getting-started) to run the API, the website and the mobile app.

The repository is organised by project phase:

| Folder | What it holds | Guide |
| --- | --- | --- |
| `01_requirements` | The SRS, module specifications, user stories and use cases | [README](../01_requirements/README.md) |
| `02_design` | Architecture, ADRs, the OpenAPI contract, UI design and ER diagrams | [README](../02_design/README.md) |
| `03_implementation` | The npm workspace: `api` (Express REST API, also bundled for Supabase Edge Functions), `web` (React + Vite website), `mobile` (React Native app with an offline outbox) and `shared` (domain rules used by all three) | [README](../03_implementation/README.md) |
| `04_testing` | The testing guide; the tests themselves sit next to the code they test | [README](../04_testing/README.md) |
| `05_documentation` | The documentation index, API reference, changelog and screenshots | [README](../05_documentation/README.md) |
| `06_deployment` | The API bundle, the scheduler SQL, the Render blueprint and the deployment guide | [README](../06_deployment/README.md) |

## Making a change

1. **Branch from `main`** with a descriptive name: `feat/plant-photos`, `fix/streak-timezone`, `docs/api-examples`.
2. **Keep it focused.** One concern per pull request; refactors that are not needed for the change go in their own.
3. **Test the behaviour you changed.** New behaviour gets new tests; a bug fix gets a test that failed before the fix.
4. **Run the checks** that CI runs, from `03_implementation`:

   ```bash
   npm run typecheck   # strict TypeScript, every workspace
   npm run lint        # ESLint, zero warnings allowed (needs Node 20.19 or newer)
   npm test            # set TEST_DATABASE_URL to include the PostgreSQL suites
   ```

5. **Update the documentation** that describes what you changed, and add a line under **Unreleased** in the [changelog](../05_documentation/CHANGELOG.md) for anything a user or an API client would notice.
6. **Open a pull request** against `main` and fill in the template. CI must pass before it is merged.

## Conventions

### Commit messages

Commits follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) (NFR-MAIN-06): `type(scope): summary`, with the summary in the imperative mood and no full stop.

```text
fix(auth): revoke the whole token family on refresh-token reuse
feat(plants): growth log with a photo timeline
docs(api): document the readiness probe
```

- **Type** is one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore` or `revert`.
- **Scope** is the workspace or module the change is about, such as `api`, `web`, `mobile`, `shared`, `auth`, `plants`, `fitness`, `nutrition`, `sync` or `deploy`.
- **Breaking changes** add `!` after the type or scope and a `BREAKING CHANGE:` footer that says what to do about it.

Pull requests are squash-merged, so the **pull-request title becomes the commit message** on `main` and follows the same format.

### Code

- **Strict TypeScript everywhere.** `any` is a lint error; use `unknown` and narrow it.
- **Formatting** follows [`.prettierrc.json`](../03_implementation/.prettierrc.json): no semicolons, single quotes, 100 columns. Format the files you touch (`npx prettier --write <files>`), and leave unrelated files alone so the diff stays reviewable.
- **One home for each business rule.** Domain calculations live once in `03_implementation/shared` (NFR-MAIN-04), and the API and both clients import them rather than re-implementing them.
- **Cite the requirement.** Comments and test names reference the identifier a piece of code implements: `FR-` functional requirements, `BR-` business rules, `NFR-` non-functional requirements.
- **One error envelope.** API failures use the shared envelope, and bad input answers 422, never 500. See the [API conventions](../03_implementation/api/README.md#conventions).
- **Design tokens only.** The web UI uses the tokens from the [design language](../02_design/ui_design/01-design-language.md), with no hard-coded colours, and must keep passing the contrast tests. Check UI changes in light and dark themes and with reduced motion.
- **A failed request is never an empty state.** Screens show a retryable error, never "nothing here yet".

### Tests

- Where the requirements publish a worked example, that example is the test case.
- Code that runs SQL also gets an integration test (`*.integration.test.ts`) against a real PostgreSQL.
- The [testing guide](../04_testing/README.md) explains the suites and how to run each one.

### Database, API and architecture changes

- **Schema.** Add a new numbered migration in `03_implementation/api/src/db/migrations/` (the next is `008-…sql`) and never edit one that has shipped: the runner records applied versions and will not run a file twice. Update the [database schema](../02_design/architecture/02-database-schema.md) to match.
- **Endpoints.** Update [`openapi.yaml`](../02_design/architecture/openapi.yaml) and the [API reference](../05_documentation/api-reference.md) in the same pull request.
- **Decisions.** A choice that would be expensive to reverse gets an architecture decision record in [`02_design/architecture/adrs/`](../02_design/architecture/adrs/), following the shape of the existing ones.

## After the merge

Merging to `main` redeploys the website on Vercel and the GitHub Pages mirror automatically. The API on Supabase Edge Functions is redeployed deliberately, from a rebuilt bundle; the [deployment guide](../06_deployment/README.md) describes the steps.

## License

By contributing, you agree that your contributions are licensed under the project's [MIT License](../LICENSE).
