# PlantPal+ Documentation

PlantPal+ was built as a full software-engineering project, phase by phase, and the repository is organised the same way: one numbered folder per phase, from requirements to deployment. Documents, code and tests cite the requirement identifiers they relate to.

| Folder | Phase |
| --- | --- |
| [`01_requirements/`](../01_requirements/) | 1 — Requirements |
| [`02_design/`](../02_design/) | 2 — Architecture and design |
| [`03_implementation/`](../03_implementation/) | 3 — Implementation: the code |
| [`04_testing/`](../04_testing/) | 4 — Testing |
| `05_documentation/` (this folder) | 5 — Documentation |
| [`06_deployment/`](../06_deployment/) | 6 — Deployment |

## Start here

| I want to… | Read |
| --- | --- |
| Understand what the product does and why | [Software Requirements Specification](../01_requirements/SRS.md), or the guided [requirements reading path](../01_requirements/README.md) |
| Run the project on my machine | [Getting started](../README.md#getting-started) in the root README |
| Call the API | [API reference](api-reference.md), then the [OpenAPI 3.1 spec](../02_design/architecture/openapi.yaml) for schemas |
| Understand how it is built | [System architecture](../02_design/architecture/01-system-architecture.md) and the [architecture decisions](#architecture-decision-records) |
| Work on the UI | [Design language](../02_design/ui_design/01-design-language.md) and [component inventory](../02_design/ui_design/02-component-inventory.md) |
| Run or write tests | [Testing guide](../04_testing/README.md) |
| Deploy it | [Deployment guide](../06_deployment/README.md) |
| Contribute | [Contributing guide](../.github/CONTRIBUTING.md) |

## Phase 1 — Requirements

[`01_requirements/`](../01_requirements/), baselined 2026-07-21: 228 functional requirements, 307 business rules, 111 non-functional requirements, 119 user stories and 89 use cases.

| Document | Contents |
| --- | --- |
| [SRS.md](../01_requirements/SRS.md) | The root Software Requirements Specification |
| [01 — Stakeholders and personas](../01_requirements/01-stakeholders-and-personas.md) | Stakeholders, personas, goals and positioning |
| [02 — Scope and release plan](../01_requirements/02-scope-and-release-plan.md) | What is in and out of scope, and when |
| [03 — Functional requirements](../01_requirements/03-functional-requirements.md) | Master index; detail per module in [`modules/`](../01_requirements/modules/) |
| [04 — Non-functional requirements](../01_requirements/04-non-functional-requirements.md) | Quality attributes and their measures |
| [05 — User stories](../01_requirements/05-user-stories.md) | Epics and the story index; Gherkin criteria in [`user-stories/`](../01_requirements/user-stories/) |
| [06 — Use-case model](../01_requirements/06-use-case-model.md) | Consolidated model; full specifications in [`use-cases/`](../01_requirements/use-cases/) |
| [07 — Domain model](../01_requirements/07-domain-model.md) | Conceptual entities and relationships |
| [08 — Glossary](../01_requirements/08-glossary.md) | Terms used throughout |
| [09 — Assumptions, constraints and risks](../01_requirements/09-assumptions-constraints-risks.md) | Including open questions |
| [10 — Traceability matrix](../01_requirements/10-traceability-matrix.md) | Method, coverage summary and goal-to-requirement balance. The generated per-requirement tables (sections 3.1–3.2 and 4 onwards) are not yet filled in; each module specification's §10 carries its own trace links meanwhile. |

The eight modules each have a requirements file, a use-case file and a user-story file: accounts, plant care, fitness, nutrition, gamification, notifications, dashboard and settings, and platform and sync.

## Phase 2 — Architecture and design

[`02_design/`](../02_design/) holds three groups of documents.

### Architecture — [`02_design/architecture/`](../02_design/architecture/)

| Document | Contents |
| --- | --- |
| [01 — System architecture](../02_design/architecture/01-system-architecture.md) | C4 context, container and component views; offline sync; the reminder engine; the deployed topology |
| [02 — Database schema](../02_design/architecture/02-database-schema.md) | Tables, keys and constraints |
| [03 — API specification](../02_design/architecture/03-api-specification.md) | REST conventions, auth model and resources |
| [04 — Sequence diagrams](../02_design/architecture/04-sequence-diagrams.md) | The core flows, step by step |
| [openapi.yaml](../02_design/architecture/openapi.yaml) | Machine-readable OpenAPI 3.1 contract |

#### Architecture decision records

| ADR | Decision |
| --- | --- |
| [0001](../02_design/architecture/adrs/0001-use-first-party-auth.md) | First-party authentication instead of Supabase Auth |
| [0002](../02_design/architecture/adrs/0002-offline-light-append-only-sync.md) | Offline-light, append-only sync |
| [0003](../02_design/architecture/adrs/0003-use-npm-workspaces.md) | A TypeScript monorepo with npm workspaces |
| [0004](../02_design/architecture/adrs/0004-host-api-on-supabase-edge-and-web-on-vercel.md) | The API on Supabase Edge Functions, the web app on Vercel |
| [0005](../02_design/architecture/adrs/0005-organise-the-repository-by-project-phase.md) | One numbered folder per project phase, with the npm workspace in `03_implementation` |

### UI design — [`02_design/ui_design/`](../02_design/ui_design/)

| Document | Contents |
| --- | --- |
| [01 — Design language](../02_design/ui_design/01-design-language.md) | v4.0 "Conservatory": colour, type, shape, elevation, motion and the accessibility contract |
| [02 — Component inventory](../02_design/ui_design/02-component-inventory.md) | Every UI primitive, its props and its usage rules |
| [03 — Screen wireframes](../02_design/ui_design/03-screen-wireframes.md) | The Phase 2 low-fidelity layouts |
| [04 — Navigation flow](../02_design/ui_design/04-navigation-flow.md) | Routes and navigation as built |

### Diagrams — [`02_design/diagrams/`](../02_design/diagrams/)

Entity-relationship diagrams of the database in three notations (StarUML, Chen, eraser.io). See the [diagrams README](../02_design/diagrams/README.md).

## Phase 3 — Implementation

[`03_implementation/`](../03_implementation/) is the npm workspace root. Its [README](../03_implementation/README.md) covers the commands, and each workspace has its own guide:

| Workspace | Guide |
| --- | --- |
| `api` — Express REST API over PostgreSQL | [README](../03_implementation/api/README.md) |
| `web` — React + Vite website | [README](../03_implementation/web/README.md) |
| `mobile` — React Native (Expo) app | [README](../03_implementation/mobile/README.md) |
| `shared` — domain rules used by every app | [README](../03_implementation/shared/README.md) |

## Phase 4 — Testing

The [testing guide](../04_testing/README.md) describes the test suites, how to run them, and how they are written. The tests themselves sit next to the code they test.

## Phase 5 — Documentation

This folder.

| Document | Contents |
| --- | --- |
| [API reference](api-reference.md) | Every endpoint, its auth and its rules, in one page |
| [Changelog](CHANGELOG.md) | Notable changes, newest first |
| [Third-party licences](THIRD_PARTY_LICENSES.md) | The licence record for any third-party UI code, and the audit of the component catalogues consulted |
| [`assets/`](assets/) | The logo and the screenshots used in the README |

## Phase 6 — Deployment

The [deployment guide](../06_deployment/README.md) covers Vercel, Supabase Edge Functions, the scheduled work and configuration. [`06_deployment/`](../06_deployment/) also holds the committed API bundle, the scheduler SQL and the Render blueprint.

## Conventions

- **Identifiers.** `FR-` functional requirement, `BR-` business rule, `NFR-` non-functional requirement, `US-` user story, `UC-` use case, `D-` decision, `RSK-` risk. Code comments and tests cite them, so a rule can be followed from requirement to implementation.
- **Versioned documents.** Design and architecture documents carry a version table, and a document that changes direction records what changed and why rather than silently rewriting history.
- **Decisions are ADRs.** A choice that is expensive to reverse gets a numbered record in [`02_design/architecture/adrs/`](../02_design/architecture/adrs/).
- **Screenshots** of the app as built live in [`assets/screenshots/`](assets/screenshots/).
