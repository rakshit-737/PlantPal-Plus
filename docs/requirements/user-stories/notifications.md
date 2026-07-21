# User Stories — Notifications and the Reminder Scheduling Engine

| Field | Value |
| --- | --- |
| Document | `user-stories/notifications.md` — user stories and acceptance criteria for the `NOT` subsystem |
| Version | 1.0 |
| Date | 2026-07-21 |
| Status | Approved for Phase 2 |
| Owner | Rakshit — Project Lead / sole developer |
| Parent | [05-user-stories.md](../05-user-stories.md) |
| Specification aligned to | [modules/notifications.md](../modules/notifications.md) — `FR-NOT-01` to `FR-NOT-24`, `BR-NOT-01` to `BR-NOT-31` |
| Identifiers minted here | `US-NOT-01` to `US-NOT-13`, `EPIC-NOT-01` to `EPIC-NOT-07`, and the `AC-n` criteria scoped inside each story |
| Identifiers referenced only | `FR-NOT-*`, `BR-NOT-*`, `UC-NOT-*`, `PER-*`, `GOAL-*`, `NFR-*` |

> **Reading note on category names.** This document uses the canonical `ReminderCategory` member names of [BR-NOT-01](../modules/notifications.md#br-not-01--reminder-category-catalogue) — `PLANT_WATERING`, `PLANT_CARE_TASK`, `PLANT_OVERDUE`, `WORKOUT`, `STEP_GOAL`, `MEAL_LOG`, `WATER_INTAKE`, `STREAK_AT_RISK`, `ACHIEVEMENT`, `WEEKLY_RECAP`, `SYSTEM_TEST`. Aliases such as `PLANT_WATERING_DUE` are not used. Reason codes are the closed registry of [BR-NOT-07](../modules/notifications.md#br-not-07--closed-reason-code-registry); occurrence and delivery states are those of [BR-NOT-06](../modules/notifications.md#br-not-06--delivery-and-occurrence-status-machines); the channel members are `EXPO_PUSH`, `IN_APP` and `EMAIL`.

---

## Table of contents

1. [Epics for this module](#1-epics-for-this-module)
2. [User stories](#2-user-stories)
   - [US-NOT-01 — Receive a watering reminder at the right local time](#us-not-01--receive-a-watering-reminder-at-the-right-local-time)
   - [US-NOT-02 — Configure which reminders I get and when](#us-not-02--configure-which-reminders-i-get-and-when)
   - [US-NOT-03 — Not be woken up at night](#us-not-03--not-be-woken-up-at-night)
   - [US-NOT-04 — Pause every notification for a while](#us-not-04--pause-every-notification-for-a-while)
   - [US-NOT-05 — Not be flooded on a busy day](#us-not-05--not-be-flooded-on-a-busy-day)
   - [US-NOT-06 — One notification for many due plants](#us-not-06--one-notification-for-many-due-plants)
   - [US-NOT-07 — Tap a notification and land exactly where I need to be](#us-not-07--tap-a-notification-and-land-exactly-where-i-need-to-be)
   - [US-NOT-08 — See what I would have been told, on the web](#us-not-08--see-what-i-would-have-been-told-on-the-web)
   - [US-NOT-09 — Act straight from the notification](#us-not-09--act-straight-from-the-notification)
   - [US-NOT-10 — Postpone a reminder without losing it](#us-not-10--postpone-a-reminder-without-losing-it)
   - [US-NOT-11 — Correct reminders when I travel or the clocks change](#us-not-11--correct-reminders-when-i-travel-or-the-clocks-change)
   - [US-NOT-12 — Trust the system after an outage](#us-not-12--trust-the-system-after-an-outage)
   - [US-NOT-13 — Diagnose why notifications are not arriving](#us-not-13--diagnose-why-notifications-are-not-arriving)
3. [Story index](#3-story-index)
4. [Story point totals](#4-story-point-totals)

---

## 1. Epics for this module

An epic here is a coherent slice of user value that no single story can deliver on its own. Epic identifiers are scoped to the `NOT` prefix this document owns and are never referenced outside it.

| Epic | Name | Goal — the user outcome the epic delivers | Stories |
| --- | --- | --- | --- |
| EPIC-NOT-01 | Scheduling and reliable delivery | A reminder that is materialised once, delivered once, delivered at the configured local time, and behaves predictably when the free-tier backend has been asleep. | US-NOT-01, US-NOT-12 |
| EPIC-NOT-02 | Interruption control | The user decides which categories may interrupt them, at what local time, and during which hours the product must stay silent. | US-NOT-02, US-NOT-03, US-NOT-04 |
| EPIC-NOT-03 | Volume control | A hard ceiling on daily interruptions and the collapsing of same-category reminders, so a large collection does not become noise. | US-NOT-05, US-NOT-06 |
| EPIC-NOT-04 | Temporal correctness | Reminders follow the user's local wall clock across daylight-saving transitions and across a change of timezone, and never duplicate as a result. | US-NOT-11 |
| EPIC-NOT-05 | Notification surfaces | Every notification is reachable and actionable: the correct screen on tap, a durable in-app history, and a web-side surface plus an optional email digest in the absence of web push. | US-NOT-07, US-NOT-08 |
| EPIC-NOT-06 | Acting on a notification | Logging and postponement performed directly from the notification, with exactly-once semantics and a bounded snooze. | US-NOT-09, US-NOT-10 |
| EPIC-NOT-07 | Device transport and self-service diagnostics | Push tokens are registered, refreshed, reassigned and pruned correctly, and a user can find out for themselves why a device is not receiving notifications. | US-NOT-13 |

---

## 2. User stories

Every story below satisfies INVEST: it is independently demonstrable, its acceptance criteria are negotiable in wording but not in threshold, it carries user-visible value, it is estimated in Fibonacci story points, it is small enough to complete inside one release increment, and every criterion is objectively testable against a named value in [modules/notifications.md](../modules/notifications.md).

---

### US-NOT-01 — Receive a watering reminder at the right local time

| Field | Value |
| --- | --- |
| Epic | EPIC-NOT-01 Scheduling and reliable delivery |
| Persona | PER-02 Marcus Oyelaran |
| Priority | Must |
| Release | v0.1 Walking Skeleton |
| Estimate | 13 points |
| Related FRs | FR-NOT-01, FR-NOT-02, FR-NOT-16 |
| Related UCs | UC-NOT-01, UC-NOT-02, UC-NOT-04 |
| Governing rules | BR-NOT-02, BR-NOT-03, BR-NOT-04, BR-NOT-05, BR-NOT-16 |

**As a** Registered User with houseplants — Marcus Oyelaran, **I want** a push notification on the morning a plant is due for water, **so that** I do not have to remember the schedule or open the app to check it.

#### Acceptance criteria

**AC-1 — Happy path: the reminder arrives at the configured local time.**

```gherkin
Scenario: A due plant produces exactly one push notification at the preferred local time
  Given my timezone is "Europe/London"
  And my preferred local time for the category "PLANT_WATERING" is "09:00"
  And my plant "Monstera" has a published watering due instant on 2026-07-22
  And the planner pass has materialised one occurrence with state "SCHEDULED"
  When the dispatch pass runs at 2026-07-22T08:00:00Z
  Then exactly one push message for "Monstera" is submitted to the Expo Push Service
  And the "EXPO_PUSH" delivery row status becomes "SENT"
  And the "IN_APP" delivery row status becomes "DELIVERED"
  And the occurrence state becomes "DISPATCHED"
```

**AC-2 — Happy path: dispatch latency is bounded by the tick interval.**

```gherkin
Scenario: A reminder is submitted within one dispatch interval of becoming due
  Given an occurrence has an effective due instant of 2026-07-22T08:00:00Z
  And the dispatch pass runs on the cron schedule "*/5 * * * *"
  When the first pass whose start instant is at or after 08:00:00Z executes
  Then the push message is submitted no later than 2026-07-22T08:05:00Z
  And the "scheduler_run" row for that pass records "outcome" as "OK"
```

**AC-3 — Alternate path: a repeated planner pass creates no second occurrence.**

```gherkin
Scenario: Idempotent materialisation across two planner passes
  Given an occurrence already exists with the key "PLANT_WATERING|PLANT|9f1c2a6e-0000-4000-8000-000000000001|2026-07-22|0"
  When the planner pass runs again inside the same 26-hour horizon
  Then the insert resolves as "ON CONFLICT DO NOTHING"
  And the total count of occurrences for that key remains exactly 1
  And the planner pass log records at least 1 skipped-as-duplicate row
```

**AC-4 — Alternate path: the trigger no longer holds at dispatch time.**

```gherkin
Scenario: A plant watered before the reminder fires is not reminded about
  Given an occurrence for plant "Monstera" is scheduled for 09:00 local
  And I log a watering for "Monstera" at 08:59 local
  When the dispatch pass runs at 09:00 local
  Then gate 4 of the eligibility gate fires
  And the occurrence is cancelled with reason "ALREADY_SATISFIED"
  And the occurrence state becomes "SATISFIED"
  And no push message is submitted for that occurrence
  And no notification centre item is created for that occurrence
```

**AC-5 — Alternate path: two overlapping ticks cannot double-send.**

```gherkin
Scenario: A tick that cannot acquire the advisory lock exits without processing
  Given a dispatch pass is already running and holds the PostgreSQL advisory lock 4711001
  When the next dispatch tick fires 5 minutes later
  Then the new tick logs the event "TICK_SKIPPED_OVERLAP"
  And it records "scheduler_run.outcome" as "SKIPPED_OVERLAP"
  And it modifies no occurrence row
  And no push message is submitted by the new tick
```

**AC-6 — Error path: a provider chunk failure leaves the occurrence recoverable.**

```gherkin
Scenario: An HTTP 500 from the push provider marks the chunk retryable, not lost
  Given 40 push messages are submitted in one chunk of at most 100 messages
  When the Expo Push Service returns HTTP 500 for that chunk
  Then every delivery in that chunk is classified retryable
  And each delivery keeps a non-terminal status with "attempt_count" incremented by exactly 1
  And each delivery is given a "next_attempt_at" from the schedule of BR-NOT-19
  And no occurrence is marked "DISPATCHED" for that chunk
```

**AC-7 — Error path: a single malformed occurrence does not abort the pass.**

```gherkin
Scenario: One failing occurrence is isolated by its own transaction
  Given a dispatch pass has claimed 20 occurrences
  And occurrence number 7 raises a database error during evaluation
  When the pass completes
  Then the transaction for occurrence number 7 is rolled back
  And the remaining 19 occurrences are processed to completion
  And the pass log records exactly 1 failure
  And the error is reported to the error-reporting service
```

**AC-8 — Empty-state path: a brand-new account generates nothing.**

```gherkin
Scenario: A user with no subjects receives no occurrences and sees the empty state
  Given I registered 5 minutes ago
  And I have added no plant, no goal and no meal
  When the planner pass runs
  Then zero occurrences are created for my account
  And my notification centre renders the copy key "notif.centre.empty"
  And my unread badge count is 0
```

#### Definition of Done

- [ ] Planner pass implemented on the cron schedule `2 * * * *` with the 26-hour horizon, the 200-occurrence per-user ceiling and the 200-user batch size of BR-NOT-02.
- [ ] Dispatch pass implemented on the cron schedule `*/5 * * * *` with the 500-occurrence pass ceiling, the 30000-millisecond send budget and the advisory lock `4711001`.
- [ ] Unique constraint on `(user_id, occurrence_key)` created and enforced by a database migration, not by application code alone.
- [ ] Expo submission uses the server SDK chunking helper with at most 100 messages per request, at most 6 concurrent requests and a 100-millisecond inter-chunk pause.
- [ ] Automated tests cover AC-1 to AC-8, including a concurrency test that runs two dispatch passes simultaneously and asserts a single submission.
- [ ] Every user-facing string resolved from the locale catalogue; no literal English copy in scheduler or client code, per BR-NOT-27.
- [ ] Notification content readable by a screen reader on both clients, with no meaning conveyed by colour alone, per NFR-A11Y-08.
- [ ] Structured per-pass log line emitted with every field of BR-NOT-30 clause 3.
- [ ] `modules/notifications.md`, the traceability matrix and the architecture decision record for the planner-plus-dispatcher split updated and cross-linked.

---

### US-NOT-02 — Configure which reminders I get and when

| Field | Value |
| --- | --- |
| Epic | EPIC-NOT-02 Interruption control |
| Persona | PER-01 Aditi Sharma |
| Priority | Must |
| Release | v0.5 Alpha |
| Estimate | 8 points |
| Related FRs | FR-NOT-04, FR-NOT-05 |
| Related UCs | UC-NOT-03, UC-NOT-07 |
| Governing rules | BR-NOT-01, BR-NOT-05, BR-NOT-08, BR-NOT-10 |

**As a** Registered User with all three modules enabled — Aditi Sharma, **I want** to switch each reminder category on or off and choose the local time it is delivered, **so that** the product fits around my working day instead of interrupting it.

#### Acceptance criteria

**AC-1 — Happy path: disabling a category stops its interruptions.**

```gherkin
Scenario: A disabled category is suppressed at the eligibility gate
  Given the category "WATER_INTAKE" is enabled for my account
  And one "WATER_INTAKE" occurrence is scheduled for 14:00 local today
  When I disable "WATER_INTAKE" at 13:30 local
  And the dispatch pass runs at 14:00 local
  Then gate 7 of the eligibility gate fires
  And the "EXPO_PUSH" and "EMAIL" deliveries are suppressed with reason "CATEGORY_DISABLED"
  And no push message is submitted
  And exactly one notification centre item is still written
```

**AC-2 — Happy path: changing a preferred time reschedules future occurrences.**

```gherkin
Scenario: A preferred-time change cancels and re-materialises pending occurrences
  Given my preferred local time for "PLANT_WATERING" is "09:00"
  And one occurrence is scheduled for tomorrow at 09:00 local
  When I set the preferred local time for "PLANT_WATERING" to "19:30"
  Then the pending occurrence is cancelled with reason "PREFERENCE_CHANGED"
  And the response body reports the count of cancelled occurrences
  And the next planner pass materialises a replacement occurrence for tomorrow at 19:30 local
  And the replacement occurrence carries the same "due_local_date"
```

**AC-3 — Alternate path: re-enabling mid-day works without waiting for the planner.**

```gherkin
Scenario: A category re-enabled 10 minutes before a due occurrence still delivers
  Given "PLANT_WATERING" was disabled at 07:00 local
  And one occurrence for 09:00 local was materialised regardless of the toggle
  When I re-enable "PLANT_WATERING" at 08:50 local
  And the dispatch pass runs at 09:00 local
  Then gate 7 does not fire
  And the push message is submitted
```

**AC-4 — Alternate path: registration defaults follow the safety policy.**

```gherkin
Scenario: Fitness and nutrition categories are disabled at registration
  Given I completed registration 1 minute ago
  When I open the notification preferences screen
  Then "WORKOUT", "STEP_GOAL", "MEAL_LOG" and "WATER_INTAKE" are shown as disabled
  And "PLANT_WATERING", "PLANT_CARE_TASK", "PLANT_OVERDUE", "STREAK_AT_RISK", "ACHIEVEMENT" and "WEEKLY_RECAP" are shown as enabled
  And exactly 10 reminder rule rows exist for my account
```

**AC-5 — Validation path: a time off the five-minute grid is rejected.**

```gherkin
Scenario: A preferred time of 08:07 is refused
  When I submit "08:07" as the preferred local time for "PLANT_WATERING"
  Then the request fails with HTTP 422
  And the error code is "VALIDATION_TIME_GRANULARITY"
  And the stored preferred time is unchanged
```

**AC-6 — Validation path: a preferred time inside quiet hours is refused at write time.**

```gherkin
Scenario: A preferred time that would always be deferred is rejected rather than accepted
  Given quiet hours are enabled from "22:30" to "07:30"
  When I submit "23:00" as the preferred local time for "WORKOUT"
  Then the request fails with HTTP 422
  And the error code is "VALIDATION_QUIET_HOURS_CONFLICT"
  And the error message names the window "22:30 to 07:30"
```

**AC-7 — Validation path: unknown and non-configurable categories are refused.**

```gherkin
Scenario: An unknown category key is rejected
  When I submit a preference update for the category "PLANT_SINGING"
  Then the request fails with HTTP 422
  And the error code is "VALIDATION_UNKNOWN_CATEGORY"

Scenario: A time value on an event-driven category is rejected
  When I submit "09:00" as the preferred local time for "ACHIEVEMENT"
  Then the request fails with HTTP 422
  And the error code is "VALIDATION_TIME_NOT_CONFIGURABLE"
```

**AC-8 — Error path: a concurrent preference update is detected.**

```gherkin
Scenario: Two devices editing preferences do not silently overwrite each other
  Given my web client loaded my preferences at 10:00:00Z
  And my mobile client saved a change at 10:00:30Z
  When my web client submits its change with the stale "updated_at" value
  Then the request fails with HTTP 409
  And the error code is "PREFERENCE_CONFLICT"
  And the client refetches and re-renders the current preference object
```

**AC-9 — Offline path: preference editing is blocked, not queued.**

```gherkin
Scenario: A preference change is refused while offline
  Given the device has no network connectivity
  When I toggle the category "MEAL_LOG"
  Then the toggle reverts to its stored value
  And an offline state is shown naming connectivity as the requirement
  And no write is added to the offline outbox
```

#### Definition of Done

- [ ] Ten `ReminderRule` rows created in the same transaction as the user record, with the defaults of BR-NOT-01 clause 6.
- [ ] Preference endpoint validates category membership, five-minute granularity, the `00:00` to `23:55` range, the quiet-hours conflict and the day-of-week subset for `WORKOUT`.
- [ ] Category toggle read at the eligibility gate rather than at materialisation, so AC-3 passes without a planner run.
- [ ] Optimistic concurrency implemented on `updated_at` returning HTTP 409 `PREFERENCE_CONFLICT`.
- [ ] Automated tests cover AC-1 to AC-9, including each of the four validation error codes.
- [ ] Preference screen operable end to end with VoiceOver and TalkBack, every control carrying a programmatic label and a touch target of at least 44 by 44 dp.
- [ ] Time picker renders in the user's locale and honours the 200 percent text-scale target without clipping.
- [ ] Settings help text and every error message resolved from the locale catalogue.
- [ ] Preference API contract documented and cross-linked from `modules/notifications.md` and the traceability matrix.

---

### US-NOT-03 — Not be woken up at night

| Field | Value |
| --- | --- |
| Epic | EPIC-NOT-02 Interruption control |
| Persona | PER-01 Aditi Sharma |
| Priority | Must |
| Release | v0.5 Alpha |
| Estimate | 5 points |
| Related FRs | FR-NOT-06 |
| Related UCs | UC-NOT-03, UC-NOT-07 |
| Governing rules | BR-NOT-08, BR-NOT-10, BR-NOT-12 |

**As a** Registered User who sleeps between 22:30 and 07:30 — Aditi Sharma, **I want** a quiet-hours window that correctly covers the hours on both sides of midnight, **so that** no reminder ever wakes me.

#### Acceptance criteria

**AC-1 — Happy path: an occurrence inside the window is deferred, not dropped.**

```gherkin
Scenario: A watering reminder due at 23:10 local is deferred to the end of the window
  Given my timezone is "Asia/Kolkata"
  And quiet hours are enabled from "22:30" to "07:30"
  And the deterministic jitter for my user identifier is 3 minutes
  And one "PLANT_WATERING" occurrence becomes due at 23:10 local
  When the dispatch pass runs at 23:10 local
  Then the occurrence state remains "SCHEDULED"
  And its "due_at" is rewritten to 07:33 local on the next day
  And its "occurrence_key" is unchanged
  And its "due_local_date" is unchanged
  And its "original_due_at" is unchanged
```

**AC-2 — Happy path: the window is evaluated across midnight.**

```gherkin
Scenario: A cross-midnight window covers times after midnight
  Given quiet hours are enabled from "22:30" to "07:30"
  When an occurrence becomes due at 02:30 local
  Then the membership test "t >= s OR t < e" evaluates true
  And the occurrence is treated as inside quiet hours
```

**AC-3 — Boundary path: the start is inclusive and the end is exclusive.**

```gherkin
Scenario: A reminder due exactly at the window end is delivered
  Given quiet hours are enabled from "22:00" to "07:00"
  When an occurrence becomes due at exactly 07:00 local
  Then it is treated as outside quiet hours
  And the push message is submitted

Scenario: A reminder due exactly at the window start is quiet
  Given quiet hours are enabled from "22:00" to "07:00"
  When an occurrence becomes due at exactly 22:00 local
  Then it is treated as inside quiet hours
```

**AC-4 — Alternate path: a short-lived category is suppressed rather than deferred.**

```gherkin
Scenario: A water-pacing nudge is not released the following morning
  Given quiet hours are enabled from "22:30" to "07:30"
  And the category "WATER_INTAKE" has a staleness cut-off of 1 hour
  And the category "WATER_INTAKE" is same-day only
  And one "WATER_INTAKE" occurrence becomes due at 23:10 local
  When the dispatch pass runs at 23:10 local
  Then the "EXPO_PUSH" and "EMAIL" deliveries are suppressed with reason "QUIET_HOURS"
  And no future "due_at" is written to the occurrence
  And exactly one notification centre item is written at the original time
```

**AC-5 — Alternate path: the morning release is spread across five minutes.**

```gherkin
Scenario: Deferred occurrences for many users do not all fire in one tick
  Given 200 users share a quiet-hours window ending at "07:00" local in one timezone
  And each user has at least one deferred occurrence
  When the deferral instants are computed
  Then every instant falls in the local range 07:00 to 07:04 inclusive
  And each user's offset equals "hash(user_id) mod 5" whole minutes
  And re-running the computation for the same user produces the same offset
```

**AC-6 — Alternate path: disabling quiet hours releases no backlog.**

```gherkin
Scenario: Turning the window off changes future evaluation only
  Given 4 occurrences were deferred to 07:03 local tomorrow
  When I disable quiet hours at 23:50 local today
  Then those 4 occurrences keep their rewritten "due_at" of 07:03 local
  And no occurrence is delivered before 07:03 local
```

**AC-7 — Validation path: an empty window is refused.**

```gherkin
Scenario: A start equal to the end is ambiguous and is rejected
  When I submit quiet hours with start "22:00" and end "22:00"
  Then the request fails with HTTP 422
  And the error code is "VALIDATION_QUIET_HOURS_EMPTY"
  And the error message directs me to do-not-disturb instead
```

**AC-8 — Timezone path: a window containing a daylight-saving transition is evaluated on wall time.**

```gherkin
Scenario: A 22:00 to 07:00 window is correct on both transition dates
  Given my timezone is "Europe/London"
  And quiet hours are enabled from "22:00" to "07:00"
  When the window is evaluated on the spring-forward date 2027-03-28
  Then the window spans 8 hours of elapsed time and every local wall time from 22:00 to 06:59 is quiet
  When the window is evaluated on the autumn fall-back date 2027-10-31
  Then the window spans 10 hours of elapsed time and every local wall time from 22:00 to 06:59 is quiet
```

**AC-9 — Channel path: the in-app record is never suppressed.**

```gherkin
Scenario: Quiet hours never remove information
  Given quiet hours are enabled from "22:30" to "07:30"
  And 3 occurrences become due between 23:00 and 05:00 local
  When each dispatch pass runs
  Then no push message is submitted for those 3 occurrences during the window
  And 3 notification centre items exist, ordered by their original due instants
```

#### Definition of Done

- [ ] Membership predicate implemented once in the shared package with both the non-crossing and the cross-midnight branch, and consumed unchanged by the API, the dispatcher and both clients.
- [ ] Deferral rewrites `due_at` only, preserving `occurrence_key`, `due_local_date` and `original_due_at`.
- [ ] Deterministic jitter implemented as a pure function of the user identifier, with a test asserting reproducibility across two runs.
- [ ] Suppression branch of BR-NOT-08 clause 4 implemented for both conditions: cut-off breach and same-day-only date rollover.
- [ ] Automated tests cover AC-1 to AC-9, including both daylight-saving dates of AC-8 driven by the runtime IANA database rather than hard-coded constants.
- [ ] Quiet-hours control announces its current window as text to a screen reader, and conveys the enabled state by label as well as by colour.
- [ ] Quiet-hours copy and the validation error resolved from the locale catalogue.
- [ ] Behaviour documented in `modules/notifications.md` section 5 and cross-linked from the settings documentation.

---

### US-NOT-04 — Pause every notification for a while

| Field | Value |
| --- | --- |
| Epic | EPIC-NOT-02 Interruption control |
| Persona | PER-03 Mia Castellano |
| Priority | Should |
| Release | v1.0 MVP |
| Estimate | 3 points |
| Related FRs | FR-NOT-07 |
| Related UCs | UC-NOT-03, UC-NOT-07 |
| Governing rules | BR-NOT-05, BR-NOT-09 |

**As a** Registered User working a rotating night shift — Mia Castellano, **I want** one do-not-disturb switch with an optional automatic expiry, **so that** I can silence everything for a shift or a holiday without reconfiguring ten categories.

#### Acceptance criteria

**AC-1 — Happy path: do-not-disturb suppresses push and email only.**

```gherkin
Scenario: An active do-not-disturb state silences interruptions but keeps the record
  Given do-not-disturb is active with "dnd_until_utc" set to null
  When any occurrence becomes due
  Then gate 8 of the eligibility gate fires
  And the "EXPO_PUSH" and "EMAIL" deliveries are suppressed with reason "DO_NOT_DISTURB"
  And the "IN_APP" delivery is not suppressed
  And exactly one notification centre item is written and counted as unread
```

**AC-2 — Happy path: each bounded option stores the stated expiry.**

```gherkin
Scenario: The 8-hour option expires exactly 8 hours later
  Given the current instant is 2026-07-21T09:00:00Z
  When I activate do-not-disturb with the option "8_HOURS"
  Then "dnd_until_utc" is stored as 2026-07-21T17:00:00Z
  And the settings screen states the remaining duration rounded down to the hour
```

**AC-3 — Alternate path: expiry is lazy and needs no timer.**

```gherkin
Scenario: An elapsed expiry is treated as inactive by the gate
  Given do-not-disturb was activated with the option "8_HOURS" at 2026-07-21T09:00:00Z
  And "dnd_enabled" is still stored as true
  When the dispatch pass runs at 2026-07-21T17:01:00Z
  Then gate 8 does not fire
  And notifications are delivered normally
  And the next preference write clears "dnd_enabled"
```

**AC-4 — Alternate path: switching it off releases nothing.**

```gherkin
Scenario: There is no accumulated queue to release
  Given do-not-disturb suppressed 6 occurrences today
  When I switch do-not-disturb off at 18:00 local
  Then zero suppressed occurrences are re-sent
  And those 6 notification centre items remain visible with reason "DO_NOT_DISTURB"
```

**AC-5 — Alternate path: the diagnostic bypasses the state.**

```gherkin
Scenario: A test notification is delivered while do-not-disturb is active
  Given do-not-disturb is active indefinitely
  When I request a test notification from settings
  Then the test push message is submitted to every active device token
  And no other category is delivered while do-not-disturb remains active
```

**AC-6 — Validation path: an out-of-range expiry is refused.**

```gherkin
Scenario: An until-date more than 365 days ahead is rejected
  When I activate do-not-disturb with the option "UNTIL_DATE" and an instant 400 days in the future
  Then the request fails with HTTP 422
  And the error code is "VALIDATION_DND_RANGE"
  And do-not-disturb remains inactive

Scenario: An until-date in the past is rejected
  When I activate do-not-disturb with the option "UNTIL_DATE" and an instant 1 minute in the past
  Then the request fails with HTTP 422
  And the error code is "VALIDATION_DND_RANGE"
```

**AC-7 — Empty-state path: the settings banner states the remaining time.**

```gherkin
Scenario: The active state is always visible and always reversible
  Given do-not-disturb is active with an expiry 3 hours and 40 minutes in the future
  When I open the settings screen on either client
  Then a banner states the remaining duration as text
  And the banner exposes a control that deactivates do-not-disturb in one interaction
```

#### Definition of Done

- [ ] Five `dnd_option` values implemented with the exact stored expiries of BR-NOT-09 clause 1.
- [ ] Active test implemented as `dnd_enabled = true AND (dnd_until_utc IS NULL OR dnd_until_utc > now())` evaluated at gate 8, using the database clock.
- [ ] No timer, no scheduled job and no fifth cron entry introduced; expiry proven lazy by a test that advances the clock without running a job.
- [ ] Test-notification bypass implemented per BR-NOT-26 and covered by AC-5.
- [ ] Automated tests cover AC-1 to AC-7, including both `VALIDATION_DND_RANGE` branches.
- [ ] Settings banner announced through the accessibility live region and readable at 200 percent text scale without clipping.
- [ ] Remaining-duration copy resolved from the locale catalogue with ICU pluralisation for hours and minutes.
- [ ] Do-not-disturb behaviour documented in the settings documentation and cross-linked to `FR-NOT-07`.

---

### US-NOT-05 — Not be flooded on a busy day

| Field | Value |
| --- | --- |
| Epic | EPIC-NOT-03 Volume control |
| Persona | PER-01 Aditi Sharma |
| Priority | Must |
| Release | v1.0 MVP |
| Estimate | 5 points |
| Related FRs | FR-NOT-12 |
| Related UCs | UC-NOT-03 |
| Governing rules | BR-NOT-01, BR-NOT-13 |

**As a** Registered User with eleven plants and three modules enabled — Aditi Sharma, **I want** a hard ceiling on how many push notifications I receive in one local day, **so that** the product stays useful instead of becoming noise I mute.

#### Acceptance criteria

**AC-1 — Happy path: the cap suppresses push once it is reached.**

```gherkin
Scenario: The ninth push of the day is suppressed under the default tier
  Given my volume tier is "BALANCED" giving a stored cap of 8
  And 8 push messages have already been accepted by the provider for my local date
  When a "WATER_INTAKE" occurrence becomes eligible
  Then gate 10 of the eligibility gate fires
  And the "EXPO_PUSH" delivery is suppressed with reason "DAILY_CAP_REACHED"
  And the "IN_APP" delivery is not suppressed
  And the notification centre item counts towards my unread badge
```

**AC-2 — Happy path: priority weight decides who wins the last slot.**

```gherkin
Scenario: The overdue plant outranks the water nudge
  Given my stored cap is 8
  And 7 push messages have already been accepted for my local date
  And one "PLANT_OVERDUE" occurrence with priority weight 10 is eligible in this pass
  And one "WATER_INTAKE" occurrence with priority weight 100 is eligible in the same pass
  When the dispatch pass runs
  Then the "PLANT_OVERDUE" push message is submitted
  And the "WATER_INTAKE" push is suppressed with reason "DAILY_CAP_REACHED"
  And the ordering is reproducible across repeated runs of the same fixture
```

**AC-3 — Counting path: fan-out, grouping, retries and tests count correctly.**

```gherkin
Scenario: Five devices count as one notification
  Given I have 5 active device push tokens and a stored cap of 8
  When one occurrence is submitted to all 5 devices
  Then my daily counter increases by exactly 1

Scenario: A grouped notification counts as one
  When one grouped notification collapsing 6 subjects is accepted by the provider
  Then my daily counter increases by exactly 1

Scenario: A retry of an already-counted delivery counts nothing
  Given a delivery was already counted and then failed with a retryable error
  When attempt 2 is accepted by the provider
  Then my daily counter is unchanged

Scenario: A test notification counts nothing
  Given 8 push messages have already been accepted for my local date
  When I request a test notification
  Then it is delivered
  And my daily counter remains 8
```

**AC-4 — Timezone path: the counter is keyed to the local date.**

```gherkin
Scenario: The cap resets at local midnight, not at UTC midnight
  Given my timezone is "Pacific/Auckland"
  And my daily counter for the local date 2026-11-22 is 8
  When the local date advances to 2026-11-23
  Then the counter for 2026-11-23 starts at 0
  And the counter for 2026-11-22 is not decremented and is not deleted
```

**AC-5 — Alternate path: lowering the tier takes effect immediately.**

```gherkin
Scenario: A mid-day tier change applies to the remainder of the same local day
  Given my volume tier is "HIGH" giving a stored cap of 12
  And 6 push messages have been accepted for my local date
  When I change my volume tier to "LOW" giving a stored cap of 4
  And a further occurrence becomes eligible
  Then its push is suppressed with reason "DAILY_CAP_REACHED"
  And my daily counter is not reset by the tier change
```

**AC-6 — Error path: a locked counter fails towards fewer notifications.**

```gherkin
Scenario: A counter lock timeout is treated as the cap being reached
  Given the daily counter row cannot be locked within 500 milliseconds
  When the dispatch pass evaluates an occurrence for that user
  Then the cap is treated as reached for that pass
  And the "EXPO_PUSH" delivery is suppressed with reason "DAILY_CAP_REACHED"
  And the pass log records the suppression under its reason counter
```

**AC-7 — Accepted-consequence path: a late high-priority item is not privileged.**

```gherkin
Scenario: The counter never decrements, so a late overdue alert is still capped
  Given my stored cap is 8 and 8 push messages have been accepted for my local date
  When a "PLANT_OVERDUE" occurrence becomes eligible at 18:00 local
  Then its push is suppressed with reason "DAILY_CAP_REACHED"
  And its notification centre item appears immediately
  And it is ordered first among eligible occurrences on the next local date
```

#### Definition of Done

- [ ] Three-value tier control implemented over the existing `daily_notification_cap` column with the stored values 4, 8 and 12 and the default `BALANCED`.
- [ ] Counter keyed by `(user_id, due_local_date)` using the user-local date, incremented atomically, never decremented, never reset by a preference change.
- [ ] Deterministic ordering by `priority_weight`, then effective due instant, then identifier, implemented and covered by a reproducibility test.
- [ ] Counter lock implemented with a 500-millisecond timeout and the fail-safe branch of AC-6.
- [ ] Automated tests cover AC-1 to AC-7, including all four counting rules of AC-3.
- [ ] Tier control labelled with its plain-language description, operable by screen reader, and conveying the selected tier by text rather than by colour.
- [ ] Tier labels and the cap explanation resolved from the locale catalogue and reviewed against the safe-language rules of BR-NOT-27.
- [ ] Cap behaviour and the never-decrement consequence documented in `modules/notifications.md` and in the settings help text.

---

### US-NOT-06 — One notification for many due plants

| Field | Value |
| --- | --- |
| Epic | EPIC-NOT-03 Volume control |
| Persona | PER-02 Marcus Oyelaran |
| Priority | Should |
| Release | v1.0 MVP |
| Estimate | 5 points |
| Related FRs | FR-NOT-13 |
| Related UCs | UC-NOT-04 |
| Governing rules | BR-NOT-01, BR-NOT-14, BR-NOT-20, BR-NOT-27 |

**As a** Registered User with 38 plants — Marcus Oyelaran, **I want** several plants that come due in the same dispatch pass collapsed into one notification, **so that** my lock screen shows one banner instead of nine.

#### Acceptance criteria

**AC-1 — Happy path: three or more same-category occurrences collapse into one.**

```gherkin
Scenario: Five due plants produce exactly one push notification
  Given 5 "PLANT_WATERING" occurrences for my account are eligible in the same dispatch pass
  And the subject names are "Monstera", "Fiddle Leaf Fig", "Boston Fern", "Basil" and "Aloe Vera"
  When the dispatch pass runs
  Then exactly 1 push message is submitted for those 5 occurrences
  And its title resolves the key "notif.group.watering.title" to "5 plants need water"
  And its body resolves the key "notif.group.watering.body" to "Monstera, Fiddle Leaf Fig and 3 more"
  And my daily counter increases by exactly 1
```

**AC-2 — Boundary path: two occurrences are never grouped.**

```gherkin
Scenario: The grouping threshold is exactly 3
  Given 2 "PLANT_WATERING" occurrences for my account are eligible in the same dispatch pass
  When the dispatch pass runs
  Then 2 individual push messages are submitted
  And no grouped notification centre item is created

Scenario: Exactly 3 occurrences are grouped
  Given 3 "PLANT_WATERING" occurrences for my account are eligible in the same dispatch pass
  When the dispatch pass runs
  Then exactly 1 push message is submitted
```

**AC-3 — Alternate path: grouping never spans two categories.**

```gherkin
Scenario: Plants and achievements are not collapsed together
  Given 3 "PLANT_WATERING" occurrences and 3 "ACHIEVEMENT" occurrences are eligible in the same pass
  When the dispatch pass runs
  Then exactly 2 push messages are submitted
  And one carries the key "notif.group.watering.title"
  And the other carries the key "notif.group.achievement.title"
```

**AC-4 — Alternate path: a group opens the filtered list, not an entity.**

```gherkin
Scenario: The grouped deep link targets a filtered list route
  Given a grouped "PLANT_WATERING" notification was delivered
  When I open it
  Then the client navigates to the route "plantpal://plants?filter=due-today"
  And the grouped notification centre item is marked read
```

**AC-5 — Alternate path: members stay individually actionable.**

```gherkin
Scenario: Per-subject history survives grouping
  Given a grouped notification collapsed 5 "PLANT_WATERING" occurrences
  When I open the notification centre
  Then each of the 5 member occurrences is listed as an individually actionable item
  And each member occurrence has state "DISPATCHED" with "grouped_with_id" set to the leading occurrence
```

**AC-6 — Error path: a group that shrinks below the threshold degrades within the same pass.**

```gherkin
Scenario: A deletion between grouping and submission does not delay the survivors
  Given 3 "PLANT_WATERING" occurrences were grouped in this pass
  And 1 of those plants is deleted before the chunk is submitted
  When membership is recomputed immediately before submission
  Then the group is discarded
  And the remaining 2 occurrences are submitted as individual push messages in the same pass
  And the deleted subject's occurrence is cancelled with reason "SUBJECT_DELETED"
```

**AC-7 — Error path: a group whose subjects have all gone sends nothing.**

```gherkin
Scenario: Every member deleted means no notification at all
  Given 4 "PLANT_WATERING" occurrences were grouped in this pass
  And all 4 plants are deleted before the chunk is submitted
  When membership is recomputed immediately before submission
  Then the group is discarded
  And all 4 occurrences are cancelled with reason "SUBJECT_DELETED"
  And zero push messages are submitted for that group
```

**AC-8 — Internationalisation path: the count is an ICU plural and names are truncated.**

```gherkin
Scenario: A single remaining subject renders in the singular
  Given 3 "PLANT_WATERING" occurrences are grouped
  Then the body renders "and 1 more" from the same catalogue entry that renders "and 3 more"

Scenario: A long subject name is truncated deterministically
  Given a subject name is 40 characters long
  When it is rendered into a grouped body
  Then it is truncated to 24 characters followed by exactly 1 ellipsis character
```

#### Definition of Done

- [ ] Grouping predicate implemented for the threshold of 3 or more, restricted to `PLANT_WATERING`, `PLANT_CARE_TASK`, `PLANT_OVERDUE` and `ACHIEVEMENT`, and never spanning categories.
- [ ] Leading notification centre item references its member occurrence identifiers; each member records `grouped_with_id`.
- [ ] Grouped deep links resolve to the filtered list routes of BR-NOT-20 clause 3 for all four groupable categories.
- [ ] Late membership recomputation implemented immediately before submission, with the same-pass degradation of AC-6.
- [ ] Automated tests cover AC-1 to AC-8, including the two boundary counts of AC-2.
- [ ] Grouped notification announced by a screen reader as a single item whose accessible name states the total count in words.
- [ ] Four grouped title keys and four grouped body keys added to the locale catalogue with ICU plural arguments; no literal English copy in code.
- [ ] Grouping behaviour and its cap interaction documented in `modules/notifications.md` and cross-linked from the traceability matrix.

---

### US-NOT-07 — Tap a notification and land exactly where I need to be

| Field | Value |
| --- | --- |
| Epic | EPIC-NOT-05 Notification surfaces |
| Persona | PER-01 Aditi Sharma |
| Priority | Must |
| Release | v0.1 Walking Skeleton |
| Estimate | 8 points |
| Related FRs | FR-NOT-19 |
| Related UCs | UC-NOT-08 |
| Governing rules | BR-NOT-20, BR-NOT-21, BR-NOT-31 |

**As a** Registered User reading a notification between meetings — Aditi Sharma, **I want** the notification to open the exact screen and entity it refers to, **so that** I can act in one interaction instead of navigating there myself.

#### Acceptance criteria

**AC-1 — Happy path: a single-subject notification opens its entity.**

```gherkin
Scenario: A watering notification opens the plant detail screen
  Given I received a "PLANT_WATERING" notification for the plant "9f1c2a6e-0000-4000-8000-000000000001"
  And its payload carries the deep link "plantpal://plants/9f1c2a6e-0000-4000-8000-000000000001?nid=<uuid>&src=notif"
  When I open the notification
  Then the client navigates to the plant detail route for that identifier
  And the notification centre item identified by "nid" is marked read
```

**AC-2 — Happy path: a cold start routes to the target, not to the home screen.**

```gherkin
Scenario: Opening a notification from a terminated application lands on the target
  Given the mobile application is not running
  When I open a "PLANT_CARE_TASK" notification
  Then the application launches
  And the navigation stack is built before navigation
  And the final visible route is the care-task detail route named in the payload
```

**AC-3 — Alternate path: an unauthenticated open resumes after sign-in.**

```gherkin
Scenario: A deep link followed while signed out is stored and resumed
  Given I am signed out
  When I open a notification deep link
  Then the client navigates to the sign-in screen
  And the link is stored for exactly 15 minutes
  And after a successful sign-in within 15 minutes the original target route opens

Scenario: A stored link older than 15 minutes is discarded
  Given a deep link was stored 16 minutes ago
  When another account signs in on the same device
  Then the stored link is discarded
  And the client navigates to the dashboard
```

**AC-4 — Error path: a missing subject falls back to the owning list.**

```gherkin
Scenario: A deleted plant produces a graceful fallback
  Given I received a "PLANT_WATERING" notification for a plant
  And I deleted that plant before opening the notification
  When I open the notification
  Then the client navigates to the plant list screen
  And the text of the key "notif.deeplink.missingEntity" is shown, reading "That item is no longer available."
  And the notification centre item is marked read with "subject_missing" set
```

**AC-5 — Error path: another user's entity is indistinguishable from a missing one.**

```gherkin
Scenario: A deep link to an entity owned by another account cannot be probed
  Given a deep link names an entity identifier owned by a different account
  When I open it while authenticated
  Then the API returns HTTP 404
  And the API never returns HTTP 403
  And the client navigates to the owning module's list screen with the missing-item text
```

**AC-6 — Error path: an unknown or malformed route never breaks the client.**

```gherkin
Scenario: A route this application version does not understand
  Given I received a notification whose route is not in this version's route table
  When I open it
  Then the client navigates to the notification centre
  And the text "Update PlantPal+ to open this item." is shown
  And the event "WARN_UNKNOWN_DEEPLINK" is logged
  And the application does not crash and shows no error dialogue
```

**AC-7 — Offline path: a cached entity still renders.**

```gherkin
Scenario: An offline open of a cached plant renders from the persisted cache
  Given the device has no network connectivity
  And the target plant is present in the persisted query cache
  When I open the notification
  Then the plant detail screen renders from the cache
  And the text "You are offline. This is the last version we saved." is shown

Scenario: An offline open of an uncached entity shows the offline state
  Given the device has no network connectivity
  And the target entity is absent from the persisted query cache
  When I open the notification
  Then the standard offline state is shown with a retry action
  And the notification centre item is not marked read
```

**AC-8 — Payload path: the budget is enforced by dropping optional fields in order.**

```gherkin
Scenario: An oversized payload drops optional fields rather than failing
  Given a composed push message exceeds 4096 bytes measured in UTF-8
  When the payload is reduced
  Then "groupCount" is dropped first, then "subjectName", then "params", then "categoryKey"
  And "nid", "deepLink", "titleKey" and "bodyKey" are never dropped
  And if the message still exceeds 4096 bytes the body is truncated at a whole grapheme boundary followed by 1 ellipsis character
```

#### Definition of Done

- [ ] Route table of BR-NOT-20 clause 2 implemented for all eleven categories, plus the four grouped routes of clause 3.
- [ ] Both link forms registered: the `plantpal://` application scheme through the Expo configuration, and the HTTPS form on the production web host.
- [ ] Deep link composed once at materialisation and copied byte-for-byte into the notification centre item, so a centre item cannot navigate elsewhere than its push did.
- [ ] Fallback matrix of BR-NOT-21 implemented for all nine conditions, with the 15-minute stored-link window.
- [ ] Automated tests cover AC-1 to AC-8, including a cold-start routing test on each platform.
- [ ] Every fallback screen reachable and announced by a screen reader, with focus moved to the destination heading on navigation.
- [ ] Fallback copy resolved from the locale catalogue; no literal English string in the routing layer.
- [ ] Route table and fallback matrix documented and cross-linked from `modules/notifications.md` and `use-cases/notifications.md`.

---

### US-NOT-08 — See what I would have been told, on the web

| Field | Value |
| --- | --- |
| Epic | EPIC-NOT-05 Notification surfaces |
| Persona | PER-04 Harold "Hal" Whitfield |
| Priority | Must |
| Release | v0.5 Alpha |
| Release note | The notification centre, FR-NOT-20, delivers in v0.5. The email digest, FR-NOT-23, is a Should and delivers in v1.0; AC-5 to AC-8 are therefore v1.0 criteria. |
| Estimate | 13 points |
| Related FRs | FR-NOT-20, FR-NOT-23 |
| Related UCs | UC-NOT-10, UC-NOT-04 |
| Governing rules | BR-NOT-24, BR-NOT-25, BR-NOT-27, BR-NOT-28 |

**As a** Registered User who reads the product on a zoomed browser with a screen reader — Harold "Hal" Whitfield, **I want** a complete in-app list of my reminders plus an optional email digest, **so that** the absence of web push in v1.0 never leaves me uninformed.

#### Acceptance criteria

**AC-1 — Happy path: the centre lists history in reverse chronological order.**

```gherkin
Scenario: The first page returns 20 items newest first
  Given 45 notification centre items exist for my account
  When I request the notification centre without a cursor and without a limit
  Then exactly 20 items are returned
  And they are ordered by "created_at" descending then by identifier descending
  And an opaque cursor is returned for the next page
```

**AC-2 — Happy path: read state and the unread badge behave as specified.**

```gherkin
Scenario: Opening an item marks it read
  Given an item is unread
  When I open it, including through a deep link
  Then its "read_at" is set
  And my unread badge count decreases by exactly 1

Scenario: Mark all read is bounded to the current filter
  Given 12 unread items exist of which 5 have module "PLANT"
  When I apply the filter "module=PLANT" and choose mark all read
  Then exactly 5 items are marked read
  And the response reports the affected row count as 5
  And 7 items remain unread

Scenario: A large unread count is displayed as 99 plus
  Given 143 unread items exist
  Then the badge renders "99+"
```

**AC-3 — Alternate path: suppressed occurrences are visible, so nothing is lost.**

```gherkin
Scenario: Every volume control is non-lossy
  Given 3 occurrences were suppressed today with reason "DAILY_CAP_REACHED"
  And 2 occurrences were suppressed today with reason "QUIET_HOURS"
  When I open the notification centre
  Then all 5 items are listed
  And each states its suppression reason as text rather than by colour alone
```

**AC-4 — Validation path: paging and filter inputs are bounded.**

```gherkin
Scenario: An oversized page request is clamped without an error
  When I request the notification centre with a limit of 500
  Then the response returns at most 50 items
  And the response status is HTTP 200

Scenario: An unknown module filter is rejected
  When I request the notification centre with "module=GARDENING"
  Then the request fails with HTTP 422
  And the error code is "VALIDATION_UNKNOWN_MODULE"

Scenario: Another user's item is not disclosed
  When I request a notification centre item belonging to a different account
  Then the response is HTTP 404
  And the response is never HTTP 403
```

**AC-5 — Happy path, v1.0: a daily digest is sent when there is something to report.**

```gherkin
Scenario: A daily digest lists the day's items
  Given my digest mode is "DAILY" and my digest time is "07:30" local
  And my email address is verified and "email_deliverable" is true
  And 3 notification centre items were generated for me in the covered period
  When the dispatch pass runs at 07:30 local
  Then exactly 1 email is sent to my address
  And it lists all 3 items
  And it carries the "List-Unsubscribe" and "List-Unsubscribe-Post" headers
  And it carries the not-medical-advice footer and links to the privacy policy and terms
```

**AC-6 — Empty-state path, v1.0: an empty digest is not sent.**

```gherkin
Scenario: No items means no email
  Given my digest mode is "DAILY"
  And zero notification centre items were generated for me in the covered period
  When the digest send time is reached
  Then no email is sent
  And no "EMAIL" delivery row is created

Scenario: A weekly recap is sent only when the week contains activity
  Given my digest mode is "WEEKLY"
  And I logged zero events of any kind in the covered ISO week
  When Monday 08:00 local is reached
  Then no email is sent
```

**AC-7 — Alternate path, v1.0: one-click unsubscribe works without authentication.**

```gherkin
Scenario: The unsubscribe token grants exactly one capability
  Given I received a digest email containing an HMAC-SHA256 signed unsubscribe token
  When I follow the unsubscribe link while signed out
  Then my "digest_mode" is set to "OFF"
  And a confirmation page is shown
  And no other field of my account is mutated by that token

Scenario: An expired unsubscribe token is refused
  Given an unsubscribe token was issued 91 days ago
  When I follow its link
  Then the request is refused
  And my "digest_mode" is unchanged
```

**AC-8 — Error path, v1.0: address state and the free-tier ceiling are handled.**

```gherkin
Scenario: An unverified address suppresses the digest
  Given my email address is not verified
  And my digest mode is "DAILY"
  When the digest send time is reached
  Then the "EMAIL" delivery is suppressed with reason "EMAIL_NOT_VERIFIED"
  And a notice is shown in settings

Scenario: The global daily ceiling defers rather than drops
  Given 100 digest emails have already been sent across all accounts today
  When my digest becomes due
  Then my "EMAIL" delivery records reason "EMAIL_QUOTA_DEFERRED"
  And it is attempted again on the following day
  And my push and in-app deliveries are unaffected
```

**AC-9 — Offline and empty-state path: the centre degrades honestly.**

```gherkin
Scenario: A first-run account sees the empty state
  Given zero notification centre items exist for my account
  When I open the notification centre
  Then the copy key "notif.centre.empty" renders as "No notifications yet. Reminders will appear here once you add a plant, set a goal, or log a meal."

Scenario: An offline centre renders the last cached page
  Given the client has no network connectivity
  When I open the notification centre
  Then the last cached page renders with the offline indicator
  And a mark-read action is refused rather than queued
```

#### Definition of Done

- [ ] Notification centre endpoint implemented with cursor paging, the default limit of 20, the clamp at 50, the `unreadOnly` filter and the five-value `module` filter.
- [ ] One centre item written per occurrence reaching gate 5 or beyond, including every suppressed occurrence.
- [ ] Retention pass deletes items 90 days after creation; the figure is stated identically in the privacy policy.
- [ ] Email digest implemented with the daily and weekly modes, the 30-item cap, the empty-digest rules, the 100-per-day global ceiling and the signed unsubscribe token valid for 90 days.
- [ ] Automated tests cover AC-1 to AC-9, including the HTTP 404 ownership test and both unsubscribe branches.
- [ ] Centre operable end to end with NVDA at 175 percent browser zoom and with VoiceOver at the largest non-accessibility Dynamic Type size; status, category and stale state conveyed by text label or icon shape in addition to colour; every item carries a programmatic accessible name.
- [ ] Email template passes a plain-text alternative check and states every quantity in the user's preferred unit system while storing metric SI.
- [ ] All centre and email copy resolved from the locale catalogue and reviewed against the safe-language rules of BR-NOT-27.
- [ ] Retention figure, digest constants and the web-channel rationale under D-10 documented and cross-linked from `modules/notifications.md`.

---

### US-NOT-09 — Act straight from the notification

| Field | Value |
| --- | --- |
| Epic | EPIC-NOT-06 Acting on a notification |
| Persona | PER-05 Sofia Lindqvist |
| Priority | Should |
| Release | v1.0 MVP |
| Estimate | 8 points |
| Related FRs | FR-NOT-21 |
| Related UCs | UC-NOT-09 |
| Governing rules | BR-NOT-21, BR-NOT-23 |

**As a** Registered User on a budget Android device with intermittent connectivity — Sofia Lindqvist, **I want** to water a plant or add a glass of water directly from the notification, **so that** logging costs me one interaction and works even on the tram.

#### Acceptance criteria

**AC-1 — Happy path: a write-type action logs without opening a screen.**

```gherkin
Scenario: Water now logs a watering from the notification
  Given I received a "PLANT_WATERING" notification for the plant "Monstera"
  When I choose the action "WATER_NOW"
  Then a watering entry is written for "Monstera" through the shared idempotent write path
  And the request carries a client-generated UUID version 4 idempotency key
  And the notification centre item is marked read
  And no screen is opened
```

**AC-2 — Happy path: completing an action cancels the sibling occurrence.**

```gherkin
Scenario: A user is never reminded about something they just did
  Given a "PLANT_WATERING" occurrence and a "PLANT_OVERDUE" occurrence exist for "Monstera" on the same "due_local_date"
  And the "PLANT_OVERDUE" occurrence is still "SCHEDULED"
  When I choose "WATER_NOW" on the watering notification
  Then the "PLANT_OVERDUE" occurrence is cancelled with reason "ALREADY_SATISFIED"
  And its occurrence state becomes "SATISFIED"
```

**AC-3 — Idempotency path: a double tap does not double-log.**

```gherkin
Scenario: Two submissions of the same action produce one entry
  Given I choose "WATER_NOW" twice within 2 seconds
  And both requests carry the same idempotency key
  When both requests reach the server
  Then exactly 1 watering entry exists for that plant and that local date
  And both responses report the same entry identifier
```

**AC-4 — Units path: labels follow the preference, storage stays metric.**

```gherkin
Scenario: An imperial user sees fluid ounces while the stored value stays millilitres
  Given my unit preference is imperial
  When I view a "WATER_INTAKE" notification
  Then the primary action is labelled "Add 8 fl oz"
  And choosing it stores the value 250 millilitres

Scenario: A metric user sees millilitres
  Given my unit preference is metric
  Then the same action is labelled "Add 250 ml"
```

**AC-5 — Offline path: a write-type action is queued and applied once.**

```gherkin
Scenario: An offline water-now is queued and flushed without duplication
  Given the device has no network connectivity
  When I choose "WATER_NOW"
  Then the write is added to the offline outbox with its idempotency key and a client timestamp
  And the notification centre item is optimistically marked handled with a pending indicator
  When connectivity returns and the outbox flushes
  Then the server upserts by idempotency key
  And exactly 1 watering entry exists for that plant and that local date
```

**AC-6 — Offline path: a non-write action is refused rather than queued.**

```gherkin
Scenario: Only append-only logging actions are queueable
  Given the device has no network connectivity
  When I choose the action "OPEN_ENTITY" on a notification whose entity is not cached
  Then the standard offline state is shown with a retry action
  And nothing is added to the offline outbox
```

**AC-7 — Error path: an action on a deleted subject fails explicitly.**

```gherkin
Scenario: The subject was deleted between display and action
  Given the plant referenced by a notification has been deleted
  When I choose "WATER_NOW"
  Then the request fails with HTTP 410
  And the error code is "SUBJECT_GONE"
  And the occurrence is cancelled with reason "SUBJECT_DELETED"
  And the text of the key "notif.deeplink.missingEntity" is shown
```

**AC-8 — Validation path: an action outside the category matrix is refused.**

```gherkin
Scenario: An action not listed for the category is rejected
  When I submit the action "LOG_WATER" for a "PLANT_WATERING" notification
  Then the request fails with HTTP 422
  And the error code is "VALIDATION_ACTION_NOT_ALLOWED"
  And no write is performed in any module
```

**AC-9 — Platform path: the two highest-value actions always survive.**

```gherkin
Scenario: Operating-system button limits do not hide the primary action
  Given a "PLANT_WATERING" notification is rendered on a collapsed iOS banner that displays at most 2 action buttons
  Then the buttons rendered are "WATER_NOW" and "SNOOZE" in that order
  And "OPEN_ENTITY" and "DISMISS" remain reachable from the notification centre
```

#### Definition of Done

- [ ] Quick action matrix of BR-NOT-23 implemented for all eleven categories, including the grouped `WATER_ALL_DUE` variant.
- [ ] Write-type actions delegate to the owning module through the shared idempotent write path and are the only actions registered as queueable.
- [ ] Sibling cancellation implemented for the same subject and the same `due_local_date` with reason `ALREADY_SATISFIED`.
- [ ] Action ordering implemented so the primary and secondary actions are the two that survive a two-button platform limit.
- [ ] Automated tests cover AC-1 to AC-9, including a duplicate-submission test asserting exactly one stored entry.
- [ ] Every action button carries a programmatic accessible name that states the action and its subject; the notification centre exposes every action that the operating system could not render.
- [ ] Action labels resolved from the locale catalogue with unit formatting passed as a parameter, never as a second key.
- [ ] Action matrix, offline eligibility and the HTTP 410 contract documented and cross-linked from `modules/notifications.md`.

---

### US-NOT-10 — Postpone a reminder without losing it

| Field | Value |
| --- | --- |
| Epic | EPIC-NOT-06 Acting on a notification |
| Persona | PER-02 Marcus Oyelaran |
| Priority | Should |
| Release | v1.0 MVP |
| Estimate | 5 points |
| Related FRs | FR-NOT-20, FR-NOT-21, FR-NOT-22 |
| Related UCs | UC-NOT-09, UC-NOT-10, UC-NOT-01, UC-NOT-03 |
| Governing rules | BR-NOT-08, BR-NOT-12, BR-NOT-22 |

**As a** Registered User who cannot act on a reminder at the moment it arrives — Marcus Oyelaran, **I want** to snooze it for a bounded period, **so that** it returns when I can act on it instead of being dismissed and forgotten.

#### Acceptance criteria

**AC-1 — Happy path: a snooze reschedules the same occurrence.**

```gherkin
Scenario: A three-hour snooze moves the same occurrence
  Given I received a "PLANT_WATERING" notification at 09:00 local
  When I snooze it with the duration "3_HOURS"
  Then the occurrence state becomes "SNOOZED"
  And "snoozed_until" is set to 12:00 local
  And "snooze_count" becomes 1
  And "attempt_count" is reset to 0
  And no second occurrence row is created
```

**AC-2 — Happy path: the occurrence key stays coherent.**

```gherkin
Scenario: A same-day snooze increments the occurrence index
  Given an occurrence has "occurrence_index" 0 and "due_local_date" 2026-07-22
  When I snooze it to an instant on the same local date
  Then "occurrence_index" becomes 1
  And "due_local_date" remains 2026-07-22

Scenario: A snooze to tomorrow resets the occurrence index
  Given an occurrence has "occurrence_index" 1
  When I snooze it with the duration "TOMORROW"
  Then the resulting occurrence key carries the next local date and "occurrence_index" 0
```

**AC-3 — Alternate path: a snooze landing in quiet hours is deferred further.**

```gherkin
Scenario: The confirmation names the instant the user will actually be interrupted
  Given quiet hours are enabled from "22:00" to "07:00"
  And my deterministic jitter is 3 minutes
  When I snooze a notification at 21:00 local with the duration "3_HOURS"
  Then the resulting instant of 00:00 local is re-tested against quiet hours
  And the occurrence is deferred to 07:03 local
  And the confirmation text names "07:03"
```

**AC-4 — Alternate path: unusable durations are not offered.**

```gherkin
Scenario: Durations that would breach the cut-off are absent from the menu
  Given the notification category is "MEAL_LOG" with a staleness cut-off of 2 hours
  When I open the snooze menu at the original due instant
  Then exactly the durations "15_MIN" and "1_HOUR" are offered
  And "3_HOURS" and "TOMORROW" are not rendered as controls

Scenario: Tomorrow is never offered for a same-day-only category
  Given the notification category is "STREAK_AT_RISK"
  When I open the snooze menu
  Then "TOMORROW" is not offered
```

**AC-5 — Alternate path: staleness is always measured from the original instant.**

```gherkin
Scenario: Snoozing cannot extend a reminder beyond its category cut-off
  Given a "WORKOUT" occurrence has "original_due_at" of 17:30 local and a cut-off of 4 hours
  And I snoozed it twice, moving it to 21:45 local
  When the dispatch pass runs at 21:45 local
  Then the elapsed test uses "original_due_at" of 17:30 local
  And the occurrence is suppressed with reason "STALE_BEYOND_CUTOFF"
  And exactly one notification centre item is written flagged "was_stale"
```

**AC-6 — Validation path: the snooze limit is enforced.**

```gherkin
Scenario: A fourth snooze is refused
  Given the same occurrence has "snooze_count" of 3
  When I snooze it again
  Then the request fails with HTTP 409
  And the error code is "SNOOZE_LIMIT_REACHED"
  And the snooze control is rendered disabled with an explanatory label
```

**AC-7 — Error path: deleting the subject cancels a snoozed occurrence.**

```gherkin
Scenario: A snoozed reminder for a deleted plant never fires
  Given I snoozed a "PLANT_WATERING" occurrence for "Monstera"
  When I delete "Monstera"
  Then within 60 seconds the occurrence is cancelled with reason "SUBJECT_DELETED"
  And the snooze is discarded
  And the occurrence is never dispatched
```

**AC-8 — Error path: the dispatch-time gate is the backstop for a lost event.**

```gherkin
Scenario: A missed cancellation event cannot deliver a stale reminder
  Given a snoozed occurrence exists for a plant that has since been archived
  And the archive event was not processed
  When the dispatch pass evaluates the occurrence
  Then gate 3 of the eligibility gate fires
  And the occurrence is cancelled with reason "SUBJECT_ARCHIVED"
  And no push message is submitted
```

**AC-9 — Volume path: a snoozed occurrence is counted at delivery.**

```gherkin
Scenario: Snoozing does not consume the daily cap in advance
  Given my daily counter is 5 and my stored cap is 8
  When I snooze an occurrence
  Then my daily counter remains 5
  When the snoozed occurrence is eventually delivered on the same local date
  Then my daily counter becomes 6
```

#### Definition of Done

- [ ] Four snooze durations implemented with `TOMORROW` resolving to the category preferred local time on the next local date.
- [ ] Menu filtering implemented so a duration breaching the cut-off, or `TOMORROW` on a same-day-only category or on `WEEKLY_RECAP`, is not rendered at all.
- [ ] Snooze writes `snoozed_until`, increments `snooze_count`, resets `attempt_count` and leaves the occurrence in the non-terminal state `SNOOZED`; the limit of 3 returns HTTP 409 `SNOOZE_LIMIT_REACHED`.
- [ ] Occurrence-index arithmetic implemented for both single-slot and multi-slot categories so the two meanings cannot collide.
- [ ] Automated tests cover AC-1 to AC-9, including a lost-event test that exercises gate 3 without the lifecycle event.
- [ ] Snooze menu operable by screen reader and keyboard, with each duration announced by its human-readable label and the disabled state announced as text.
- [ ] Snooze confirmation copy, including the resulting instant, resolved from the locale catalogue and formatted in the user's locale.
- [ ] Snooze rules and their staleness interaction documented and cross-linked from `modules/notifications.md`.

---

### US-NOT-11 — Correct reminders when I travel or the clocks change

| Field | Value |
| --- | --- |
| Epic | EPIC-NOT-04 Temporal correctness |
| Persona | PER-01 Aditi Sharma |
| Priority | Must |
| Release | v0.5 Alpha |
| Release note | UTC storage and IANA resolution, FR-NOT-08, deliver in v0.5. Timezone-change re-materialisation, FR-NOT-09, delivers in v1.0; AC-5 to AC-7 are therefore v1.0 criteria. |
| Estimate | 13 points |
| Related FRs | FR-NOT-08, FR-NOT-09 |
| Related UCs | UC-NOT-01, UC-NOT-07 |
| Governing rules | BR-NOT-03, BR-NOT-10, BR-NOT-11 |

**As a** Registered User who travels for work and whose colleagues live under daylight saving — Aditi Sharma, **I want** every reminder to follow my local wall clock, **so that** a 09:00 reminder arrives at 09:00 wherever I am and never arrives twice.

#### Acceptance criteria

**AC-1 — Happy path: an ordinary zone resolves to a single instant.**

```gherkin
Scenario: A half-hour-offset zone with no daylight saving
  Given my timezone is "Asia/Kolkata"
  And my preferred local time for "PLANT_WATERING" is "09:00"
  When the planner resolves the local time for 2027-07-15
  Then the stored instant is 2027-07-15T03:30:00Z
  And the stored "due_local_date" is 2027-07-15
```

**AC-2 — Boundary path: a skipped local hour resolves forward.**

```gherkin
Scenario: A wall time that does not exist on a spring-forward date
  Given my timezone is "America/New_York"
  And my preferred local time is "02:30"
  When the planner resolves the local time for 2027-03-14
  Then the timezone database returns an empty set for that wall time
  And the stored instant is 2027-03-14T07:00:00Z
  And the reminder is delivered at 03:00 local
  And the reminder is delivered on 2027-03-14 and on no other date
```

**AC-3 — Boundary path: an ambiguous local hour resolves to the earlier instant.**

```gherkin
Scenario: A wall time that occurs twice on a fall-back date
  Given my timezone is "America/New_York"
  And my preferred local time is "01:30"
  When the planner resolves the local time for 2027-11-07
  Then the timezone database returns two instants for that wall time
  And the stored instant is 2027-11-07T05:30:00Z
  And the reminder is delivered once, at 01:30 EDT
  And the second pass of the same wall time delivers nothing, because the occurrence key is unchanged
```

**AC-4 — Boundary path: non-one-hour and quarter-hour zones are not assumed.**

```gherkin
Scenario: A 30-minute fall-back is resolved by the timezone database
  Given my timezone is "Australia/Lord_Howe"
  And my preferred local time is "01:45"
  When the planner resolves the local time for 2027-04-04
  Then the stored instant is 2027-04-03T14:45:00Z

Scenario: A quarter-hour offset zone resolves correctly
  Given my timezone is "Pacific/Chatham"
  And my preferred local time is "09:00"
  When the planner resolves the local time for 2027-06-15
  Then the stored instant is 2027-06-14T20:15:00Z
```

**AC-5 — Happy path, v1.0: a timezone change reschedules future occurrences.**

```gherkin
Scenario: Flying from London to Tokyo moves tomorrow's reminder
  Given my timezone is "Europe/London" and my preferred local time is "09:00"
  And one occurrence is "SCHEDULED" for tomorrow at 09:00 London time
  When I change my timezone to "Asia/Tokyo"
  Then within 60 seconds that occurrence is cancelled with reason "TZ_CHANGE"
  And it is re-materialised with the same "occurrence_key"
  And its "due_local_date" is unchanged
  And its new instant corresponds to 09:00 Tokyo time
  And the toast key "notif.tz.updated" is shown
```

**AC-6 — Alternate path, v1.0: a timezone change cannot produce a duplicate.**

```gherkin
Scenario: An already-dispatched occurrence is never revisited
  Given today's "PLANT_WATERING" occurrence for "Monstera" has already been dispatched under "Europe/London"
  When I change my timezone to "America/Los_Angeles"
  Then that occurrence is not re-materialised
  And no second push message is submitted for that plant on that "due_local_date"
  And the affected set contains only occurrences whose state is "SCHEDULED" and whose effective due instant is strictly later than the current instant
```

**AC-7 — Alternate path, v1.0: a recomputed instant already in the past is judged against the cut-off.**

```gherkin
Scenario: A recomputed instant 30 minutes in the past is still delivered
  Given a "PLANT_WATERING" occurrence with a cut-off of 12 hours is "SCHEDULED"
  When I change to a timezone in which its recomputed instant has already passed by 30 minutes
  Then the occurrence is delivered on the next dispatch pass

Scenario: A recomputed instant beyond the cut-off is suppressed
  Given a "WATER_INTAKE" occurrence with a cut-off of 1 hour is "SCHEDULED"
  When I change to a timezone in which its recomputed instant passed 5 hours ago
  Then the occurrence is suppressed with reason "STALE_BEYOND_CUTOFF"
  And exactly one notification centre item is written flagged "was_stale"
```

**AC-8 — Validation path: a zone that cannot express daylight saving is refused.**

```gherkin
Scenario: A fixed offset is not a timezone
  When I submit "UTC+05:30" as my timezone
  Then the request fails with HTTP 422
  And the error code is "VALIDATION_UNKNOWN_TIMEZONE"

Scenario: An unknown IANA name is refused
  When I submit "Mars/Olympus_Mons" as my timezone
  Then the request fails with HTTP 422
  And the error code is "VALIDATION_UNKNOWN_TIMEZONE"
```

**AC-9 — Error path: an unresolvable zone never causes a guessed offset.**

```gherkin
Scenario: An absent zone falls back to UTC and is reported
  Given my stored timezone is absent at planner time
  When the planner pass runs
  Then the zone "UTC" is used for that pass
  And the event "WARN_TZ_FALLBACK" is logged
  And a settings banner tells me to set my timezone

Scenario: A thrown lookup skips the user rather than guessing
  Given the timezone database lookup raises an error for my zone
  When the planner pass runs
  Then no occurrence is created for my account in that pass
  And the event "ERR_TZ_RESOLUTION" is logged
  And the planner retries my account on the next hourly pass
```

**AC-10 — Boundary path: a local calendar date that does not exist is skipped.**

```gherkin
Scenario: A date-line change that removes a whole local date
  Given my timezone changes such that one local calendar date does not exist
  When the planner pass runs
  Then no occurrence is materialised for that non-existent date
  And the next existing local date is materialised normally
  And no occurrence is moved onto a neighbouring date
```

#### Definition of Done

- [ ] Resolution function implemented in the shared package with the four steps of BR-NOT-10 clause 2, wrapping the library so its own default for ambiguous and skipped times cannot leak through.
- [ ] All nine test vectors V-01 to V-09 implemented as unit tests, taking transition instants from the runtime IANA database rather than from constants, and passing as a v0.5 exit criterion.
- [ ] `due_local_date` frozen at materialisation and never recomputed by a deferral, a snooze, a timezone change or a re-materialisation.
- [ ] Timezone-change procedure implemented within a 60-second bound, restricted to the affected set of BR-NOT-11 clause 1, and reusing the same occurrence key.
- [ ] Automated tests cover AC-1 to AC-10, including the duplicate-prevention assertion of AC-6.
- [ ] Timezone field and its confirmation toast announced as text by a screen reader, with no reliance on colour or motion.
- [ ] Timezone validation errors and the update toast resolved from the locale catalogue; dates and times formatted through the locale formatter.
- [ ] Daylight-saving rules, test vectors and the re-materialisation procedure documented and cross-linked from `modules/notifications.md` and the risk register entry for timezone correctness.

---

### US-NOT-12 — Trust the system after an outage

| Field | Value |
| --- | --- |
| Epic | EPIC-NOT-01 Scheduling and reliable delivery |
| Persona | PER-05 Sofia Lindqvist |
| Priority | Must |
| Release | v0.5 Alpha |
| Release note | The status machine, health endpoints, receipt pass and retry schedule deliver in v0.5. The staleness cut-off, FR-NOT-10, and lifecycle cancellation, FR-NOT-22, deliver in v1.0; AC-2, AC-3 and AC-8 are therefore v1.0 criteria. |
| Estimate | 13 points |
| Related FRs | FR-NOT-01, FR-NOT-03, FR-NOT-10, FR-NOT-11, FR-NOT-17, FR-NOT-18, FR-NOT-22 |
| Related UCs | UC-NOT-02, UC-NOT-03, UC-NOT-04, UC-NOT-05 |
| Governing rules | BR-NOT-06, BR-NOT-07, BR-NOT-12, BR-NOT-17, BR-NOT-18, BR-NOT-19, BR-NOT-30 |

**As a** Registered User whose backend runs on a free tier that sleeps — Sofia Lindqvist, **I want** sensible behaviour after the server has been asleep or broken, **so that** I neither miss everything nor receive a wall of yesterday's reminders when it wakes.

#### Acceptance criteria

**AC-1 — Happy path: a short outage delivers late, not never.**

```gherkin
Scenario: A 25-minute outage still delivers a watering reminder
  Given the backend was unavailable from 08:55:00Z to 09:20:00Z
  And one "PLANT_WATERING" occurrence was due at 09:00:00Z with a cut-off of 12 hours
  When the first dispatch pass after recovery runs at 09:25:00Z
  Then the occurrence is selected by the predicate "due at or before now"
  And the push message is submitted
  And no separate catch-up job is invoked
```

**AC-2 — Alternate path, v1.0: an occurrence past its cut-off is suppressed.**

```gherkin
Scenario: A nine-hour overnight outage does not release a water nudge
  Given the backend was unavailable for 9 hours
  And one "WATER_INTAKE" occurrence was due 9 hours ago with a cut-off of 1 hour
  When the dispatch pass resumes
  Then gate 5 of the eligibility gate fires
  And the "EXPO_PUSH" and "EMAIL" deliveries are suppressed with reason "STALE_BEYOND_CUTOFF"
  And exactly one notification centre item is written flagged "was_stale"
  And that item is rendered as history with no action prompt
```

**AC-3 — Boundary path, v1.0: a same-day-only category is bounded by the local date.**

```gherkin
Scenario: A streak alert never arrives after the day it was about
  Given one "STREAK_AT_RISK" occurrence has "due_local_date" 2026-07-21 and a cut-off of 3 hours
  And it was due at 20:30 local on 2026-07-21
  When the dispatch pass runs at 01:00 local on 2026-07-22
  Then the occurrence is suppressed with reason "STALE_BEYOND_CUTOFF"
  And the suppression applies regardless of the elapsed-hours test
```

**AC-4 — Alternate path: a long backlog drains at a bounded rate.**

```gherkin
Scenario: Recovery is predictable rather than a single burst
  Given 1800 occurrences are due after a long outage and none is stale
  When successive dispatch passes run
  Then each pass claims at most 500 occurrences
  And each pass spends at most 30000 milliseconds submitting to the provider
  And the remainder stays in state "SCHEDULED" for the following pass
  And the backlog drains at no more than 6000 occurrences per hour
```

**AC-5 — Alternate path: a stalled scheduler is externally detectable.**

```gherkin
Scenario: The liveness endpoint reports a stall
  Given the last dispatch pass ran 20 minutes ago
  When "GET /api/v1/health/scheduler" is called
  Then the response status is HTTP 503
  And the body reports "status" as "STALLED"
  And the body reports "last_tick_at", "last_planner_at", "pending_count" and "oldest_pending_age_seconds"

Scenario: The keep-alive endpoint performs no database query
  When "GET /api/v1/health" is called
  Then the response status is HTTP 200
  And the response is returned within 1000 milliseconds
  And zero database queries are executed by that request
  And the response contains no personal data
```

**AC-6 — Error path: a retryable failure follows the bounded schedule.**

```gherkin
Scenario: Five total attempts and no more
  Given a push delivery fails with a retryable provider error
  When retries are scheduled
  Then the base delays used are 0, 60, 300, 900 and 3600 seconds in that order
  And each delay is multiplied by a jitter factor drawn uniformly from 0.5 to 1.0
  And after the fifth attempt fails the delivery status becomes "FAILED"
  And the provider error code is recorded on the delivery row

Scenario: A retry that could never usefully arrive is abandoned early
  Given the next attempt instant would fall later than "original_due_at" plus the category cut-off
  When the retry is scheduled
  Then the retry is abandoned without consuming the remaining attempts
  And the delivery is suppressed with reason "STALE_BEYOND_CUTOFF"
```

**AC-7 — Error path: an illegal status transition is rejected loudly.**

```gherkin
Scenario: A write to a terminal delivery row is refused
  Given a delivery row has the terminal status "DELIVERED"
  When a transition to "PENDING" is attempted
  Then the request fails with HTTP 409
  And the error code is "INVALID_STATUS_TRANSITION"
  And an error-reporting event is raised
  And the stored status remains "DELIVERED"
```

**AC-8 — Alternate path, v1.0: pending work reacts to its subject's lifecycle.**

```gherkin
Scenario: Disabling a module cancels its pending occurrences and stops materialisation
  Given 6 occurrences of categories mapped to the module key "NUTRITION" are "SCHEDULED"
  When I disable the Nutrition module
  Then within 60 seconds all 6 occurrences are cancelled with reason "MODULE_DISABLED"
  And the planner creates no further occurrence for that module key

Scenario: Re-enabling a module never backfills
  Given the Nutrition module was disabled for 3 days
  When I re-enable it
  Then materialisation resumes from the next planner pass
  And zero occurrences are created for the 3 days during which it was disabled
```

**AC-9 — Alternate path: receipts resolve tickets and prune dead tokens.**

```gherkin
Scenario: A receipt of ok completes the delivery
  Given a push ticket was created 20 minutes ago
  When the receipt pass runs on the schedule "*/15 * * * *"
  And the provider returns a receipt status of ok
  Then the delivery status transitions from "SENT" to "DELIVERED"

Scenario: An unresolved ticket is closed after 24 hours
  Given a push ticket was created 25 hours ago and has never resolved
  When the receipt pass runs
  Then the delivery status becomes "FAILED" with reason "RECEIPT_EXPIRED"
```

**AC-10 — Alternate path: a stuck claim is recovered.**

```gherkin
Scenario: A row left in DISPATCHING by a killed process is reclaimed
  Given one occurrence has been in state "DISPATCHING" for 11 minutes
  When the next dispatch pass runs
  Then that occurrence is returned to state "SCHEDULED"
  And the pass log records it under "reclaimed_stuck"
```

#### Definition of Done

- [ ] Per-category staleness cut-off table implemented with the 1-to-48-hour range, the 6-hour fallback and the `WARN_UNMAPPED_CUTOFF` log for an unmapped category.
- [ ] Staleness always measured from `original_due_at`, proven by a test in which a deferral and a snooze both fail to extend the reminder's life.
- [ ] Both health endpoints implemented, the keep-alive one performing no database query, plus the GitHub Actions scheduled workflow on `*/10 * * * *`.
- [ ] Delivery status machine implemented as a closed transition table returning HTTP 409 `INVALID_STATUS_TRANSITION` for anything absent from it.
- [ ] Retry schedule, early abandonment, receipt pass and stuck-claim recovery implemented with the constants of BR-NOT-17, BR-NOT-19 and BR-NOT-02 clause 5.
- [ ] Automated tests cover AC-1 to AC-10, including a simulated multi-hour outage that asserts the exact suppressed-versus-delivered split by category.
- [ ] Stale notification centre items announced as history by a screen reader, with the stale state conveyed by text as well as by icon.
- [ ] Stale-item copy resolved from the locale catalogue and reviewed so it states what happened without loss-framed or shaming language.
- [ ] Outage behaviour, health bands and the operator runbook for a `STALLED` reading documented and cross-linked from `modules/notifications.md` and the risk register.

---

### US-NOT-13 — Diagnose why notifications are not arriving

| Field | Value |
| --- | --- |
| Epic | EPIC-NOT-07 Device transport and self-service diagnostics |
| Persona | PER-02 Marcus Oyelaran |
| Priority | Must |
| Release | v0.5 Alpha |
| Release note | Device registration, FR-NOT-14, delivers in v0.1. Revocation, the receipt pass and the test-notification diagnostic deliver in v0.5. |
| Estimate | 8 points |
| Related FRs | FR-NOT-14, FR-NOT-15, FR-NOT-17, FR-NOT-24 |
| Related UCs | UC-NOT-05, UC-NOT-06, UC-NOT-11 |
| Governing rules | BR-NOT-15, BR-NOT-18, BR-NOT-26, BR-NOT-28 |

**As a** Registered User who is not a technical user — Marcus Oyelaran, **I want** a settings action that sends a test notification and names each device that failed, **so that** I can find out why my phone is silent without contacting anyone.

#### Acceptance criteria

**AC-1 — Happy path: the diagnostic reports one result per device.**

```gherkin
Scenario: A test notification returns a per-device outcome
  Given I have 2 active device push tokens with permission status "GRANTED"
  When I request a test notification
  Then the response status is HTTP 200
  And the response contains exactly 2 entries
  And each entry contains a device identifier, a device name, a platform and a status of "ACCEPTED" or "REJECTED"
  And the title key "notif.test.title" and the body key "notif.test.body" are used
  And one notification centre item is written with category "SYSTEM_TEST"
```

**AC-2 — Happy path: the diagnostic bypasses only what it must.**

```gherkin
Scenario: The test ignores preferences but not device state
  Given quiet hours are active, do-not-disturb is active, my daily cap is reached and every category is disabled
  When I request a test notification
  Then the push message is submitted to every active device token
  And my daily counter is unchanged
  And the message is never grouped and is never retried
```

**AC-3 — Happy path: token registration and refresh keep the registry current.**

```gherkin
Scenario: A token is upserted rather than duplicated
  Given my device already has a registered token
  When the client registers the same token string on cold start
  Then no second device row is created
  And "last_seen_at" is refreshed

Scenario: The registration cadence is honoured
  Then the client registers the token on every cold start, on every foreground after 6 hours, and on every provider-reported token change
```

**AC-4 — Alternate path: the device cap evicts the least recently active token.**

```gherkin
Scenario: A sixth device evicts the oldest
  Given I have 5 active device push tokens
  When I register a sixth token
  Then the token with the oldest "last_seen_at" is revoked with reason "LRU_EVICTED"
  And exactly 5 active tokens remain
  And the newly registered device is among them
```

**AC-5 — Alternate path: a handed-over device never leaks reminders.**

```gherkin
Scenario: A token already owned by another account is reassigned
  Given the token string "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]" is registered to another account
  When that token is registered to my account
  Then the other account's row is revoked with reason "TOKEN_REASSIGNED"
  And a new row is created for my account
  And no subsequent notification for the other account targets that token
```

**AC-6 — Error path: a dead token is pruned in the same transaction as the failure.**

```gherkin
Scenario: DeviceNotRegistered prunes and fails together
  Given the provider returns "DeviceNotRegistered" for one of my tokens in a receipt
  When the receipt pass processes it
  Then the delivery status becomes "FAILED" with reason "DEVICE_NOT_REGISTERED"
  And the token is revoked in the same transaction
  And no further push is submitted to that token
```

**AC-7 — Error path: a user with no usable device is told what to do.**

```gherkin
Scenario: The diagnostic refuses when there is nothing to diagnose
  Given I have zero active device push tokens
  When I request a test notification
  Then the request fails with HTTP 409
  And the error code is "NO_DEVICE_REGISTERED"
  And the message states that the mobile application must be opened once with notification permission granted

Scenario: Operating-system permission denied is reported, not hidden
  Given my only device has permission status "DENIED"
  Then that device is never targeted by any push
  And the settings screen shows a banner naming the operating-system setting to change
```

**AC-8 — Validation path: bad input and abuse are refused.**

```gherkin
Scenario: A malformed token is rejected at registration
  When I register the token string "not-a-token"
  Then the request fails with HTTP 422
  And the error code is "VALIDATION_BAD_PUSH_TOKEN"
  And no device row is created

Scenario: The diagnostic is rate limited
  Given I have requested a test notification 5 times in the past hour
  When I request a sixth
  Then the request fails with HTTP 429
  And the response carries a "Retry-After" header
```

**AC-9 — Alternate path: repeated failures raise a self-service prompt.**

```gherkin
Scenario: Three consecutive failures to one device surface a banner
  Given 3 consecutive push deliveries to the same device have status "FAILED"
  When I open the settings screen
  Then a banner is shown pointing at the test-notification diagnostic
  And a single isolated failure raises no banner
```

**AC-10 — Alternate path: revocation covers every stated trigger.**

```gherkin
Scenario: A token is revoked on logout, deletion and inactivity
  Given I log out of one device
  Then that device's token is revoked with reason "USER_LOGOUT"
  Given my account is deleted
  Then every token is revoked with reason "ACCOUNT_DELETED" and de-registered with the provider before hard deletion
  Given a token has not refreshed "last_seen_at" for 90 consecutive days
  When the nightly retention pass runs
  Then that token is revoked with reason "INACTIVE"
  And revoked rows are hard-deleted 180 days after revocation
```

#### Definition of Done

- [ ] Device registration endpoint implemented with the token grammar check, the 20-to-200-character length bound, the platform and permission enumerations and the 64-character device-name cap.
- [ ] Maximum of 5 active tokens per user enforced with least-recently-active eviction, and table-wide token uniqueness enforced with reassignment.
- [ ] All six revocation reasons implemented as a soft delete recording `revoked_at` and `revoke_reason`, with hard deletion after 180 days.
- [ ] Test-notification endpoint implemented with the 5-per-hour rate limit, the HTTP 409 precondition, the bypass set of BR-NOT-26, no daily-counter increment and no retry.
- [ ] Automated tests cover AC-1 to AC-10, including the same-transaction pruning assertion of AC-6.
- [ ] Device list and every diagnostic result operable by screen reader, each device named in text, each result stating `ACCEPTED` or `REJECTED` as words rather than by colour.
- [ ] Diagnostic copy, the permission banner and every error message resolved from the locale catalogue.
- [ ] Token lifecycle, the diagnostic contract and the privacy statement covering device names and platforms documented and cross-linked from `modules/notifications.md`.

---

## 3. Story index

| ID | Title | Epic | Persona | Priority | Release | Points | Related FRs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| US-NOT-01 | Receive a watering reminder at the right local time | EPIC-NOT-01 | PER-02 Marcus Oyelaran | Must | v0.1 | 13 | FR-NOT-01, FR-NOT-02, FR-NOT-16 |
| US-NOT-02 | Configure which reminders I get and when | EPIC-NOT-02 | PER-01 Aditi Sharma | Must | v0.5 | 8 | FR-NOT-04, FR-NOT-05 |
| US-NOT-03 | Not be woken up at night | EPIC-NOT-02 | PER-01 Aditi Sharma | Must | v0.5 | 5 | FR-NOT-06 |
| US-NOT-04 | Pause every notification for a while | EPIC-NOT-02 | PER-03 Mia Castellano | Should | v1.0 | 3 | FR-NOT-07 |
| US-NOT-05 | Not be flooded on a busy day | EPIC-NOT-03 | PER-01 Aditi Sharma | Must | v1.0 | 5 | FR-NOT-12 |
| US-NOT-06 | One notification for many due plants | EPIC-NOT-03 | PER-02 Marcus Oyelaran | Should | v1.0 | 5 | FR-NOT-13 |
| US-NOT-07 | Tap a notification and land exactly where I need to be | EPIC-NOT-05 | PER-01 Aditi Sharma | Must | v0.1 | 8 | FR-NOT-19 |
| US-NOT-08 | See what I would have been told, on the web | EPIC-NOT-05 | PER-04 Harold "Hal" Whitfield | Must | v0.5 | 13 | FR-NOT-20, FR-NOT-23 |
| US-NOT-09 | Act straight from the notification | EPIC-NOT-06 | PER-05 Sofia Lindqvist | Should | v1.0 | 8 | FR-NOT-21 |
| US-NOT-10 | Postpone a reminder without losing it | EPIC-NOT-06 | PER-02 Marcus Oyelaran | Should | v1.0 | 5 | FR-NOT-20, FR-NOT-21, FR-NOT-22 |
| US-NOT-11 | Correct reminders when I travel or the clocks change | EPIC-NOT-04 | PER-01 Aditi Sharma | Must | v0.5 | 13 | FR-NOT-08, FR-NOT-09 |
| US-NOT-12 | Trust the system after an outage | EPIC-NOT-01 | PER-05 Sofia Lindqvist | Must | v0.5 | 13 | FR-NOT-01, FR-NOT-03, FR-NOT-10, FR-NOT-11, FR-NOT-17, FR-NOT-18, FR-NOT-22 |
| US-NOT-13 | Diagnose why notifications are not arriving | EPIC-NOT-07 | PER-02 Marcus Oyelaran | Must | v0.5 | 8 | FR-NOT-14, FR-NOT-15, FR-NOT-17, FR-NOT-24 |

### 3.1 Forward coverage check — every module requirement is covered by at least one story

| Requirement | Covering stories | Requirement | Covering stories |
| --- | --- | --- | --- |
| FR-NOT-01 | US-NOT-01, US-NOT-12 | FR-NOT-13 | US-NOT-06 |
| FR-NOT-02 | US-NOT-01 | FR-NOT-14 | US-NOT-13 |
| FR-NOT-03 | US-NOT-12 | FR-NOT-15 | US-NOT-13 |
| FR-NOT-04 | US-NOT-02 | FR-NOT-16 | US-NOT-01 |
| FR-NOT-05 | US-NOT-02 | FR-NOT-17 | US-NOT-12, US-NOT-13 |
| FR-NOT-06 | US-NOT-03 | FR-NOT-18 | US-NOT-12 |
| FR-NOT-07 | US-NOT-04 | FR-NOT-19 | US-NOT-07 |
| FR-NOT-08 | US-NOT-11 | FR-NOT-20 | US-NOT-08, US-NOT-10 |
| FR-NOT-09 | US-NOT-11 | FR-NOT-21 | US-NOT-09, US-NOT-10 |
| FR-NOT-10 | US-NOT-12 | FR-NOT-22 | US-NOT-10, US-NOT-12 |
| FR-NOT-11 | US-NOT-12 | FR-NOT-23 | US-NOT-08 |
| FR-NOT-12 | US-NOT-05 | FR-NOT-24 | US-NOT-13 |

All 24 requirements `FR-NOT-01` to `FR-NOT-24` are covered. All 13 stories reference at least one requirement that exists in [modules/notifications.md](../modules/notifications.md). The mapping above is identical to section 10.2 of that document, read in the opposite direction.

---

## 4. Story point totals

Estimation uses the Fibonacci scale 1, 2, 3, 5, 8, 13, 21. A 13 marks a story that a single developer should expect to spend most of a working week on and that is a candidate for splitting if it slips; nothing in this module is estimated above 13, which is the ceiling policy for a one-person team.

### 4.1 Totals per epic

| Epic | Name | Stories | Points |
| --- | --- | --- | --- |
| EPIC-NOT-01 | Scheduling and reliable delivery | US-NOT-01, US-NOT-12 | 26 |
| EPIC-NOT-02 | Interruption control | US-NOT-02, US-NOT-03, US-NOT-04 | 16 |
| EPIC-NOT-03 | Volume control | US-NOT-05, US-NOT-06 | 10 |
| EPIC-NOT-04 | Temporal correctness | US-NOT-11 | 13 |
| EPIC-NOT-05 | Notification surfaces | US-NOT-07, US-NOT-08 | 21 |
| EPIC-NOT-06 | Acting on a notification | US-NOT-09, US-NOT-10 | 13 |
| EPIC-NOT-07 | Device transport and self-service diagnostics | US-NOT-13 | 8 |
| **Total** | | **13 stories** | **107** |

### 4.2 Totals per release

Each story is counted once, against the release named in its metadata table. Where a story carries a release note, the note identifies the acceptance criteria that follow in a later release; the points are not split, because the story is estimated and demonstrated as a whole.

| Release | Stories | Points | Share of module total |
| --- | --- | --- | --- |
| v0.1 Walking Skeleton | US-NOT-01, US-NOT-07 | 21 | 19.6 percent |
| v0.5 Alpha | US-NOT-02, US-NOT-03, US-NOT-08, US-NOT-11, US-NOT-12, US-NOT-13 | 60 | 56.1 percent |
| v1.0 MVP | US-NOT-04, US-NOT-05, US-NOT-06, US-NOT-09, US-NOT-10 | 26 | 24.3 percent |
| v1.1+ Post-MVP | none | 0 | 0 percent |
| **Total** | **13 stories** | **107** | **100 percent** |

### 4.3 Totals per priority

| Priority | Stories | Points |
| --- | --- | --- |
| Must | US-NOT-01, US-NOT-02, US-NOT-03, US-NOT-05, US-NOT-07, US-NOT-08, US-NOT-11, US-NOT-12, US-NOT-13 | 86 |
| Should | US-NOT-04, US-NOT-06, US-NOT-09, US-NOT-10 | 21 |
| Could | none | 0 |
| Wont | none | 0 |
| **Total** | **13 stories** | **107** |

### 4.4 Totals per persona

| Persona | Stories | Points |
| --- | --- | --- |
| PER-01 Aditi Sharma | US-NOT-02, US-NOT-03, US-NOT-05, US-NOT-07, US-NOT-11 | 44 |
| PER-02 Marcus Oyelaran | US-NOT-01, US-NOT-06, US-NOT-10, US-NOT-13 | 31 |
| PER-03 Mia Castellano | US-NOT-04 | 3 |
| PER-04 Harold "Hal" Whitfield | US-NOT-08 | 13 |
| PER-05 Sofia Lindqvist | US-NOT-09, US-NOT-12 | 16 |
| **Total** | **13 stories** | **107** |

---

*End of `user-stories/notifications.md`. Identifiers minted by this document: `US-NOT-01` to `US-NOT-13` and `EPIC-NOT-01` to `EPIC-NOT-07`, both contiguous with no gaps, plus the `AC-n` criteria scoped inside each story. No identifier outside the `NOT` prefix is defined here; every other identifier is a reference to the document that owns it.*
