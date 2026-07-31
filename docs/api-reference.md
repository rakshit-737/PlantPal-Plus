# PlantPal+ API reference

Base URL: `http://localhost:4000` in development; the Render service URL in production.
Full request/response schemas live in the OpenAPI 3.1 spec at
[docs/architecture](architecture/) — this page is the quick human-readable index.

## Conventions

- **Auth**: every route except `/healthz`, `/api/v1` and the four public auth
  routes requires `Authorization: Bearer <access_token>`. Access tokens are
  short-lived JWTs returned by login/refresh. Where the **refresh** token travels
  depends on the client, which `authController` decides from the
  `x-plantpal-client` header (`IOS`/`ANDROID`/`WEB`, defaulting to `WEB`):
  - **Web** — set as an httpOnly, `Secure`, `SameSite=None` cookie named
    `refresh_token`, scoped to `/api/auth`, and never included in the JSON body.
  - **Mobile** (`IOS`/`ANDROID`) — returned **in the response body** as
    `refresh_token`, because a native client has no cookie jar to rely on
    (BR-ACC-07 clause 7).

  `/refresh` and `/logout` accept the token from either place —
  `req.cookies.refresh_token ?? req.body.refresh_token`. Cookie-bearing requests
  additionally have to pass an Origin allow-list check (a body-token request
  carries no ambient credential, so it needs no such gate).
- **Errors**: all errors use one envelope —
  `{ "error": { "code", "message", "message_key", "details?", "request_id", "timestamp" } }`.
  `request_id` matches the `x-request-id` response header for log correlation.
- **Dates**: `local_date_str` fields are the client's wall-clock date
  (`YYYY-MM-DD`), never UTC-derived (FR-SYS-22).
- **Idempotency**: mutation routes used by offline sync accept
  `client_idempotency_key`; replays are absorbed server-side.

## Health

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness — dependency-free, returns `{status, uptime_s}` |
| GET | `/api/v1` | API banner/version |

## Auth — `/api/auth`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/register` | — | Create account. Body: `email`, `password`, `confirmed_age: true`. Returns 202 always (no account enumeration). |
| POST | `/login` | — | Body: `email`, `password`. Returns `access_token` + user; the refresh token is set as a cookie for web and returned as `refresh_token` in the body for mobile. Constant-time on unknown accounts; lockout after repeated failures. |
| POST | `/refresh` | cookie or body | Rotates the refresh-token family, returns a fresh `access_token` (plus `refresh_token` in the body on mobile). Reuse of a consumed token revokes the whole family. |
| POST | `/logout` | cookie or body | Revokes the session and clears the cookie. |
| GET | `/me` | bearer | Current user profile. |

## Account — `/api/v1/account`

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Account status and the deletion countdown: `status`, `deletion_requested_at`, `purge_after`, and `deletion_scheduled_at` (an alias of `purge_after`, the name FR-ACC-21 and the login response use). |
| POST | `/deletion` | Schedule deletion with a 30-day grace window. Strict body `{ password }`, verified against the caller's stored hash (FR-ACC-21 cl.1) — a wrong password is `401 INVALID_CREDENTIALS`; `confirmation_phrase` and `reason` are specified but not implemented, so sending either is a 422 rather than a silently discarded field. Idempotent: a repeat call returns the window already running with `already_pending: true` and never re-stamps it. |
| DELETE | `/deletion` | Cancel a pending deletion. Status returns to `ACTIVE`, or to `PENDING_VERIFICATION` if the address was never verified. `409 CONFLICT` when nothing is pending. Still available once `purge_after` has passed, as long as the sweep has not run. |

All three act on the token subject alone — no account identifier is ever read from the
request. The account stays fully usable for the whole window, and login still admits a
`PENDING_DELETION` user, since that is the only route to cancelling.

**Side effect of scheduling** — on the transition only, never on a repeat confirmation:
every other `ACTIVE` session is revoked (`revoke_reason = DELETION_REQUESTED`) and their
outstanding refresh tokens are marked consumed, so those tokens can no longer be redeemed
at `POST /api/auth/refresh`. The calling session deliberately survives (cancelling requires
being signed in) and `token_version` is not bumped.

## Plants — `/api/v1/plants`

