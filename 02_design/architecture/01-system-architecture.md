# PlantPal+ System Architecture

| Field | Value |
| --- | --- |
| Document | `01-system-architecture.md` — High-level system design (C4 Model) |
| Version | 1.1 |
| Owner | Rakshit |

## 1. Monorepo Structure (npm workspaces)
To enforce the "TypeScript everywhere" rule and share code seamlessly across web, mobile, and backend, we use an **npm workspaces** monorepo (the locked tooling decision — not Turborepo/Nx).

```text
/PlantPal+
├── apps/
│   ├── api/          # Node.js + Express backend
│   ├── web/          # React + Vite web application
│   └── mobile/       # React Native (Expo) mobile application
├── packages/
│   ├── shared/       # Domain logic, Zod schemas, constants, types
│   ├── ui/           # Shared UI components (NativeWind/Tailwind)
│   ├── tsconfig/     # Base TS configs
│   └── eslint-config/# Shared linting rules
```

> **As built:** only the shared package became a package. Each client keeps its own UI primitives (see [`02_design/ui_design/02-component-inventory.md`](../ui_design/02-component-inventory.md)). The repository was later organised by project phase ([ADR 0005](adrs/0005-organise-the-repository-by-project-phase.md)): the code shown above lives in `03_implementation/` as `api/`, `web/`, `mobile/` and `shared/`, alongside the base TypeScript config (`tsconfig.base.json`) and the one ESLint config (`eslint.config.mjs`). Deployment artefacts live in `06_deployment/`.

## 2. System Architecture (C4 Model)

The architecture is documented following the C4 model (Context, Container, and Component levels) using Mermaid diagrams.

### 2.1 Context Diagram (Level 1)
Shows the system in its environment, interacting with users and external systems.

```mermaid
C4Context
    title System Context Diagram for PlantPal+

    Person(user, "User", "A user tracking their plants, fitness, and nutrition.")
    
    System(plantpal, "PlantPal+", "Unified daily-habit tracker for plant care, fitness, and nutrition.")
    
    System_Ext(expopush, "Expo Push Notification Service", "Delivers push notifications to mobile devices.")
    System_Ext(openfoodfacts, "Open Food Facts API", "Optional external database for food nutrition data.")
    System_Ext(perenual, "Perenual API", "Optional external database for plant species data.")

    Rel(user, plantpal, "Uses to track daily habits", "HTTPS")
    Rel(plantpal, expopush, "Sends reminders via", "HTTPS")
    Rel(plantpal, openfoodfacts, "Fetches nutrition data from", "HTTPS")
    Rel(plantpal, perenual, "Fetches plant species from", "HTTPS")
```

### 2.2 Container Diagram (Level 2)
Zooming into the `PlantPal+` system to show the high-level technical containers.

```mermaid
C4Container
    title Container Diagram for PlantPal+

    Person(user, "User", "A user tracking their habits")

    System_Boundary(c1, "PlantPal+") {
        Container(mobile, "Mobile App", "React Native, Expo", "Provides offline-first logging and push notifications.")
        Container(web, "Web App", "React, Vite", "Provides a responsive dashboard and data management interface.")
        
        Container(api, "API Server", "Node.js, Express", "Handles business logic, auth, sync, and background reminders. Hosted on Render/Railway.")
        
        ContainerDb(db, "Database", "PostgreSQL (Supabase/Neon)", "Stores user data, logs, species, and foods.")
        ContainerDb(storage, "Object Storage", "Supabase Storage", "Stores plant photos.")
    }

    System_Ext(expopush, "Expo Push")
    System_Ext(externalapis, "External APIs (Food/Plants)")

    Rel(user, mobile, "Uses", "Touch")
    Rel(user, web, "Uses", "Browser")

    Rel(mobile, api, "Makes API calls to", "JSON/HTTPS")
    Rel(web, api, "Makes API calls to", "JSON/HTTPS")
    
    Rel(mobile, storage, "Uploads photos to", "HTTPS")
    Rel(web, storage, "Uploads photos to", "HTTPS")

    Rel(api, db, "Reads from and writes to", "SQL/TCP")
    Rel(api, expopush, "Dispatches reminders to", "HTTPS")
    Rel(api, externalapis, "Enriches catalogue using", "HTTPS")
```

### 2.3 Component Diagram: API Server (Level 3)
Zooming into the `API Server` container to show its internal components.

