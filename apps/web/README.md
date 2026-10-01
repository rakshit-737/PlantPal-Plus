# @plantpal/web

The PlantPal+ web application — React 18, Vite 6, TypeScript and Tailwind CSS, styled entirely from the design tokens in [`docs/design/01-design-language.md`](../../docs/design/01-design-language.md). Live at **https://plant-pal-plus.vercel.app**.

## Scripts

Run from the repository root:

```bash
npm run dev --workspace @plantpal/web        # Vite dev server on http://localhost:5173
npm run build --workspace @plantpal/web      # type-check + production build into dist/
npm run typecheck --workspace @plantpal/web  # strict TypeScript, no emit
npm test --workspace @plantpal/web           # Vitest + Testing Library under jsdom
```

## Configuration

Copy [`.env.example`](.env.example) to `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_TARGET` | `http://localhost:4000` | Where the **dev server** proxies `/api/*`. |
| `VITE_API_URL` | empty | Only for hosts that cannot rewrite `/api/*` (GitHub Pages): the API origin the client calls directly. Leave empty on Vercel and in development. |
| `VITE_BASE` | `/` | The subpath the site is served under (`/<repo>/` on GitHub Pages). |

In development and on Vercel the browser only ever talks to its own origin and `/api/*` is forwarded to the API, so the httpOnly refresh-token cookie is first-party and no CORS setup is needed.

## Auth model

- The 15-minute JWT **access token** lives in memory only (never `localStorage`), so storage-scoped XSS cannot lift a durable credential.
- The 30-day **refresh token** is an httpOnly cookie the browser sends automatically. On a `TOKEN_EXPIRED` 401 the client refreshes once and replays the request; on a hard reload it exchanges the cookie for a new access token during bootstrap.
- Requests send `x-plantpal-client: WEB`, which is what makes the API set the refresh cookie instead of returning the raw token.

## Structure

```
src/
  main.tsx, App.tsx   bootstrap, providers and routes (landing at /, the app under /dashboard …)
  index.css           design tokens (CSS custom properties) and signature surfaces
  components/         ui.tsx primitives, Brand, ThemeToggle, PlantAvatar
  layouts/            AppShell — glass sidebar, phone top bar and tab dock
  navigation/         navItems — drives both navigations and module gating
  pages/              one file per route, lazy-loaded behind the shell
  auth/               AuthContext, ProtectedRoute
  settings/           SettingsContext — preferences and accessibility attributes on <html>
  hooks/              useTheme, useReducedMotion, usePageTitle
  lib/                apiClient (the single HTTP boundary), per-feature API modules, dates, errorMessages, utils
  test/               setup, design-token contrast and parity, code-splitting and landing-fact checks
```

Every route except the landing page renders inside `AppShell` and is code-split, so a visitor who only opens the dashboard never downloads the other pages.

## Conventions

- **Tokens only** — no hard-coded colours; see the [design language](../../docs/design/01-design-language.md) and the [component inventory](../../docs/design/02-component-inventory.md).
- **A failed request is never an empty state.** Pages keep an error flag beside their data and render `ErrorState` with a retry.
- **Accessible by default** — native elements, labelled fields, focus management on route changes, three in-app accessibility modes.
