# Deploying the web app to Vercel

`vercel.json` (repo root) configures a monorepo root deploy of the Vite app in
`apps/web`. JSON forbids comments, so the reasoning lives here.

- **installCommand / buildCommand** — `npm ci` at the root installs every
  workspace; the build compiles `@plantpal/shared` first because the web app
  imports it, then builds `@plantpal/web`.
- **outputDirectory** — Vite emits to `apps/web/dist`.
- **Rewrites** (order matters; first match wins, static files are served
  before rewrites run):
  1. `/api/*` proxies to the Render API origin
     (`https://plantpal-plus-api.onrender.com`). The browser makes same-origin
     requests, so the httpOnly `refresh_token` cookie works without cross-site
     quirks — see the comments in `apps/web/vite.config.ts`.
  2. Everything else falls back to `/index.html` so BrowserRouter can handle
     deep links like `/plants`.
- **No `VITE_BASE` needed** — Vercel serves from the domain root, so the
  default base `/` is correct. `VITE_API_URL` is also unnecessary because the
  `/api/*` rewrite handles routing.

After adding a Vercel domain, append it to the API's `CORS_ORIGINS`
(see `render.yaml`) or credentialed requests will be rejected.