```mermaid
C4Component
    title Component Diagram for API Server

    Container_Boundary(api, "API Server") {
        Component(router, "Express Router & Auth", "Express Middleware", "Routes requests, validates JWTs, manages sessions.")
        Component(sync, "Sync Engine", "TypeScript Module", "Processes offline outbox queues, upserting append-only events idempotently.")
        Component(modules, "Domain Modules", "TypeScript Controllers", "Handles Plants, Fitness, Nutrition, and Dashboard logic.")
        Component(scheduler, "Reminder Scheduler", "node-cron", "Checks for due reminders every 5 minutes and dispatches them.")
        Component(dal, "Data Access Layer", "pg Pool", "Executes parameterized SQL queries against PostgreSQL.")
    }

    Container(mobile, "Mobile App", "React Native", "Client")
    ContainerDb(db, "Database", "PostgreSQL", "Storage")
    System_Ext(expopush, "Expo Push", "Notifications")

    Rel(mobile, router, "Makes requests to", "JSON/HTTPS")
    Rel(router, sync, "Delegates offline sync to")
    Rel(router, modules, "Routes standard API calls to")
    
    Rel(sync, dal, "Uses")
    Rel(modules, dal, "Uses")
    Rel(scheduler, dal, "Reads pending reminders from")
    
    Rel(dal, db, "Executes SQL against", "TCP/IP")
    Rel(scheduler, expopush, "Sends push payloads to", "HTTPS")
```

> **Auth is first-party, not Supabase Auth.** Supabase here provides only managed PostgreSQL and object storage. Authentication (registration, login, JWT access tokens, opaque rotating refresh tokens, session cap) is implemented inside the Express API — see the API specification and the auth ADR. Consequently, per-row isolation is enforced in application queries scoped by `user_id`, **not** by Supabase Row-Level Security using `auth.uid()`.

## 3. Offline & Sync Strategy
- **Offline-Light:** Clients cache reads using TanStack Query (persisted to AsyncStorage / IndexedDB). 
- **Append-Only Write Outbox:** Log actions (watering, meals, workouts) are queued locally if offline.
- **Syncing:** When back online, the client pushes the queue to the `Sync Engine`. Each payload includes a `client_uuid` (idempotency key).
- **Conflict-Free:** Since log events are immutable events (append-only), there is no need for complex CRDTs or Last-Write-Wins merging. The server simply upserts by the idempotency key.

## 4. Reminder Engine
- A `node-cron` job runs every 5 minutes on the API server.
- It scans the PostgreSQL database for reminders due before `CURRENT_TIMESTAMP` that haven't been sent.
- Batches them and sends them to the **Expo Push Notification Service**.
- Records delivery status back in the DB to prevent duplicates.
- **Keep-Alive:** Because the server is hosted on a free tier (Render) which spins down, a ping service (e.g., cron-job.org) must hit the health endpoint every 14 minutes to ensure the reminder engine doesn't sleep.

## 5. As Deployed (2026-10)

The containers above were designed for a long-running Node process on Render. Production runs the same code on a different topology, recorded in [ADR 0004](adrs/0004-host-api-on-supabase-edge-and-web-on-vercel.md):

```mermaid
flowchart LR
    browser["Browser"] -->|"HTTPS"| vercel["Vercel<br/>static web app"]
    vercel -->|"/api/* rewrite<br/>(same origin)"| edge["Supabase Edge Function<br/>plantpal-api"]
    phone["Expo app"] -->|"HTTPS"| edge
    edge -->|"SQL"| db[("Supabase Postgres")]
    cron["pg_cron, every 5 min"] -->|"POST /internal/tick<br/>(Vault secret)"| edge
    db --- cron
    edge -->|"push payloads"| expo["Expo Push Service"]
```

- **API:** the Express app is bundled for Deno (`03_implementation/api/edge/`) and served by a Supabase Edge Function pinned to a commit. It derives its configuration from the platform.
- **Reminder engine:** `node-cron` needs a process that outlives a request, which an edge function does not have. The reminder pass and the account-erasure sweep run on `POST /internal/tick`, called every five minutes by `pg_cron` inside the database — the scheduler can no longer fall asleep with the server, which retires the keep-alive risk in §4.
- **Web:** Vercel serves the static build and rewrites `/api/*` to the edge function, so the refresh cookie stays first-party.
- **Health:** `/healthz` (process) and `/readyz` (database) — a scheduled GitHub Actions job pings `/readyz` so a paused database is noticed before users notice it.

Operational detail lives in [`06_deployment/README.md`](../../06_deployment/README.md).

