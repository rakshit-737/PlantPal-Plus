# Finishing the deployment — two manual steps

Everything automatable is done. The website redeploys itself on every push to
`main`. The two remaining steps need accounts only you can log into; each is a
few minutes.

## 1. API on Render (unblocks sign-in on the live site)

1. Sign in at https://dashboard.render.com (free account).
2. **New → Blueprint** → connect the `rakshit-737/PlantPal-Plus` repo. Render
   reads [render.yaml](../render.yaml) and provisions the `plantpal-plus-api`
   free web service; `JWT_ACCESS_SECRET` is generated for you.
3. When prompted for `DATABASE_URL`, paste your Neon connection string —
   **it must end with `?sslmode=require`**. (Also rotate the Neon password
   first: the old one appeared in chat transcripts. Neon console → your
   branch → Reset password, then paste the new URL.)
4. Wait for the first deploy; migrations and seeds run at boot. Verify:
   `https://<your-service>.onrender.com/healthz` returns
   `{"status":"ok","uptime_s":...}`. **A body like `{"detail":"Not Found"}`
   means that hostname is serving a different app — not this API.** That has
   happened: at the time of writing `plantpal-api.onrender.com` answers a
   uvicorn/FastAPI-style 404, so the documented origin was pointing at
   someone else's service. The repo's blueprint now uses the free name
   `plantpal-plus-api`; if you see the wrong-app body, that name too is
   occupied and you must pick another free one and use it everywhere below.
5. Back in GitHub: repo **Settings → Secrets and variables → Actions →
   Variables** → new variable `PLANTPAL_API_URL` = the Render origin (no
   trailing slash), e.g. `https://plantpal-plus-api.onrender.com`.
6. Re-run the **Deploy web to GitHub Pages** workflow (Actions tab → run
   workflow) so the site is rebuilt with the API URL baked in. The workflow
   now **fails the build if `PLANTPAL_API_URL` is unset** instead of shipping
   a site whose sign-in silently breaks, so this step cannot be skipped.
   Sign-in now works on https://rakshit-737.github.io/PlantPal-Plus/
   (Chrome/Firefox; Safari needs step 3 below).
7. The [keepalive workflow](../.github/workflows/keepalive.yml) starts pinging
   `/healthz` automatically once the variable exists, keeping the reminder
   cron alive (RSK-01). For sturdier coverage add a free UptimeRobot monitor
   on the same URL.

## 2. Android APK via EAS

```bash
npm install -g eas-cli
eas login                     # your Expo account
cd apps/mobile
eas build:configure           # links the project, writes extra.eas.projectId
eas build --platform android --profile preview
```

The preview profile bakes `EXPO_PUBLIC_API_URL=https://plantpal-plus-api.onrender.com`
— edit [eas.json](../apps/mobile/eas.json) first if your Render service has a
different name. The build page serves an installable `.apk`.

## 3. Optional: production web on Vercel (fixes Safari)

GitHub Pages serves the demo, but its cross-origin refresh cookie is blocked
by Safari. [vercel.json](../vercel.json) is ready: import the repo at
https://vercel.com/new (defaults work), then add the assigned domain (e.g.
`https://plantpal.vercel.app`) to `CORS_ORIGINS` in the Render dashboard.
Details: [docs/deployment/vercel.md](vercel.md).
