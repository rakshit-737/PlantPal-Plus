# PlantPal+ Documentation

PlantPal+ was built as a full software-engineering project, phase by phase, and its documentation follows the same order: requirements, then architecture and design, then the material that describes the running system. Documents, code and tests cite the requirement identifiers they relate to.

## Start here

| I want to… | Read |
| --- | --- |
| Understand what the product does and why | [Software Requirements Specification](requirements/SRS.md), or the guided [requirements reading path](requirements/README.md) |
| Run the project on my machine | [Getting started](../README.md#getting-started) in the root README |
| Call the API | [API reference](api-reference.md), then the [OpenAPI 3.1 spec](architecture/openapi.yaml) for schemas |
| Understand how it is built | [System architecture](architecture/01-system-architecture.md) and the [architecture decisions](#architecture-decision-records) |
| Work on the UI | [Design language](design/01-design-language.md) and [component inventory](design/02-component-inventory.md) |
| Run or write tests | [Testing guide](testing.md) |
| Deploy it | [Deployment guide](../deploy/README.md) |
| Contribute | [Contributing guide](../CONTRIBUTING.md) |

## Phase 1 — Requirements

[`requirements/`](requirements/) — baselined 2026-07-21. 228 functional requirements, 307 business rules, 111 non-functional requirements, 119 user stories and 89 use cases.

| Document | Contents |
| --- | --- |
| [SRS.md](requirements/SRS.md) | The root Software Requirements Specification |
| [01 — Stakeholders and personas](requirements/01-stakeholders-and-personas.md) | Stakeholders, personas, goals and positioning |
| [02 — Scope and release plan](requirements/02-scope-and-release-plan.md) | What is in and out of scope, and when |
| [03 — Functional requirements](requirements/03-functional-requirements.md) | Master index; detail per module in [`modules/`](requirements/modules/) |
| [04 — Non-functional requirements](requirements/04-non-functional-requirements.md) | Quality attributes and their measures |
| [05 — User stories](requirements/05-user-stories.md) | Epics and the story index; Gherkin criteria in [`user-stories/`](requirements/user-stories/) |
| [06 — Use-case model](requirements/06-use-case-model.md) | Consolidated model; full specifications in [`use-cases/`](requirements/use-cases/) |
| [07 — Domain model](requirements/07-domain-model.md) | Conceptual entities and relationships |
| [08 — Glossary](requirements/08-glossary.md) | Terms used throughout |
| [09 — Assumptions, constraints and risks](requirements/09-assumptions-constraints-risks.md) | Including open questions |
| [10 — Traceability matrix](requirements/10-traceability-matrix.md) | Method, coverage summary and goal-to-requirement balance. The generated per-requirement tables (sections 3.1–3.2 and 4 onwards) are not yet filled in; each module specification's §10 carries its own trace links meanwhile. |

The eight modules each have a requirements file, a use-case file and a user-story file: accounts, plant care, fitness, nutrition, gamification, notifications, dashboard and settings, and platform and sync.

## Phase 2 — Architecture and design

### Architecture — [`architecture/`](architecture/)

| Document | Contents |
| --- | --- |
| [01 — System architecture](architecture/01-system-architecture.md) | C4 context, container and component views; offline sync; the reminder engine; the deployed topology |
| [02 — Database schema](architecture/02-database-schema.md) | Tables, keys and constraints |
| [03 — API specification](architecture/03-api-specification.md) | REST conventions, auth model and resources |
| [04 — Sequence diagrams](architecture/04-sequence-diagrams.md) | The core flows, step by step |
| [openapi.yaml](architecture/openapi.yaml) | Machine-readable OpenAPI 3.1 contract |

#### Architecture decision records

| ADR | Decision |
| --- | --- |
| [0001](architecture/adrs/0001-use-first-party-auth.md) | First-party authentication instead of Supabase Auth |
| [0002](architecture/adrs/0002-offline-light-append-only-sync.md) | Offline-light, append-only sync |
| [0003](architecture/adrs/0003-use-npm-workspaces.md) | A TypeScript monorepo with npm workspaces |
| [0004](architecture/adrs/0004-host-api-on-supabase-edge-and-web-on-vercel.md) | The API on Supabase Edge Functions, the web app on Vercel |

### Design — [`design/`](design/)

| Document | Contents |
| --- | --- |
| [01 — Design language](design/01-design-language.md) | v4.0 "Conservatory": colour, type, shape, elevation, motion and the accessibility contract |
| [02 — Component inventory](design/02-component-inventory.md) | Every UI primitive, its props and its usage rules |
| [03 — Screen wireframes](design/03-screen-wireframes.md) | The Phase 2 low-fidelity layouts |
| [04 — Navigation flow](design/04-navigation-flow.md) | Routes and navigation as built |

### Diagrams — [`diagrams/`](diagrams/)

Entity-relationship diagrams of the database in three notations (StarUML, Chen, eraser.io). See the [diagrams README](diagrams/README.md).

## Phases 3–6 — The running system

| Document | Contents |
| --- | --- |
| [API reference](api-reference.md) | Every endpoint, its auth and its rules, in one page |
| [Testing guide](testing.md) | Test suites, how to run them, and how they are written |
| [Deployment guide](../deploy/README.md) | Vercel, Supabase Edge Functions, scheduled work, configuration |
| Workspace READMEs | [`apps/api`](../apps/api/README.md) · [`apps/web`](../apps/web/README.md) · [`apps/mobile`](../apps/mobile/README.md) · [`packages/shared`](../packages/shared/README.md) |
| [Changelog](../CHANGELOG.md) | Notable changes, newest first |

## Conventions

- **Identifiers.** `FR-` functional requirement, `BR-` business rule, `NFR-` non-functional requirement, `US-` user story, `UC-` use case, `D-` decision, `RSK-` risk. Code comments and tests cite them, so a rule can be followed from requirement to implementation.
- **Versioned documents.** Design and architecture documents carry a version table, and a document that changes direction records what changed and why rather than silently rewriting history.
- **Decisions are ADRs.** A choice that is expensive to reverse gets a numbered record in `architecture/adrs/`.
- **Screenshots** of the app as built live in [`assets/screenshots/`](assets/screenshots/).
