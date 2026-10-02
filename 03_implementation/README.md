# Phase 3 — Implementation

All of PlantPal+'s code, as one TypeScript monorepo. This folder is the npm workspace root, so **every npm command runs from here**.

| Workspace | Package | What it is |
| --- | --- | --- |
| [`api/`](api/README.md) | `@plantpal/api` | REST API: Express on Node, or bundled for Supabase Edge Functions |
| [`web/`](web/README.md) | `@plantpal/web` | Website: React + Vite |
| [`mobile/`](mobile/README.md) | `@plantpal/mobile` | Mobile app: React Native + Expo, with an offline outbox |
| [`shared/`](shared/README.md) | `@plantpal/shared` | Domain rules (watering, energy and nutrition maths, streaks) used by all three |

Dependencies point one way: each app depends on `shared`, the apps never import one another, and `shared` has no runtime dependencies at all ([ADR 0003](../02_design/architecture/adrs/0003-use-npm-workspaces.md)).

## Commands

```bash
npm install          # every workspace; also builds shared/
npm test             # every workspace's tests
npm run typecheck    # strict TypeScript across every workspace
npm run lint         # ESLint across every workspace, failing on any warning
npm run build        # builds every workspace
npm run format       # formats with Prettier
```

One workspace at a time: `npm run dev --workspace @plantpal/api`, `npm test --workspace @plantpal/web`, and so on. The [root README](../README.md#getting-started) walks through running the API, the website and the mobile app.

## Configuration in this folder

| File | Purpose |
| --- | --- |
| `package.json`, `package-lock.json` | The workspace root and the pinned dependency tree |
| `tsconfig.base.json` | Strict TypeScript settings every workspace extends |
| `eslint.config.mjs` | Lint rules for every workspace |
| `.prettierrc.json`, `.prettierignore` | The formatting style |
| `.nvmrc` | The Node.js version to use (`nvm use`) |
| `vercel.json` | How Vercel installs, builds and serves the website; the Vercel project's Root Directory is this folder |

Testing is described in the [testing guide](../04_testing/README.md) and deployment in the [deployment guide](../06_deployment/README.md).
