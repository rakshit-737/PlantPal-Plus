# @plantpal/shared

Domain logic shared by the API, the website and the mobile app. **A business rule lives in exactly one place** (NFR-MAIN-04): the watering algorithm, the energy and nutrition maths and the streak rules are implemented here once and consumed identically by every client, because the requirements demand bit-for-bit agreement between them.

The package has no runtime dependencies.

## What it provides

| Module | Exports | Requirements |
| --- | --- | --- |
| `domain/watering.ts` | `computeWateringInterval` and its factor tables — season, light, pot material and diameter, soil, drainage, placement, indoor climate | BR-PLT-03 – BR-PLT-08 |
| `domain/season.ts` | `seasonForMonth`, `seasonForLocalDate` (hemisphere-aware) | |
| `domain/nutrition.ts` | `energyFromMacros` (Atwater), `basalMetabolicRate` (Mifflin-St Jeor), `totalDailyEnergyExpenditure`, `defaultHydrationGoalMl`, activity factors and bounds | BR-NUT-08, BR-NUT-11 – BR-NUT-13 |
| `domain/fitness.ts` | `workoutEnergyKcal` (MET), `estimatedOneRepMax` (Epley), `setVolumeKg`, `totalVolumeKg` | FR-FIT-05, BR-FIT-14, BR-FIT-15 |
| `domain/streak.ts` | `advanceStreakOnLog`, `localDateDiffDays`, `EMPTY_STREAK` | BR-GAM-07, BR-GAM-08, FR-SYS-22 |
| `domain/rounding.ts` | `roundHalfUp`, `roundTo`, `clamp` | |
| `domain/enums.ts` | The shared enumerations — activity types, intensities, meal types, serving units, plant enums, sync and delivery states | |

## Scripts

```bash
npm run build --workspace @plantpal/shared      # compile to dist/ (the other workspaces import the built output)
npm test --workspace @plantpal/shared           # the specification's worked examples as test vectors
npm run typecheck --workspace @plantpal/shared
```

Build this package before type-checking or running the apps from a fresh clone — CI does the same.

## Rules for changing it

- **Tests come from the specification.** When a requirement publishes a worked example, that example is the test case.
- **No I/O.** Functions are pure; anything that touches a database, the network or the clock belongs in an app.
- **Breaking a signature breaks three clients.** TypeScript will show where; update all of them in the same change.
