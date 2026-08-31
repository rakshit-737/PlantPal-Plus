# Documentation

Everything written down about PlantPal+, in the order you would read it.

The project's premise is that every artefact traces to the requirement it
satisfies, so these are not notes taken after the fact — the requirements came
first, the architecture answers them, and the tests assert against the worked
examples the requirements publish.

## Start here

| If you want to | Read |
|---|---|
| Understand what the product is and why | [requirements/SRS.md](requirements/SRS.md) |
| A guided path through the requirements | [requirements/README.md](requirements/README.md) |
| Understand how it is built | [architecture/01-system-architecture.md](architecture/01-system-architecture.md) |
| Call the API | [api-reference.md](api-reference.md) |
| Know why the UI looks the way it does | [design/01-design-language.md](design/01-design-language.md) |
| Deploy it | [deployment/](deployment/) |

## requirements/

The Phase 1 package — 36 documents. `SRS.md` is the Software Requirements
Specification and the root of the traceability chain; `README.md` is a reading
path through the rest.

Numbered `01`–`10` at the top level: stakeholders and personas, scope and
release plan, functional requirements, non-functional requirements, user
stories, use-case model, domain model, glossary, assumptions/constraints/risks,
and the traceability matrix.

Three subdirectories break the same material down per module — `modules/`,
`use-cases/` and `user-stories/`, eight documents each, one per feature area.

## architecture/

How the requirements are answered.

- [01-system-architecture.md](architecture/01-system-architecture.md) — the shape of the system
- [02-database-schema.md](architecture/02-database-schema.md) — tables and relationships
- [03-api-specification.md](architecture/03-api-specification.md) — the contract, with [openapi.yaml](architecture/openapi.yaml) alongside
- [04-sequence-diagrams.md](architecture/04-sequence-diagrams.md) — the flows that cross layers
- [adrs/](architecture/adrs/) — decisions with their reasoning attached: first-party auth, append-only offline sync, npm workspaces

## design/

The visual system, and the record of how it changed.

- [01-design-language.md](design/01-design-language.md) — tokens, type, motion, the accessibility contract
- [02-component-inventory.md](design/02-component-inventory.md) — every primitive and where it is used
- [03-screen-wireframes.md](design/03-screen-wireframes.md)
- [04-navigation-flow.md](design/04-navigation-flow.md)
- [05-glasshouse-master-prompt.md](design/05-glasshouse-master-prompt.md) — the v3.0 "Glasshouse" restyle brief

## deployment/

- [finish.md](deployment/finish.md) — finishing a deploy
- [vercel.md](deployment/vercel.md) — the web app on Vercel

The API deploys from [`render.yaml`](../render.yaml) and the web app from
[`vercel.json`](../vercel.json), both at the repository root because their
platforms require them there.

## Loose ends

- [api-reference.md](api-reference.md) — endpoint reference for callers
- [HANDOFF.md](HANDOFF.md) — a point-in-time handoff note; treat it as history
- [diagrams/](diagrams/) — ER diagram sources (Chen notation, Eraser, StarUML)
