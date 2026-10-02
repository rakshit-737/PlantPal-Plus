# ADR 0005: Organise the Repository by Project Phase

## Status
Accepted (2026-10). Changes the folder layout described in [ADR 0003](0003-use-npm-workspaces.md); the decision there, one TypeScript monorepo on npm workspaces, stands.

## Context
PlantPal+ was built as a software-engineering project in six phases: requirements, design, implementation, testing, documentation and deployment. The repository did not show that. The code followed the usual JavaScript monorepo layout (`apps/` and `packages/`), every document from the Phase 1 specification to the API reference sat in one `docs/` folder, deployment artefacts sat in `deploy/`, and the root held fourteen configuration and policy files beside the README.

A reader opening the repository had to know the JavaScript conventions to find the code and had to open `docs/` to find out which phase a document belonged to. The owner's other research projects use numbered top-level folders, one per stage, which reads in order and leaves the root almost empty.

## Decision
- **One numbered folder per phase**, in snake_case:

  | Folder | Phase | Was |
  | --- | --- | --- |
  | `01_requirements/` | Requirements | `docs/requirements/` |
  | `02_design/` | Architecture and design | `docs/architecture/` → `architecture/`, `docs/design/` → `ui_design/`, `docs/diagrams/` → `diagrams/` |
  | `03_implementation/` | Implementation | `apps/api`, `apps/web`, `apps/mobile`, `packages/shared` → `api/`, `web/`, `mobile/`, `shared/` |
  | `04_testing/` | Testing | `docs/testing.md` → `README.md` |
  | `05_documentation/` | Documentation | `docs/README.md`, `docs/api-reference.md`, `docs/assets/`, `CHANGELOG.md`, `THIRD_PARTY_LICENSES.md` |
  | `06_deployment/` | Deployment | `deploy/` (with `deploy/web/` renamed `web_redirect/`), `render.yaml` |

- **`03_implementation/` is the npm workspace root.** `package.json`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.nvmrc` and `vercel.json` move there, because they exist only to build the code. The workspaces sit one level below it, so every relative path between them is unchanged.
- **Community files move into `.github/`.** GitHub finds `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` and `SECURITY.md` there as readily as at the root.
- **The root keeps only what has to be there:** `README.md` and `LICENSE` (the repository's front page and its licence detection), `.gitignore` and `.gitattributes` (read by git from the root), `.editorconfig` (so editors apply it to every folder) and `.github/`.
- **File names do not change.** Only folders move, so every file's history follows it.

## Consequences
**Positive:**
- The top level reads as the project's lifecycle, in order, with a README in every numbered folder.
- The root holds two documents and three dotfiles instead of nineteen entries.
- Package names, commands and imports are unchanged: `npm run dev --workspace @plantpal/api` still works, from `03_implementation`.

**Negative:**
- Every npm command runs from `03_implementation`, and `node_modules` lives there.
- The Vercel project's Root Directory must be `03_implementation`; a project reset to the repository root fails at install.
- A Render Blueprint needs its Blueprint path set to `06_deployment/render.yaml`.
- The committed API bundle moves to `06_deployment/api/index.js`, so the edge loader's import path changes with the next API deploy. Functions pinned to earlier commits keep loading the old path, which still exists at those commits.
- ESLint runs inside `03_implementation`, so the small Deno redirect function in `06_deployment/web_redirect/` is no longer linted.
- JavaScript tooling conventionally expects `apps/` and `packages/`; nothing here requires those names, but readers who know the convention will look for them first.
