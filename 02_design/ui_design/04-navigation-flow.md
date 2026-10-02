# PlantPal+ Navigation Flow

| Field | Value |
| --- | --- |
| Document | `04-navigation-flow.md` — App routing and navigation structure |
| Version | 2.0 |
| Updated | 2026-10-02 |
| Owner | Rakshit |

> **v2.0 describes navigation as built.** v1.0 planned React Navigation stacks, bottom sheets and per-action routes (`/plants/add`, `/fitness/log`). The shipped apps are simpler: a flat tab switcher on mobile, and on the web one route per screen with actions opened in place. §5 lists the differences.

## 1. Overview

The navigation must carry a unified dashboard and three independent trackers, and the trackers are **optional**: a module switched off in Settings disappears from every navigation surface at once. Both web navigations — the desktop sidebar and the phone dock — are rendered from the same `NAV_ITEMS` list (`03_implementation/web/src/navigation/navItems.tsx`), so they can never disagree. While settings are still loading every module stays visible (fail-open), and the API refuses a state with every module off, so the navigation can never be empty.

## 2. Web App (React Router)

### Routes

| Path | Screen | Access |
| --- | --- | --- |
| `/` | Landing page for visitors; signed-in users are sent to `/dashboard` | Public |
| `/login`, `/register` | Auth screens | Public |
| `/dashboard` | Daily dashboard | Signed in |
| `/plants` | Plant list | Signed in |
| `/plants/:id` | Plant detail: watering, conditions, care log, growth timeline | Signed in |
| `/fitness` | Fitness: weekly summary, steps chart, workout log, personal records | Signed in |
| `/nutrition` | Nutrition: calories and macros, hydration, meals by type | Signed in |
| `/achievements` | Streaks, badge collection | Signed in |
| `/settings` | Account, modules, notifications, appearance, accessibility, privacy, deletion | Signed in |
| `/onboarding` | Two-step setup, reached by link from Settings | Signed in |
| `*` | 404 page | Public |

`ProtectedRoute` sends a signed-out visitor to `/login` and remembers where they were going; after sign-in they return there. Signing in during the account-deletion grace period lands on `/settings?recover=1`, the only place deletion can be cancelled.

### Actions open in place

Creating something never changes route. Add plant, Log workout, Log meal, Add photo and Remove are `Modal` flows on the page that owns the data. Other screens link straight into them with a query parameter that is consumed and stripped, so a refresh or Back does not reopen the dialog:

- `/fitness?log=1` — opens Log workout (dashboard quick action).
- `/nutrition?log=1&meal=LUNCH` — opens Log meal with the meal type preselected.

### Desktop and tablet (≥ 768px)

- **Persistent glass sidebar** with the wordmark, navigation grouped as **Today** (Dashboard), **Habits** (Plants, Fitness, Nutrition) and **You** (Achievements, Settings), and an account card with the theme toggle and Sign out.
- The active item is marked by one lit pill that glides between items, plus a dot.
- **Main content area** renders the active route; each route grows in on arrival.

### Phones (< 768px)

- A sticky glass **top bar** with the wordmark, theme toggle and Sign out.
- A **floating tab dock** inset from the bottom edge (safe-area aware), mirroring the sidebar's items. Toasts sit above it.

### Focus and scroll

A "Skip to content" link is the first focusable element. On every route change focus moves to `<main>` (without scrolling it under the sticky top bar) and the page scrolls to the top, so keyboard and screen-reader users land on the new page.

## 3. Mobile App (Expo)

Navigation is a deliberate **hand-rolled tab switcher** in `03_implementation/mobile/App.tsx` rather than React Navigation: six flat tabs and one auth gate do not justify the dependency.

- **Auth gate:** Login ↔ Register until a session exists.
- **Tabs:** Home (dashboard) · Plants · Fit · Food · Awards · Set(tings). Each screen mounts on demand.
- Safe areas come from `react-native-safe-area-context` insets, so Android edge-to-edge gets the same treatment as iOS.
- An outbox indicator shows queued offline writes; they drain automatically when the connection returns.

## 4. Deep Linking and Notifications

**Planned, not yet implemented.** The design reserves the `plantpal://` scheme (for example `plantpal://plants/123` to open a plant, `plantpal://nutrition/log?meal=lunch` to open meal logging). Today `app.json` declares no scheme and a notification tap opens the app at Home. On the web, the query-parameter actions in §2 already provide the equivalent entry points.

## 5. What Changed From v1.0

| v1.0 planned | v2.0 ships | Why |
| --- | --- | --- |
| React Navigation bottom tabs with native stacks per tab | A flat six-tab switcher | Every screen is one level deep; stacks added configuration and no behaviour. |
| `/` as the dashboard | `/` is the landing page; the app lives at `/dashboard` | A visitor sees what the product is before being asked to sign in. |
| Separate routes for forms (`/plants/add`, `/fitness/log`, `/nutrition/log`) | Modals on the owning page, opened by `?log=1` | Logging is a seconds-long action; leaving the page for it lost context. |
| Bottom sheets for quick logs | Modals that present as bottom sheets on phones | One dialog component with the same focus and busy guarantees everywhere. |
| Desktop breakpoint at 1024px, optional right sidebar | Sidebar from 768px; no right sidebar | Tablets get the full navigation; the dashboard surfaces reminders inline instead. |
