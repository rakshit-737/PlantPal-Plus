# PlantPal+ Sequence Diagrams

| Field | Value |
| --- | --- |
| Document | `04-sequence-diagrams.md` — Critical business flows |
| Version | 1.0 |
| Owner | Rakshit |

This document contains Mermaid sequence diagrams for the critical operations across PlantPal+, illustrating the interaction between the client, API, database, and external services.

## 1. Watering-Reminder Scheduling
Illustrates how the `node-cron` job picks up pending reminders and dispatches them via Expo Push Notification Service.

```mermaid
sequenceDiagram
    participant Cron as node-cron (Scheduler)
    participant DB as PostgreSQL (DB)
    participant Expo as Expo Push Service
    participant Mobile as Mobile Client

    Note over Cron: Runs every 5 minutes
    Cron->>DB: SELECT * FROM scheduled_reminders WHERE due_at_utc <= NOW() AND status = 'PENDING'
    DB-->>Cron: Return batch of reminders (with Expo tokens)
    
    loop For each reminder in batch
        Cron->>Expo: POST https://exp.host/--/api/v2/push/send
        Expo-->>Cron: 200 OK (Receipt ID)
        Cron->>DB: UPDATE scheduled_reminders SET status = 'SENT'
    end
    
    Expo->>Mobile: Delivers Push Notification
```

## 2. Offline Queue & Sync (Append-Only)
Demonstrates the conflict-free append-only outbox sync strategy (`ADR-0002`).

```mermaid
sequenceDiagram
    participant Client as Mobile/Web Client
    participant API as Sync Engine (API)
    participant DB as PostgreSQL (DB)

    Note over Client: User is OFFLINE
    Client->>Client: User logs a plant watering
    Client->>Client: Generate UUID (idempotency_key)
    Client->>Client: Append to local Outbox (AsyncStorage)

    Note over Client: Device comes ONLINE
    Client->>API: POST /sync/outbox (Array of payload + keys)
    
    loop For each event
        API->>DB: INSERT INTO sync_outbox (client_idempotency_key, payload) ON CONFLICT DO NOTHING
        API->>DB: Process payload (e.g., INSERT INTO plant_logs)
        DB-->>API: Success
    end
    
    API-->>Client: 200 OK (List of processed idempotency_keys)
    Client->>Client: Remove processed keys from local Outbox
```

## 3. First-Party Authentication Flow
Covers Registration, Login (JWT issuance), Refresh Token Rotation, and Session Cap (10-session limit with eviction).

```mermaid
sequenceDiagram
    participant Client as Client
    participant Auth as Auth Controller
    participant DB as PostgreSQL (DB)

    %% Login
    Note over Client, DB: Login & Token Issuance
    Client->>Auth: POST /api/auth/login { email, password }
    Auth->>DB: SELECT * FROM users WHERE email = $1
    DB-->>Auth: User Record & Hash
    Auth->>Auth: Verify Argon2id Hash
    
    Auth->>DB: Count active refresh tokens for user_id
    DB-->>Auth: Count = 10 (Limit Reached)
    Auth->>DB: DELETE FROM refresh_tokens WHERE last_used = (oldest) (Evict 11th)
    
    Auth->>Auth: Generate Access Token (15m JWT)
    Auth->>Auth: Generate Refresh Token (30d Opaque)
    Auth->>DB: Store SHA-256 Hash of Refresh Token
    Auth-->>Client: 200 OK (access_token, refresh_token)

    %% Refresh Rotation
    Note over Client, DB: Refresh Token Rotation
    Client->>Auth: POST /api/auth/refresh { refresh_token }
    Auth->>DB: SELECT * FROM refresh_tokens WHERE hash = SHA256($1)
    
    alt Token valid and not consumed
        DB-->>Auth: Token Record
        Auth->>DB: Mark token as consumed
        Auth->>Auth: Generate New Access & Refresh Tokens
        Auth->>DB: Store New Refresh Token Hash
        Auth-->>Client: 200 OK (new_access_token, new_refresh_token)
    else Token already consumed (Reuse Detection)
        DB-->>Auth: Token Record (consumed = true)
        Auth->>DB: DELETE ALL refresh_tokens FOR user_id (Family Revocation)
        Auth-->>Client: 401 Unauthorized (Family Revoked)
    end
```

## 4. Photo Upload (Direct-to-Storage)
Shows how photos (e.g., plant growth timeline) are uploaded directly to Supabase Storage bypassing the API's memory limits.

```mermaid
sequenceDiagram
    participant Client as Client
    participant API as API Server
    participant Storage as Supabase Storage
    participant DB as PostgreSQL (DB)

    Client->>API: GET /api/v1/storage/presigned-url
    API->>Storage: Generate Signed Upload URL
    Storage-->>API: Signed URL
    API-->>Client: 200 OK (Signed URL)
    
    Client->>Storage: PUT binary file to Signed URL
    Storage-->>Client: 200 OK
    
    Client->>API: POST /api/v1/plants/:id/logs (with Storage Path)
    API->>DB: INSERT INTO plant_logs (image_path)
    DB-->>API: Success
    API-->>Client: 200 OK
```

## 5. Nutrition Atwater Calculation
How a meal log is processed to ensure the correct macro-to-calorie balance (Atwater general factor system).

```mermaid
sequenceDiagram
    participant Client as Client
    participant Shared as Shared Domain Package
    participant API as Nutrition Controller
    participant DB as PostgreSQL (DB)

    Client->>Client: User inputs 200g of Banana
    
    %% Shared logic runs on Client for immediate UI feedback
    Client->>Shared: computeCalories(macros, 200g)
    Shared-->>Client: 178 kcal (UI preview)
    
    Client->>API: POST /api/v1/nutrition/meals { food_id, quantity: 200 }
    API->>DB: SELECT * FROM foods WHERE id = food_id
    DB-->>API: macros per 100g
    
    %% Shared logic runs on Server for source of truth
    API->>Shared: computeCalories(macros, 200g)
    Shared-->>API: 178 kcal (Server verified)
    
    API->>DB: INSERT INTO meal_logs (computed_calories) VALUES (178)
    DB-->>API: Success
    API-->>Client: 200 OK (Meal Logged)
```
