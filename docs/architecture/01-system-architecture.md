# PlantPal+ System Architecture

| Field | Value |
| --- | --- |
| Document | `01-system-architecture.md` — High-level system design |
| Version | 1.0 |
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

## 2. High-Level Architecture Diagram
The following diagram illustrates how the clients interact with the backend, database, and external services.

```mermaid
flowchart TD
    %% Clients
    subgraph Clients["Clients (React & React Native)"]
        Mobile["📱 Mobile App (Expo)<br>Offline-first writes"]
        Web["💻 Web App (Vite)<br>Responsive UI"]
    end

    %% API Gateway & Services
    subgraph Backend["API Server (Node.js / Express on Render)"]
        Router["Express Router / Auth"]
        Controllers["Module Controllers"]
        SyncEngine["Sync Outbox Resolver"]
        Scheduler["node-cron Reminder Engine"]
        
        Router --> Controllers
        Router --> SyncEngine
        Controllers <--> Scheduler
    end

    %% Storage & External
    subgraph Data["Supabase Platform"]
        DB[(PostgreSQL)]
        Storage["Object Storage (Photos)"]
    end
    
    subgraph External["External Integrations"]
        ExpoPush["Expo Push Notification Service"]
        OpenFoodFacts["Open Food Facts API"]
        Perenual["Perenual Plant API"]
    end

    %% Connections
    Mobile <-->|REST API (HTTPS)| Router
    Web <-->|REST API (HTTPS)| Router
    
    Controllers <-->|SQL Queries| DB
    SyncEngine <-->|Upsert by ID| DB
    
    Mobile -->|Direct Upload| Storage
    Web -->|Direct Upload| Storage
    
    Scheduler -->|Trigger Push| ExpoPush
    Controllers -->|Optional Fetch| OpenFoodFacts
    Controllers -->|Optional Fetch| Perenual
```

> **Auth is first-party, not Supabase Auth.** Supabase here provides only managed PostgreSQL and object storage. Authentication (registration, login, JWT access tokens, opaque rotating refresh tokens, session cap) is implemented inside the Express API — see the API specification and the auth ADR. Consequently, per-row isolation is enforced in application queries scoped by `user_id`, **not** by Supabase Row-Level Security using `auth.uid()`.

## 3. Offline & Sync Strategy
- **Offline-Light:** Clients cache reads using TanStack Query (persisted to AsyncStorage / IndexedDB). 
- **Append-Only Write Outbox:** Log actions (watering, meals, workouts) are queued locally if offline.
- **Syncing:** When back online, the client pushes the queue to the `SyncEngine`. Each payload includes a `client_uuid` (idempotency key).
- **Conflict-Free:** Since log events are immutable events (append-only), there is no need for complex CRDTs or Last-Write-Wins merging. The server simply upserts by the idempotency key.

## 4. Reminder Engine
- A `node-cron` job runs every 5 minutes on the API server.
- It scans the PostgreSQL database for reminders due before `CURRENT_TIMESTAMP` that haven't been sent.
- Batches them and sends them to the **Expo Push Notification Service**.
- Records delivery status back in the DB to prevent duplicates.
- **Keep-Alive:** Because the server is hosted on a free tier (Render) which spins down, a ping service (e.g., cron-job.org) must hit the health endpoint every 14 minutes to ensure the reminder engine doesn't sleep.
