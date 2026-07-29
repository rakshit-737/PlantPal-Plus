# PlantPal+ API reference

Base URL: `http://localhost:4000` in development; the Render service URL in production.
Full request/response schemas live in the OpenAPI 3.1 spec at
[docs/architecture](architecture/) — this page is the quick human-readable index.

## Conventions

- **Auth**: every route except `/healthz`, `/api/v1` and the four public auth
  routes requires `Authorization: Bearer <access_token>`. Access tokens are
  short-lived JWTs returned by login/refresh; the refresh token travels only in
  an httpOnly cookie scoped to `/api/auth`.
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
| POST | `/login` | — | Body: `email`, `password`. Returns `access_token` + user; sets refresh cookie. Constant-time on unknown accounts; lockout after repeated failures. |
| POST | `/refresh` | cookie | Rotates the refresh-token family, returns a fresh `access_token`. Reuse of a consumed token revokes the whole family. |
| POST | `/logout` | cookie | Revokes the session and clears the cookie. |
| GET | `/me` | bearer | Current user profile. |

## Plants — `/api/v1/plants`

| Method | Path | Purpose |
|---|---|---|
| GET | `/species` | Species catalogue. `?q=` filters by common name (ILIKE); empty/absent `q` returns the full catalogue alphabetically (limit 200). |
| GET | `/` | List the user's plants, newest first. |
| POST | `/` | Create a plant. `species_id` optional; watering intervals + light/soil/pot feed the watering algorithm (BR-PLT-08). |
| GET | `/:id` | One plant. |
| PUT | `/:id` | Update allow-listed fields only (no mass assignment). |
| DELETE | `/:id` | Soft delete. |
| POST | `/:id/care` | Log a care event (`action_type: WATER/FERTILISE/…`, `local_date_str`). `WATER` recomputes `next_water_due_at` via the shared algorithm and freezes the factor snapshot. |
| GET | `/:id/care` | Care history. |

## Fitness — `/api/v1/fitness`

| Method | Path | Purpose |
|---|---|---|
| GET | `/exercises` | Exercise catalogue with MET values; `?q=` search. |
| GET | `/personal-records` | PRs (estimated 1RM via shared `estimatedOneRepMax`). |
| GET | `/summary` | Weekly summary; `?week_start=YYYY-MM-DD` (Monday). |
| GET | `/` | List workouts. |
| POST | `/` | Log a workout (`activity_type`, `duration_mins`, `perceived_intensity`, `steps`, `local_date_str`). Calorie estimate uses frozen MET + Mifflin-St Jeor from `@plantpal/shared`. |
| GET | `/:id` | One workout. |

## Nutrition — `/api/v1/nutrition`

| Method | Path | Purpose |
|---|---|---|
| GET | `/foods/search` | Food catalogue. `?q=` ranks exact > prefix > substring; empty/absent `q` browses alphabetically (limit 200). Custom foods are visible only to their creator. |
| GET | `/summary` | Daily totals + meals + water for `?date=YYYY-MM-DD`. |
| POST | `/meals` | Log a meal with items; per-item energy recomputed via Atwater (`energyFromMacros`) and frozen at log time. |
| POST | `/water` | Log water (`amount_ml`, `local_date_str`). |

## Dashboard — `/api/v1/dashboard`

| Method | Path | Purpose |
|---|---|---|
| GET | `/?date=` | Aggregated day view: streak, plants due/overdue, steps vs goal, calories vs target, today's task list. |

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
