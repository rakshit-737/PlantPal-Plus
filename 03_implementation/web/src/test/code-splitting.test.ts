/**
 * Guards the route split.
 *
 * The performance budget caps interior-route JavaScript, and the way that cap
 * gets broken is not a big new dependency — it is someone converting a
 * `lazy()` route back to a static import to fix an unrelated type error. That
 * change is invisible in review and silent at runtime: everything still works,
 * the route just moves back into the initial bundle.
 *
 * This reads App.tsx rather than the build output so it fails in the same run
 * as the edit, instead of waiting for someone to read chunk sizes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const app = fs.readFileSync(path.join(here, '..', 'App.tsx'), 'utf8')

/** Routes that must not be in the initial bundle. */
const SPLIT = [
  'AchievementsPage',
  // The landing page is the heaviest route in the app and the one a returning
  // user never opens. It must not ride along in the initial bundle.
  'LandingPage',
  'FitnessPage',
  'NutritionPage',
  'OnboardingPage',
  'PlantDetailPage',
  'PlantsPage',
  'SettingsPage',
]

/** Routes that must stay eager — the first screen a visitor sees. */
const EAGER = ['DashboardPage', 'LoginPage', 'RegisterPage', 'NotFoundPage']

describe('route code splitting', () => {
  it.each(SPLIT)('loads %s lazily', (page) => {
    expect(app, `${page} should be wrapped in lazy()`).toMatch(
      new RegExp(`const ${page} = lazy\\(`),
    )
    expect(app, `${page} must not also be imported statically`).not.toMatch(
      new RegExp(`^import \\{[^}]*\\b${page}\\b`, 'm'),
    )
  })

  it.each(EAGER)('keeps %s in the initial bundle', (page) => {
    // A signed-out visitor gets the auth pages and a signed-in one gets the
    // dashboard; making either wait on a second request buys nothing.
    expect(app, `${page} should be a static import`).toMatch(
      new RegExp(`^import \\{ ${page} \\}`, 'm'),
    )
  })
})
