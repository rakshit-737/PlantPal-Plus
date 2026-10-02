# @plantpal/mobile

The PlantPal+ mobile app — React Native with Expo, sharing its domain logic with the API and the website through `@plantpal/shared`. It talks to the same REST API and keeps working offline for the actions that matter most.

## Run it

```bash
cd 03_implementation/mobile
npx expo start        # prints a QR code
```

- **On your phone:** scan the QR code with [Expo Go](https://expo.dev/go) (Android) or the Camera app (iOS).
- **Emulators:** press `a` for Android or `i` for the iOS simulator.

Other scripts: `npm run typecheck` and `npm test` (the offline-outbox suite).

## Pointing it at an API

Copy [`.env.example`](.env.example) to `.env` and set `EXPO_PUBLIC_API_URL`.

| Running on | Default when unset | What to set |
| --- | --- | --- |
| Android emulator | `http://10.0.2.2:4000` (the emulator's alias for your machine) | — |
| iOS simulator | `http://localhost:4000` | — |
| A physical phone | — | Your computer's LAN address, e.g. `http://192.168.1.20:4000`, or the live API |

The `preview` and `production` build profiles in [`eas.json`](eas.json) bake in the live API, `https://mmqqijfgtcjviogqporc.supabase.co/functions/v1/plantpal-api`.

## Build an installable app

Builds use [EAS](https://docs.expo.dev/build/introduction/) and a free Expo account:

```bash
npm install -g eas-cli
eas login
cd 03_implementation/mobile
eas build --platform android --profile preview   # an installable .apk
```

## Offline support

Logging a watering, a workout, a meal or a glass of water works without a connection. Each event is queued in a durable outbox with a client-generated UUID, survives an app restart, and drains in order when the connection returns; the server applies each key exactly once, so a replay is never a duplicate. A queue belongs to the account that wrote it and is cleared on sign-out. See [ADR 0002](../../02_design/architecture/adrs/0002-offline-light-append-only-sync.md).

## Structure

```
App.tsx              auth gate and the six-tab switcher (no navigation library)
src/
  screens/           Dashboard, Plants, PlantDetail, Fitness, Nutrition, Achievements, Settings, Login, Register
  components/        ui.tsx primitives, OfflineNotice
  offline/           the outbox: storage, drain, write-through, provider and indicator
  api/, lib/         HTTP client, endpoints and per-feature helpers
  auth/              AuthContext (the refresh token is kept in expo-secure-store)
  notifications.ts   Expo push registration
  theme.ts           the design tokens, mirrored from the web
```

The palette in `theme.ts` must match `03_implementation/web/src/index.css`; a web test fails if they drift.
