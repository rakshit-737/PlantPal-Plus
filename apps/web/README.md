# @plantpal/web

The PlantPal+ web application — React + Vite + TypeScript, styled with Tailwind
against the shared design tokens in [`docs/design/01-design-language.md`](../../docs/design/01-design-language.md).

## Scripts

```bash
npm run dev --workspace @plantpal/web        # Vite dev server on :5173
npm run build --workspace @plantpal/web      # typecheck + production build
npm run typecheck --workspace @plantpal/web  # strict TS, no emit
npm test --workspace @plantpal/web           # vitest
```

The dev server proxies `/api/*` to the API (default `http://localhost:4000`, override
with `VITE_API_TARGET`) so the browser makes same-origin requests and the httpOnly
refresh-token cookie works without cross-site quirks.

## Auth model

- The 15-minute JWT **access token** lives in memory only (never `localStorage`),
  so storage-scoped XSS can't lift a durable credential.
- The 30-day **refresh token** is an httpOnly cookie the browser sends automatically
  to `/api/auth`. On a `TOKEN_EXPIRED` 401 the client silently refreshes once and
  replays the request; on a hard reload it exchanges the cookie for a new access
  token during bootstrap.
- Requests send `x-plantpal-client: WEB`, which is what makes the API set the
  refresh cookie instead of returning the raw token (see `authController.platform()`).

## Structure

```
src/
  lib/         apiClient (single HTTP boundary + FR-SYS-19 envelope), authApi, errorMessages
  auth/        AuthContext, ProtectedRoute
  components/  ui primitives (Button, Input, Card, Alert)
  layouts/     AppShell (sidebar navigation)
  navigation/  navItems (drives sidebar + module gating)
  pages/       Login, Register, Dashboard, placeholders
  hooks/       useTheme (light/dark, system default, persisted)
```
