# Diagrams

Entity-relationship diagrams of the PlantPal+ database, generated from the schema migrations in [`apps/api/src/db/migrations/`](../../apps/api/src/db/migrations/). All three describe the same **28 tables and 34 foreign keys**, grouped into six subsystems: accounts and auth, plant care, fitness, nutrition, engagement (streaks, achievements, reminders) and sync.

| File | Notation | How to open it |
| --- | --- | --- |
| [`plantpal-erd.mdj`](plantpal-erd.mdj) | Crow's-foot ERD (StarUML) | Open in [StarUML](https://staruml.io) — *File → Open*. The project contains the data model and one ER diagram. |
| [`plantpal-chen-er.html`](plantpal-chen-er.html) | Chen notation (entities, relationships, attributes) | A self-contained page — download it and open it in any browser. |
| [`plantpal-eraser-erd.txt`](plantpal-eraser-erd.txt) | Diagram-as-code | Paste into [eraser.io](https://app.eraser.io) → *Diagram as code → Entity Relationship*. Colours mark the subsystems. |

Other diagrams live beside the documents they illustrate, as Mermaid that GitHub renders inline:

- System context, containers, components and the deployed topology — [`architecture/01-system-architecture.md`](../architecture/01-system-architecture.md)
- Sequence diagrams for the core flows — [`architecture/04-sequence-diagrams.md`](../architecture/04-sequence-diagrams.md)
- Use-case and domain models — [`requirements/06-use-case-model.md`](../requirements/06-use-case-model.md), [`requirements/07-domain-model.md`](../requirements/07-domain-model.md)

When a migration changes the schema, regenerate all three files so they keep agreeing with each other and with the database.
