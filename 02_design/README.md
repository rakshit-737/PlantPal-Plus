# Phase 2 — Architecture and Design

How PlantPal+ is built, decided before and refined during implementation. Each document traces back to the [requirements](../01_requirements/README.md).

| Folder | Contents |
| --- | --- |
| [`architecture/`](architecture/) | The system architecture (C4 context, container and component views, offline sync, the reminder engine, the deployed topology), the database schema, the REST API specification, sequence diagrams, the [OpenAPI 3.1 contract](architecture/openapi.yaml) and the [architecture decision records](architecture/adrs/) |
| [`ui_design/`](ui_design/) | The "Conservatory" design language, the component inventory, the Phase 2 wireframes and the navigation flow |
| [`diagrams/`](diagrams/) | Entity-relationship diagrams of the database in three notations: StarUML, Chen and eraser.io |

## Architecture decision records

| ADR | Decision |
| --- | --- |
| [0001](architecture/adrs/0001-use-first-party-auth.md) | First-party authentication instead of Supabase Auth |
| [0002](architecture/adrs/0002-offline-light-append-only-sync.md) | Offline-light, append-only sync |
| [0003](architecture/adrs/0003-use-npm-workspaces.md) | A TypeScript monorepo with npm workspaces |
| [0004](architecture/adrs/0004-host-api-on-supabase-edge-and-web-on-vercel.md) | The API on Supabase Edge Functions, the web app on Vercel |
| [0005](architecture/adrs/0005-organise-the-repository-by-project-phase.md) | One numbered folder per project phase, with the npm workspace in `03_implementation` |

Documents that changed direction after Phase 2 carry a version table and record what changed and why, rather than silently rewriting the original design.
