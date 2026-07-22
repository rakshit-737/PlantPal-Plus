# PlantPal+ REST API Specification

| Field | Value |
| --- | --- |
| Document | `03-api-specification.md` — REST API Endpoints |
| Version | 1.0 |
| Owner | Rakshit |

## 1. Base URL & Authentication
- **Base URL:** `https://api.plantpalplus.com` (Production). Auth routes are mounted under `/api/auth`; versioned resource routes under `/api/v1`.
- **Auth:** first-party (not Supabase Auth). A 15-minute JWT **access** token issued by this API is sent as `Authorization: Bearer <token>`. A 30-day opaque **refresh** token is stored server-side only as a SHA-256 digest, rotated on every use, and its whole family is revoked on reuse (`BR-ACC-07`). Password hashing is Argon2id (19,456 KiB, t=2, p=1) with a documented bcrypt-cost-12 fallback. See ADR on auth; do **not** describe this as Supabase Auth.
- **Content-Type:** `application/json`

## 2. Standard Responses

Success responses are the resource payload directly — there is no `{ success, data }` wrapper.

**Success (200 / 202)**
```json
{ "status": "registered", "message": "Check your email for a confirmation link." }
```

**Error (4xx / 5xx) — the single FR-SYS-19 envelope, produced in exactly one place (`errorHandler.ts`).** Every error, from every route, has this shape:
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request failed validation.",
    "message_key": "error.validation_failed",
    "details": [{ "field": "email", "issue": "invalid_string", "message": "Invalid email" }],
    "request_id": "5f2c…",
    "timestamp": "2026-07-22T10:00:00.000Z"
  }
}
```
`details` is present only on validation failures (max 50 entries). `code` is drawn from the 21-code registry in `errors.ts`. Internal (5xx) errors never leak their underlying message — the client sees a generic `INTERNAL_ERROR`.

## 3. Endpoints

> Resource endpoints below are under `/api/v1`. Auth endpoints are under `/api/auth` and are the only ones implemented today.

### 3.0 Authentication (implemented — `/api/auth`)
- **`POST /api/auth/register`** — Creates an account. Returns `202` with the same body whether the address is new or already registered, to prevent enumeration (`BR-ACC-10`).
- **`POST /api/auth/login`** — Issues a JWT access token + opaque refresh token. Identical response for unknown-account vs wrong-password (`BR-ACC-10`); `403 EMAIL_NOT_VERIFIED`, `429 ACC_ACCOUNT_LOCKED` after too many attempts. Users in the `PENDING_DELETION` grace window **can** sign in — that is the only way to cancel deletion (`FR-ACC-02` clause 5).
- **`POST /api/auth/refresh`** — Rotates the refresh token (one-time use); reuse of a consumed token revokes the whole family (`BR-ACC-07`).
- **`POST /api/auth/logout`** — Revokes the current session.

### 3.1 Unified Dashboard
- **`GET /dashboard`**
  - **Description:** Returns the aggregated daily summary for all enabled modules.
  - **Query Params:** `date` (YYYY-MM-DD, defaults to today in user's timezone).
  - **Response:**
    ```json
    {
      "streak": { "current": 12, "longest": 14 },
      "plants": { "due_today": 3, "overdue": 1 },
      "fitness": { "steps": 4200, "goal": 10000 },
      "nutrition": { "calories_consumed": 1200, "target": 2000 },
      "today_list": [
         { "type": "PLANT_WATER", "id": "uuid", "title": "Water Monstera" },
         { "type": "MEAL_LOG", "id": "uuid", "title": "Log Lunch" }
      ]
    }
    ```

### 3.2 Offline Sync Outbox
- **`POST /sync/outbox`**
  - **Description:** Bulk upserts append-only log events that were queued while the client was offline.
  - **Request Body:**
    ```json
    {
      "events": [
        {
          "client_idempotency_key": "uuid",
          "entity_type": "PLANT_LOG",
          "payload": {
            "plant_id": "uuid",
            "action_type": "WATER",
            "logged_at_utc": "2026-07-21T10:00:00Z"
          }
        }
      ]
    }
    ```
  - **Response:** Array of processed idempotency keys to allow client to clear its local queue.

### 3.3 Plants
- **`GET /plants`** - List user's plants.
- **`POST /plants`** - Add a new plant.
- **`GET /plants/:id`** - Get plant details and history.
- **`PUT /plants/:id`** - Edit plant profile.
- **`DELETE /plants/:id`** - Archive/soft-delete plant.

### 3.4 Fitness
- **`GET /fitness/workouts`** - List workouts.
- **`POST /fitness/workouts`** - Log a workout (online fast-path).
- **`GET /fitness/summary`** - Weekly/Monthly chart data.

### 3.5 Nutrition
- **`GET /nutrition/foods/search?q=banana`** - Searches seeded catalogue, falls back to Open Food Facts if enabled.
- **`POST /nutrition/meals`** - Log a meal.
- **`GET /nutrition/summary`** - Daily macro breakdown.

### 3.6 Settings & Push
- **`PUT /settings/push-token`**
  - **Description:** Registers an Expo Push token for the device.
  - **Request Body:** `{ "token": "ExponentPushToken[xxxx]" }`
