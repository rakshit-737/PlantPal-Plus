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
    "message_key": "errors.validation_failed",
    "details": [{ "field": "email", "issue": "invalid_string", "message": "Invalid email" }],
    "request_id": "5f2c…",
    "timestamp": "2026-07-22T10:00:00.000Z"
  }
}
```
`code` is drawn from the closed **22-code** registry in `errors.ts`, and `message_key` is that code's registry entry — every key is prefixed **`errors.`** (`errors.validation_failed`, `errors.not_found`, …), not `error.`.

`details` is present whenever the thrower supplied it and is omitted from the envelope entirely otherwise (`errorHandler.ts` spreads it in conditionally) — so it is **not** exclusive to validation failures. Validation failures are the common case: a `ZodError` reaching the terminal handler is converted to one entry per issue, capped at 50; routes that validate inline cap earlier (`/sync/outbox` at 20, `/devices` at 10). Non-validation codes use it too — the custom-food ceiling answers `409 CONFLICT` with a `details` entry carrying `field: "foods"`, `issue: "limit_exceeded"`. Internal (5xx) errors never leak their underlying message — the client sees a generic `INTERNAL_ERROR`.

## 3. Endpoints

> Auth endpoints are under `/api/auth`; every resource endpoint below is under `/api/v1`. **Both groups are implemented** — `app.ts` mounts `plants`, `fitness`, `nutrition`, `dashboard`, `achievements`, `reminders`, `devices`, `sync`, `settings` and `account` alongside the auth router. What is genuinely missing is listed in §4 Known Gaps, not here.

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
  - **Description:** Drains the append-only log events queued while the client was offline. `entity_type` is a closed enum — **`PLANT_CARE_EVENT` | `WORKOUT` | `MEAL` | `WATER_LOG`** — and any other value is rejected. At most 50 events per batch; they are applied strictly in array order and a failure is per-event, never per-batch.
  - **Two levels of validation**, which fail differently:
    - The **envelope** (`events[]`, `client_idempotency_key`, `entity_type`) is `.strict()` and checked up front. A bad `entity_type`, a malformed key or an unknown key on the event object rejects the *whole request* with `422 VALIDATION_FAILED`; nothing is applied.
    - Each **payload** is `.strict()` too, but parsed while its own event is being applied. A bad payload fails only that event: the response is still `200`, and the event's entry comes back `status: "FAILED"`, `error_code: "VALIDATION_FAILED"`. That outcome is TERMINAL and is what every future replay of the key returns.
  - **Request Body:** `client_idempotency_key` must be a **v4** UUID (the regex pins the version and variant nibbles). Care-event payloads carry `local_date_str`, the client's wall-clock date — there is no `logged_at_utc` field, and sending one fails that event's strict payload parse.
    ```json
    {
      "events": [
        {
          "client_idempotency_key": "9f8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
          "entity_type": "PLANT_CARE_EVENT",
          "payload": {
            "plant_id": "3f1a7c4e-2b9d-4e6a-8c1f-0d5b2a7e9c34",
            "action_type": "WATER",
            "note": "topped up after the dry spell",
            "local_date_str": "2026-07-21"
          }
        }
      ]
    }
    ```
  - **Response (`200`):** an object under a `results` key — **not** a bare array — with one entry per submitted event, in the order they were sent.
    ```json
    {
      "results": [
        {
          "client_idempotency_key": "9f8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
          "status": "PROCESSED",
          "replay": false,
          "entity_id": "8a2e5d10-6c33-4f71-9b48-1e7c0a5d2f96",
          "error_code": null
        }
      ]
    }
    ```
    `status` is `PROCESSED` or `FAILED`. `replay` is `true` when the key had already been ingested — the recorded outcome is returned rather than reapplied, and a key that reached its destination table through the online path counts as a successful replay. `entity_id` is the created row's id, or `null` on failure. `error_code` is `null` on success and otherwise the TERMINAL classification (`VALIDATION_FAILED`, `PARENT_NOT_FOUND` or `INTERNAL_ERROR`), which every future replay of that key will keep returning. A `FAILED` entry does not stop the events behind it.

### 3.3 Plants
- **`GET /plants`** - List user's plants.
- **`POST /plants`** - Add a new plant.
- **`GET /plants/:id`** - Get plant details and history.
- **`PUT /plants/:id`** - Edit plant profile.
- **`DELETE /plants/:id`** - Archive/soft-delete plant.
- **`POST /plants/:id/growth`** - Add a growth-log entry (`FR-PLT-20`). Strict body: `photo_url` (required), `photo_storage_key` (optional, 1–512 chars, defaults to `photo_url`), `height_cm` (optional, 0–5000), `note` (optional, max 1000), `local_date_str` (`YYYY-MM-DD`). `photo_url` must be an `http(s)` URL of at most 2048 characters — `javascript:` and `data:` parse as valid URLs but are rejected, because both clients render the value in an `<img src>`. Returns `201`. Unknown keys are a `422`. No engagement or reminder side effect: an observation is not a care action (`BR-GAM-02`).
- **`GET /plants/:id/growth`** - The photo timeline (`FR-PLT-21`). Responds with a **bare JSON array**, not a wrapper object, ordered `logged_at_utc` descending and capped at the 50 newest; soft-deleted entries are excluded. `height_cm` is `numeric(6,1)` and is returned as a **string** (`"42.5"`) or `null`, so the stored decimal is not lost to a float conversion. The parent plant is resolved first so an unowned plant answers `404` rather than an empty list (`BR-PLT-36` cl.3).
- **`DELETE /plants/:id/growth/:entryId`** - Soft-delete one entry (`BR-PLT-24` cl.5); returns `{ "status": "deleted" }`. A repeat delete matches nothing and is a `404`, as are a missing plant and another user's plant.

### 3.4 Fitness
Mounted at `/api/v1/fitness`; every route is authenticated. Workouts live at the collection root — there is no `/fitness/workouts` segment.

- **`GET /fitness`** - List workouts.
- **`POST /fitness`** - Log a workout (online fast-path). Calories and set volume are recomputed server-side from `@plantpal/shared`, exactly as the sync path does.
- **`GET /fitness/:id`** - One workout.
- **`GET /fitness/exercises`** - Exercise catalogue with MET values; `?q=` searches it.
- **`GET /fitness/personal-records`** - Personal records, read from `personal_records`; the stored 1RM estimate is written at log time by the shared `estimatedOneRepMax`.
- **`GET /fitness/summary?week=YYYY-MM-DD`** - Weekly summary for the week beginning `week`. The `week` parameter is **required** and must be `YYYY-MM-DD`; a missing or malformed value is `422 VALIDATION_FAILED` with `field: "week"`, `issue: "required_or_invalid"`.

The three literal paths are declared before `/:id`, so `exercises`, `personal-records` and `summary` are never swallowed by the id parameter.

### 3.5 Nutrition
- **`GET /nutrition/foods/search?q=banana`** - Case-insensitive substring match over the seeded catalogue plus the caller's own custom foods — catalogue rows (`is_custom = false`) are visible to everyone, custom rows only to `created_by`, so one user's private foods never surface in another's search. Ordering is exact name match first, then prefix match, then alphabetical; `limit 200`. This is a **single SQL query against `foods`** — there is no third-party food database behind it and no network call of any kind, so an item the catalogue does not have must be created with `POST /nutrition/foods`.
- **`POST /nutrition/foods`** - Creates a private custom food (`FR-NUT-10`). Strict body, every bound mirroring a CHECK constraint in `004-nutrition-schema.sql`: `name` (1–120), `brand` (optional, max 80; empty stored as `null`), `kcal_per_100g` (0–9000, required), `protein_per_100g` / `carbs_per_100g` / `fat_per_100g` (0–100, default `0`), `default_serving_unit` (`GRAM`/`MILLILITRE`/`PIECE`/`CUP`/`TABLESPOON`/`SLICE`/`CUSTOM`, default `GRAM`), `default_serving_grams` (optional, 0.1–5000), `barcode` (optional, 8–14 digits). `is_custom`, `created_by` and `source` are derived from the authenticated subject and written as SQL constants (`true`, caller, `CUSTOM`) — a body mentioning them is refused with `422`, not stripped. The per-user ceiling is 200 (`NFR-SCAL-03`); exceeding it returns `409 CONFLICT` whose `details` entry carries `field: "foods"`, `issue: "limit_exceeded"`, plus the current count and the ceiling, and soft-deleted rows still count. Returns `201` with the row in exactly the `foods/search` item shape, so a new food is loggable without a second round trip.
- **`POST /nutrition/meals`** - Log a meal.
- **`GET /nutrition/summary`** - Daily macro breakdown.

### 3.6 Settings & Push
- **`POST /api/v1/devices`** — device/push registration (`FR-NOT-14`). There is no `PUT /settings/push-token`; the token lives on its own device registry router, not on settings.
  - **Description:** Registers this installation's Expo Push token. Authenticated; the row is keyed to the token subject. Returns `200` with `{ "id", "devices" }`.
  - **Request Body** — `.strict()`, so an unknown key is a `422`:
    ```json
    {
      "expo_push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
      "platform": "ANDROID",
      "client_installation_id": "b41f8f0e-9c2a-4f57-8d63-0a1e5c7b3d92",
      "permission_status": "GRANTED",
      "device_label": "Pixel 7",
      "app_version": "1.0.0"
    }
    ```
    `expo_push_token` (20–200 chars) must match `Expo(nent)?PushToken[…]`. `platform` is `IOS` | `ANDROID` — `WEB` is deferred to v1.1 under D-10. `client_installation_id` is a UUID. `permission_status` is `GRANTED` | `DENIED` | `UNDETERMINED`. `device_label` (max 64) and `app_version` (max 20) are optional; a blank label is stored as absent.
- **`PUT /settings`** — quiet-hours boundaries (`FR-SET-16`, `FR-NOT-06`)
  - **Fields:** `quiet_start_time` and `quiet_end_time` — a 24-hour wall clock `"HH:MM"` (`00:00`–`23:59`) in the user's own zone, or `null` to clear. A seconds component and `24:00` are both rejected, so what a client writes is byte-for-byte what it reads back.
  - **Normalisation on read:** the columns are Postgres `time`, which node-postgres hands back as raw text (`'22:00:00'`); both are truncated to `HH:MM` on every response, read path and write path alike, so a `PUT` reply and a later `GET` cannot disagree.
  - **Validation (`BR-NOT-08` cl.1, `BR-SET-07`):** when a request touches any of `quiet_hours_mode`, `quiet_start_time`, `quiet_end_time` **and** the merged mode is `WINDOW`, both times must be non-null (`window_requires_start_and_end`) and must differ (`window_start_equals_end` — equal boundaries are ambiguous between "never quiet" and "always quiet", edge case E-33). Either failure is `422 VALIDATION_FAILED`. The check runs only when the patch touches that triple: rows are created with mode `WINDOW` and no times, so an unconditional check would make an unrelated theme change unsavable.

### 3.7 Account Lifecycle (implemented — `/api/v1/account`)

Every route is authenticated and acts on the token subject alone — no account identifier is ever accepted from the request (`FR-ACC-23`). Nothing here erases data: the state change is soft and reversible for the whole window, and the irreversible sweep is `FR-ACC-22`'s job.

- **`GET /account`** — Current status and the countdown instants: `status`, `deletion_requested_at`, `purge_after`, `deletion_scheduled_at` (ISO-8601, or `null` outside the window). The schema calls the sweep instant `purge_after` where `FR-ACC-21` and the login response call it `deletion_scheduled_at`; both names are published, carrying the same value. A valid token whose user row has gone answers `401 AUTHENTICATION_REQUIRED` — the signal that makes a client drop its tokens.
- **`POST /account/deletion`** — Schedules deletion and stamps a 30-day grace window (`BR-ACC-20` cl.1). Requires a step-up: the strict body is `{ "password": string }`, verified against the caller's stored hash (`FR-ACC-21` cl.1), so a stolen access token alone cannot schedule a deletion. A wrong password is `401 INVALID_CREDENTIALS` and never reaches the repository. `FR-ACC-21` also specifies `confirmation_phrase` and `reason`; neither is implemented, so sending either is a `422` rather than a silently discarded field — the typed-`DELETE` confirmation is enforced client-side only. **Idempotent** — a repeat confirmation returns the window already running, never re-stamps the instants (which would extend the deletion date), and flags the response with `already_pending: true`. The spec's alternate flow names `409 ACC_ALREADY_PENDING_DELETION`; `200` is returned instead so a double tap is not surfaced as a failure.
- **`DELETE /account/deletion`** — Cancels a pending deletion (`BR-ACC-20` cl.3) and clears both instants. The restored status is derived from `email_verified_at`, so it is `ACTIVE` or `PENDING_VERIFICATION` — not always `ACTIVE`. `409 CONFLICT` when nothing is pending (not `404`: the caller owns the account and knows it exists). Cancellation remains available after `purge_after` has elapsed but before the sweep completes.

**Side effect of scheduling** (`FR-ACC-21` rule 3), applied on the transition only and never on a repeat confirmation: every other `ACTIVE` session is revoked with `revoke_reason = 'DELETION_REQUESTED'`, and their unconsumed refresh tokens are stamped consumed, so a token belonging to a revoked session cannot be redeemed at `POST /api/auth/refresh`. The calling session is spared — cancelling is only reachable while authenticated — and `token_version` is deliberately not bumped, since bumping it would sign out the one session that can still undo. A request with no `sid` claim degrades to revoking everything.

## 4. Known Gaps

- **No purge sweep job.** `FR-ACC-22`'s erasure pass over `BR-ACC-20` Table H does not exist; accounts past `purge_after` remain in `PENDING_DELETION` and retain their data until it is built.
- **Quiet hours and the daily notification cap are stored but not applied.** The reminders module never reads `quiet_hours_mode`, `quiet_start_time`, `quiet_end_time` or `daily_notification_cap` — the dispatcher consults none of them when it delivers, so both settings currently only persist intent.
- **Growth photos are links, not uploads.** There is no object storage and no upload endpoint (`BR-PLT-25` assumes one); `photo_url` must reference an image the user already hosts, and `photo_storage_key` falls back to that URL.
- **No delete endpoint for custom foods.** A created food cannot be removed through the API and keeps counting toward the 200-per-user ceiling.