| Method | Path | Purpose |
|---|---|---|
| GET | `/species` | Species catalogue. `?q=` filters by common name (ILIKE); empty/absent `q` returns the full catalogue alphabetically (limit 200). |
| GET | `/` | List the user's plants, newest first. |
| POST | `/` | Create a plant. `species_id` optional; watering intervals + light/soil/pot feed the watering algorithm (BR-PLT-08). |
| GET | `/:id` | One plant. |
| PUT | `/:id` | Update allow-listed fields only (no mass assignment). |
| DELETE | `/:id` | Soft delete. |
| POST | `/:id/care` | Log a care event (`action_type: WATER/FERTILIZE/PRUNE/REPOT/MIST/ROTATE/TREAT`, `local_date_str`). `WATER` recomputes `next_water_due_at` via the shared algorithm and freezes the factor snapshot. |
| GET | `/:id/care` | Care history. |
| POST | `/:id/growth` | Add a growth-log entry (photo link + optional height/note). Strict body — an unknown key is a 422. Returns `201` with the entry. No engagement or reminder side effect: an observation is not a care action, so it neither closes a task nor advances the streak. |
| GET | `/:id/growth` | Growth timeline as a **bare JSON array** (no wrapper object), newest first, capped at the 50 most recent; soft-deleted entries excluded. |
| DELETE | `/:id/growth/:entryId` | Soft-delete one entry; returns `{"status":"deleted"}`. A repeat delete matches nothing and is a 404. |

A plant that does not exist and a plant belonging to someone else are indistinguishable —
both are `404` on every growth route.

Growth entry body:

| Field | Type / rules |
|---|---|
| `photo_url` | required — an `http(s)` URL, max 2048 chars. `javascript:` and `data:` URLs are rejected: both clients render this value in an `<img src>`. |
| `photo_storage_key` | optional, 1–512 chars; defaults to `photo_url` when omitted. |
| `height_cm` | optional number, 0–5000. Stored as `numeric(6,1)` and **returned as a string** (`"42.5"`) or `null` — numerics are not coerced to JS floats, so the typed decimal survives exactly. |
| `note` | optional, max 1000 chars. |
| `local_date_str` | required, `YYYY-MM-DD`. |

## Fitness — `/api/v1/fitness`

| Method | Path | Purpose |
|---|---|---|
| GET | `/exercises` | Exercise catalogue with MET values; `?q=` search. |
| GET | `/personal-records` | PRs (estimated 1RM via shared `estimatedOneRepMax`). |
| GET | `/summary` | Weekly summary for the week beginning `?week=YYYY-MM-DD` (required). |
| GET | `/` | List workouts. |
| POST | `/` | Log a workout (`activity_type`, `duration_mins`, `perceived_intensity`, `steps`, `local_date_str`). Calorie estimate uses frozen MET + Mifflin-St Jeor from `@plantpal/shared`. |
| GET | `/:id` | One workout. |

## Nutrition — `/api/v1/nutrition`

| Method | Path | Purpose |
|---|---|---|
| GET | `/foods/search` | Food catalogue. `?q=` ranks exact > prefix > substring; empty/absent `q` browses alphabetically (limit 200). Custom foods are visible only to their creator. |
| POST | `/foods` | Create a private custom food. Strict body — an unknown key is a 422. Returns `201` with the row in the same item shape `/foods/search` returns, so it can be logged without a follow-up search. |
| GET | `/summary` | Daily totals + meals + water for `?date=YYYY-MM-DD`. |
| POST | `/meals` | Log a meal with items; per-item energy recomputed via Atwater (`energyFromMacros`) and frozen at log time. |
| POST | `/water` | Log water (`amount_ml`, `local_date_str`). |

Custom food body:

| Field | Type / rules |
|---|---|
| `name` | required, 1–120 chars |
| `brand` | optional, max 80 chars; an empty string is stored as `null` |
| `kcal_per_100g` | required, 0–9000 |
| `protein_per_100g`, `carbs_per_100g`, `fat_per_100g` | 0–100, default `0` |
| `default_serving_unit` | `GRAM` \| `MILLILITRE` \| `PIECE` \| `CUP` \| `TABLESPOON` \| `SLICE` \| `CUSTOM`, default `GRAM` |
| `default_serving_grams` | optional, 0.1–5000 |
| `barcode` | optional, 8–14 digits |

`is_custom`, `created_by` and `source` are server-set (`true`, the authenticated caller,
`CUSTOM`); a body that mentions any of them is rejected outright rather than stripped, so
an attempt to set ownership is visible to the caller and to the logs. Each user may hold
200 custom foods; beyond that the endpoint answers `409 CONFLICT` with
`details: [{ field: "foods", issue: "limit_exceeded", current, ceiling }]`. Soft-deleted
foods still occupy storage and still count toward the ceiling.

## Dashboard — `/api/v1/dashboard`

| Method | Path | Purpose |
|---|---|---|
| GET | `/?date=` | Aggregated day view: streak, plants due/overdue, steps vs goal, calories vs target, today's task list. |

## Settings — `/api/v1/settings`

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Current user settings. |
| PUT | `/` | Partial update — send only the fields to change. Invalid values fail with per-field `details`. At least one of the three module toggles must remain enabled after the merge. |

Updatable fields:

| Field | Type / allowed values |
|---|---|
| `hemisphere` | `NORTHERN` \| `SOUTHERN` \| `EQUATORIAL` |
| `unit_system` | `METRIC` \| `IMPERIAL` |
| `theme` | `LIGHT` \| `DARK` \| `SYSTEM` |
| `week_start_day` | `SUNDAY` \| `MONDAY` |
| `quiet_hours_mode` | `OFF` \| `WINDOW` \| `SCHEDULED_ONLY` |
| `quiet_start_time`, `quiet_end_time` | `"HH:MM"` 24-hour (`00:00`–`23:59`) or `null` to clear; a seconds component and `24:00` are rejected |
| `plant_care_enabled`, `fitness_enabled`, `nutrition_enabled` | boolean — at least one must stay `true` |
| `reduce_motion`, `larger_text`, `high_contrast` | boolean |
| `analytics_opt_in` | boolean |
| `timezone` | string, max 64 chars |
| `locale` | string, max 20 chars |
| `daily_notification_cap` | integer, 1–20 |

Quiet hours: the two boundaries are `time` columns, so they are normalised to `HH:MM` on
every read and write response (`22:00:00` reads back as `22:00`) — what a client sends is
byte-for-byte what a later `GET` returns. When a request touches any of
`quiet_hours_mode`, `quiet_start_time` or `quiet_end_time` **and** the merged
`quiet_hours_mode` is `WINDOW`, both times must be non-null
(`window_requires_start_and_end`) and must differ (`window_start_equals_end`, since equal
boundaries are ambiguous between "never quiet" and "always quiet"); either failure is a
422. The check is skipped when the patch leaves the quiet-hours triple alone, because rows
are created with mode `WINDOW` and no times.

## Achievements — `/api/v1/achievements`

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | All achievements with earned state. |
| GET | `/streaks` | Current/longest streaks per module. |
| POST | `/seen` | Mark earned achievements as seen (clears "new" badges). |

## Reminders — `/api/v1/reminders`

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Pending reminders (in-app delivery baseline). |
| POST | `/:id/dismiss` | Dismiss one reminder. |

## Devices — `/api/v1/devices`

| Method | Path | Purpose |
|---|---|---|
| POST | `/` | Register an Expo push token for the calling device. |

## Sync — `/api/v1/sync`

| Method | Path | Purpose |
|---|---|---|
| POST | `/outbox` | Drain an offline outbox: an ordered batch of mutations, each with `client_idempotency_key`. Applied transactionally; replays return the recorded outcome. |

## Known gaps

- **No purge sweep.** Nothing erases an account once `purge_after` has elapsed; the row
  stays in `PENDING_DELETION` indefinitely. Scheduling is soft and reversible only.
- **Quiet hours are stored, not enforced.** The reminder dispatcher does not consult
  `quiet_hours_mode` or the window when it delivers.
- **The daily notification cap is stored, not enforced.** `daily_notification_cap`
  validates (integer 1–20) and persists, but nothing in the reminders module reads
  it — no code path counts a day's deliveries against it, so the number a user picks
  has no effect on how many reminders they receive.
- **Growth photos are links, not uploads.** There is no object storage and no upload
  endpoint — `photo_url` must point at an image the user already hosts, and
  `photo_storage_key` falls back to that same URL.
- **Custom foods cannot be deleted.** There is no delete route, and every created food
  keeps counting toward the 200-per-user ceiling.
