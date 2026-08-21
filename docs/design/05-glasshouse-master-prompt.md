# PlantPal+ — "Glasshouse" UI Master Prompt

> **Paste this whole file into Claude Code with the repo open.** Start with:
> `Read docs/design/05-glasshouse-master-prompt.md and execute it. Begin at Phase 0 and stop at the Phase 0 gate for my review.`
>
> Everything below is written as an instruction to the agent doing the work.

---

## 0. Read this before you touch anything

You are performing a **full visual restyle** of the PlantPal+ web application, with matching parity work on the Expo mobile app. This is a deliberate, owner-approved reversal of a documented decision, and you must treat it as such.

`docs/design/01-design-language.md` v2.0 records the 2026-07 "field notebook" redesign, which **explicitly dropped shadcn/ui, Lucide, Framer Motion, Recharts, RN Paper and NativeWind**, and replaced "micro-interactions, spring physics, Lottie growth animations, confetti" with six functional transitions. Its tenets are hairlines-not-shadows, sharp corners, near-zero motion.

**v3.0 "Glasshouse" reverses that.** Motion, depth, glass and glow come back. The owner has decided this. Your job is not to relitigate it — but you must:

1. **Record the reversal honestly.** Every dropped-then-readded dependency gets a line in the v3.0 changelog explaining what v2.0 gained by dropping it and what v3.0 is trading that for. This repository's whole premise is that every artefact traces to the requirement it satisfies (README, Phase table). A silent dependency re-add breaks that premise.
2. **Carry forward what v2.0 got right.** Three things survive unchanged and are non-negotiable: token indirection, the mono-numeral rule, and the full accessibility contract (§7).
3. **Never trade correctness for polish.** 307 tests pass today. They must pass when you are done. A restyle that breaks the "a failed request never masquerades as an empty one" invariant is a failed restyle, however good it looks.

---

## 1. Mission

Rebuild the PlantPal+ interface as **Glasshouse**: a dark-first, glass-and-light interface where the deep leaf green stops being ink on paper and becomes *the living thing behind glass*. Depth, translucency, glow and motion carry hierarchy; the mono numerals stay, because a habit tracker lives or dies on legible numbers.

Deliverables, in scope order:

| # | Surface | Path |
|---|---|---|
| 1 | Design tokens + primitives | `apps/web/src/index.css`, `apps/web/tailwind.config.js`, `apps/web/src/components/ui.tsx` |
| 2 | App shell + navigation | `apps/web/src/layouts/AppShell.tsx`, `apps/web/src/navigation/navItems.tsx` |
| 3 | Auth surfaces | `LoginPage`, `RegisterPage`, `AuthLayout`, `NotFoundPage` |
| 4 | **New** public landing page | `apps/web/src/pages/LandingPage.tsx` (new route) |
| 5 | App interior — 8 pages | `Dashboard`, `Onboarding`, `Plants`, `PlantDetail`, `Fitness`, `Nutrition`, `Achievements`, `Settings` |
| 6 | Mobile parity | `apps/mobile/src/theme.ts`, `apps/mobile/src/components/ui.tsx`, 9 screens |
| 7 | Documentation | `docs/design/01-design-language.md` → v3.0, `docs/design/02-component-inventory.md`, `README.md` |

### Non-negotiables

Break any of these and the work is rejected regardless of how it looks.

1. **Token indirection.** No hard-coded colour in any component. Every colour resolves through a CSS custom property declared in `index.css` and mapped in `tailwind.config.js`. Mobile mirrors the same names in `apps/mobile/src/theme.ts`.
2. **`--color-on-primary` inverts between themes.** White on the dark-mode green fails WCAG AA; dark ink passes. Any new "on-*" pairing must be contrast-checked, not eyeballed.
3. **Three in-app accessibility modes keep working**, independently of OS settings: `[data-reduce-motion]`, `[data-larger-text]`, `[data-high-contrast]`. Stamped on `<html>` by `SettingsContext`. Every animation you add must be *decorative only* — the UI must remain fully comprehensible with all three on.
4. **Empty ≠ error.** `EmptyState` invites action; `ErrorState` explains a failure and offers retry. Never collapse them, never let a failed fetch render as "No plants yet".
5. **Metrics are mono.** Anything countable, summable or comparable stays `font-mono`. This is the one v2.0 signature that Glasshouse keeps, and it is what stops the app reading as a generic glassmorphism template.
6. **Module gating survives.** `plant_care_enabled` / `fitness_enabled` / `nutrition_enabled` hide their nav items and dashboard tiles; settings loading (null) fails open. Server Invariant 34 guarantees at least one module stays on. Whatever new navigation you build must preserve this.
7. **`npm run typecheck`, `npm run lint`, `npm test` and `npm run build --workspace @plantpal/web` all pass** at every phase gate. Baseline at the start of Glasshouse: **347 tests — 335 passing, 12 skipped** (shared 53 · api 186+12 · mobile 24 · web 72). The README's "307" is stale: shared, mobile and web match it exactly, the API suite has grown by ~40 since it was written. Fix the README in Phase 10; use 347 as the number everywhere else.
8. **Performance budget** (§8) is a hard limit, not an aspiration. This ships to GitHub Pages and a free-tier Render API, and is used on Indian mobile connections.

---

## 2. The repository as it actually is

Read these before writing code. Paths are exact.

```
packages/shared/                Domain logic — watering algorithm, Atwater, Mifflin-St Jeor. DO NOT TOUCH.
apps/api/                       Express + TS REST API. DO NOT TOUCH.
apps/web/                       React 18.3 + Vite 6 + Tailwind 3.4 + TS 5.7 + react-router-dom 7.18
apps/mobile/                    Expo 57 + RN 0.86 + React 19.2 + TS 6.0
docs/design/01-design-language.md    v2.0 — the document you are superseding
docs/design/02-component-inventory.md
```

### `apps/web` inventory

| File | What it is |
|---|---|
| `src/components/ui.tsx` | **The entire design system**, hand-rolled, zero dependencies. 14 exports: `Button`, `Input`, `Select`, `Combobox`, `Card`, `Alert`, `Spinner`, `Badge`, `Progress`, `EmptyState`, `ErrorState`, `Modal`, `StatCard`, `PageHeader`, plus `ToastProvider`/`useToast`. |
| `src/components/ui.test.tsx` | Behaviour tests for the above |
| `src/layouts/AppShell.tsx` | Desktop sidebar + mobile bottom tab bar, both driven by `NAV_ITEMS`. Skip link, route-change focus move, scroll reset. |
| `src/navigation/navItems.tsx` | Six nav items. **Known drift:** draws icons at `strokeWidth={2}` with round caps while the rest of the app is 1.5/square, and carries a stale "swap for lucide-react later" comment. Fix this as part of the restyle. |
| `src/pages/` | `DashboardPage` `OnboardingPage` `PlantsPage` `PlantDetailPage` `FitnessPage` `NutritionPage` `AchievementsPage` `SettingsPage` `LoginPage` `RegisterPage` `AuthLayout` `NotFoundPage` `PlaceholderPage` |
| `src/hooks/useTheme.ts` | Reads/writes `plantpal-theme` in localStorage, stamps `data-theme` on `<html>` |
| `src/settings/SettingsContext.tsx` | Stamps `data-reduce-motion` / `data-larger-text` / `data-high-contrast` |
| `src/auth/AuthContext.tsx`, `ProtectedRoute.tsx` | Auth. Do not restructure. |
| `src/lib/*Api.ts` | API clients. **Do not change API call shapes.** |
| `index.html` | Pre-paint theme script (prevents dark-mode flash), Google Fonts link |
| `vite.config.ts` | `base: env.VITE_BASE ?? '/'` for GitHub Pages subpath hosting; `/api` dev proxy |
| `vitest.config.ts` | **Separate config from vite.config.ts.** jsdom, globals, `src/test/setup.ts` |

### Current tokens (`src/index.css`)

Light: bg `#f6f7f4` · surface `#ffffff` · primary `#226d3c` · primary-hover `#1a5530` · secondary `#38708f` · tertiary `#9a6b0f` · accent `#b3402e` · text-main `#1b241e` · text-muted `#5d6a61` · border `#dce1da` · on-primary `#ffffff`

Dark: bg `#0b0e0c` · surface `#141815` · primary `#46a96c` · primary-hover `#5fbf80` · secondary `#6fa7c7` · tertiary `#c99a3c` · accent `#d96c57` · text-main `#ecf0ec` · text-muted `#8b968d` · border `#242a25` · on-primary `#0b0e0c`

Semantic roles to preserve: **primary = plants + success**, **secondary = fitness/info**, **tertiary = nutrition/warning**, **accent = error/destructive**.

---

## 3. Six repo-specific things that will break if you skip them

These are not generic advice. Each is a property of *this* repository that will make a copy-pasted component from any of the five sources fail immediately.

### 3.1 There is no `@/` path alias, and it must be added in THREE places

`tsconfig.base.json` has no `baseUrl` and no `paths`. Every Aceternity, Animata and 21st.dev component imports `{ cn } from "@/lib/utils"`. Add the alias to all three configs — missing the third silently breaks the entire test suite.

```jsonc
// apps/web/tsconfig.json — add inside compilerOptions
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

```ts
// apps/web/vite.config.ts — add inside the returned config object
resolve: { alias: { '@': path.resolve(__dirname, './src') } },
```

```ts
// apps/web/vitest.config.ts — SEPARATE FILE, same alias, easy to forget
resolve: { alias: { '@': path.resolve(__dirname, './src') } },
```

### 3.2 `verbatimModuleSyntax: true` rejects the canonical `cn` snippet

Every library publishes this:

```ts
import { ClassValue, clsx } from "clsx"   // ❌ fails typecheck in this repo
```

Write it as:

```ts
// apps/web/src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Same rule for every pasted component: type-only imports use `import type` or inline `type`. `isolatedModules` is also on.

### 3.3 `noUncheckedIndexedAccess: true` breaks almost every animation component

Array indexing yields `T | undefined`. Animation components index freely — `words[i]`, `items[activeIndex]`, `cards[hovered]`. `npm run build` runs `tsc --noEmit` first, so this blocks the build, not just the editor.

Fix at the point of use with a guard or a documented non-null assertion, following the pattern already in `ui.tsx`:

```ts
const first = focusable[0]!
const last = focusable[focusable.length - 1]!
```

**Do not weaken `tsconfig.base.json` to make third-party code compile.** NFR-MAIN-01 requires strict mode across every package.

### 3.4 `exactOptionalPropertyTypes: true` changes how optional props are typed

`foo?: string` cannot receive an explicit `undefined`. The repo already handles this correctly — copy the existing idiom:

```ts
interface InputProps { error?: string | undefined; hint?: string | undefined }
```

Adapt every pasted component's props the same way.

### 3.5 jsdom has none of the browser APIs animation components assume

`src/test/setup.ts` currently stubs only `matchMedia` and `scrollTo`. Scroll-driven, canvas and observer-based components will throw the moment a test renders a page that uses them. Extend the setup file in Phase 0:

```ts
// apps/web/src/test/setup.ts — add these
class MockObserver {
  observe() {} unobserve() {} disconnect() {} takeRecords() { return [] }
  root = null; rootMargin = ''; thresholds = []
}
globalThis.IntersectionObserver ??= MockObserver as unknown as typeof IntersectionObserver
globalThis.ResizeObserver ??= MockObserver as unknown as typeof ResizeObserver

// Canvas-based effects (placeholders-and-vanish-input, canvas-reveal, vortex)
HTMLCanvasElement.prototype.getContext =
  vi.fn(() => null) as unknown as HTMLCanvasElement['getContext']

// Kill animation timing in tests so assertions are deterministic
import { MotionGlobalConfig } from 'motion/react'
MotionGlobalConfig.skipAnimations = true
```

### 3.6 Web is React 18.3; mobile is React 19.2

Do not install a component that requires React 19 into `apps/web`. Check before adopting. Do not "fix" this by upgrading React — that is a separate change with its own risk, outside this brief.

### Also worth knowing

- **ESLint lints every `.ts`/`.tsx` under `apps/web/src`**, including pasted components. `react-hooks/rules-of-hooks` is `error`. Strip `"use client"` directives (harmless at runtime in Vite, noise in a non-RSC app, and Rollup may warn).
- **`VITE_BASE`** — the GitHub Pages build serves from `/PlantPal-Plus/`. Any component referencing an absolute asset path (`/images/hero.png`) will 404 there. Import assets so Vite rewrites them, or prefix with `import.meta.env.BASE_URL`.
- **Pick one animation package and never mix.** Both Aceternity and Animata now publish against **`motion`** (`import { motion } from 'motion/react'`), not `framer-motion`. Install `motion`. If a pasted component imports `framer-motion`, rewrite the import rather than installing both.

---

## 4. The design direction — "Glasshouse" v3.0

### The concept

A glasshouse is the honest bridge between where this app was and where it is going. It is glossy, dark, lit and reflective — everything v2.0 refused — and it is still, unmistakably, about growing things. That gives every effect a reason to exist rather than being decoration:

| Glasshouse element | UI expression | Where it earns its place |
|---|---|---|
| Glass panes | Translucent surfaces with a hairline top-edge highlight and backdrop blur | Cards, modals, sidebar, tab bar |
| Light through glass | Directional glow behind interactive and "due today" elements | Primary buttons, overdue plants, active nav |
| Condensation / mist | Soft aurora-mesh gradient, extremely low opacity, motionless in reduce-motion | Page ground, auth backgrounds |
| Growth | Things reveal by growing in, not by sliding | List entrances, progress fills, streak grid |
| The ledger under the glass | Mono numerals, hairline rules, uppercase eyebrows | **Unchanged from v2.0.** This is the anchor. |

**The trap to avoid:** generic 2024-era glassmorphism — purple gradients, `rounded-3xl` everywhere, floating cards with no grid. Glasshouse is *green, structured and numerate*. If a screen could be swapped into any SaaS template without anyone noticing, it is wrong.

**The named anti-reference:** the *Journal App* by Hours, featured on recent.design (46.7k impressions) — a mobile journal with animated 3D flower creatures that bloom as you log, plus a collectible "insights garden". That is the maximalist version of this exact product idea. PlantPal+ is deliberately not that: no mascots, no creatures, no celebration animations. Glass and light, not toys.

### Evidence behind the palette

From verified 2026 rebrands on **rebrand.gallery**:

- **Ellis Butchers** (Studio Blackburn, 2026) — `#000000`, `#002E24` *(near-black green)*, `#F23900` *(orange-red)*, `#FFFFFD` *(off-white, not pure white)*. Direct proof that a very dark green plus one hot accent plus a barely-warm white reads as premium rather than clinical.
- **Bob's Red Mill** (Turner Duckworth, 2026) — `#412A2E`, `#E03C32`, `#FDF2E2`. Three colours total: one dark ink, one hot accent, one warm paper. Structurally identical to what PlantPal+ needs.
- **Maiella** (Multiverse Studio) — a single-hue tonal green system (dark green / accent green / white), tagged *Data Visualization*. Live proof that a green-only system works for a data-display product.

Lesson taken: **one dark green ground, one lifted green for life, one hot accent, one off-white. Everything else is a tint of those.**

### Token set — add all of these to `apps/web/src/index.css`

Keep every existing token name so nothing breaks; change values, then add the new groups. Mirror every name in `apps/mobile/src/theme.ts`.

**Dark is now the primary theme** — design it first, then derive light. The pre-paint script in `index.html` already handles system preference; do not change its key (`plantpal-theme`).

```css
[data-theme='dark'] {
  /* Ground — deeper than v2.0 so glass has something to sit on */
  --color-background:      #050807;
  --color-background-alt:  #0A0F0C;   /* NEW — banded section grounds */
  --color-surface:         #0F1512;
  --color-surface-raised:  #151D19;   /* NEW — modals, popovers, active rows */

  /* Living green */
  --color-primary:         #46A96C;   /* unchanged — AA-verified pairing */
  --color-primary-hover:   #5FBF80;
  --color-primary-glow:    #6EE7A0;   /* NEW — glow/highlight only, never text */
  --color-on-primary:      #050807;   /* INVERTS. Do not set to white. */

  /* Category inks */
  --color-secondary:       #6FA7C7;   /* fitness / info */
  --color-tertiary:        #C99A3C;   /* nutrition / warning */
  --color-accent:          #FF5A2B;   /* error / destructive — hotter than v2.0 */

  /* Ink */
  --color-text-main:       #ECF0EC;
  --color-text-muted:      #8B968D;
  --color-border:          #232B26;

  /* NEW — glass */
  --glass-bg:              rgba(20, 28, 24, 0.55);
  --glass-bg-strong:       rgba(20, 28, 24, 0.80);
  --glass-border:          rgba(255, 255, 255, 0.07);
  --glass-highlight:       rgba(255, 255, 255, 0.14); /* 1px top edge */
  --glass-blur:            14px;

  /* NEW — glow (used in box-shadow, never as a colour) */
  --glow-primary:          0 0 0 1px rgba(110,231,160,.14), 0 8px 32px -8px rgba(70,169,108,.45);
  --glow-accent:           0 0 0 1px rgba(255,90,43,.18),  0 8px 32px -8px rgba(255,90,43,.40);
  --glow-soft:             0 1px 0 0 var(--glass-highlight), 0 12px 40px -12px rgba(0,0,0,.65);

  /* NEW — elevation. v2.0 banned shadows; v3.0 defines exactly four. */
  --shadow-1: 0 1px 2px rgba(0,0,0,.30);
  --shadow-2: 0 4px 16px -4px rgba(0,0,0,.45);
  --shadow-3: 0 12px 40px -12px rgba(0,0,0,.60);
  --shadow-4: 0 24px 64px -16px rgba(0,0,0,.70);
}

:root, [data-theme='light'] {
  --color-background:      #FBFCFA;
  --color-background-alt:  #F3F5F1;
  --color-surface:         #FFFFFD;   /* off-white, per Ellis Butchers */
  --color-surface-raised:  #FFFFFF;

  --color-primary:         #17603A;   /* deepened from #226d3c for contrast on glass */
  --color-primary-hover:   #0F4A2B;
  --color-primary-glow:    #34A867;
  --color-on-primary:      #FFFFFF;   /* INVERTS the other way */

  --color-secondary:       #2F6484;
  --color-tertiary:        #8A5E0C;
  --color-accent:          #D6391A;

  --color-text-main:       #0C1410;
  --color-text-muted:      #55625A;
  --color-border:          #DDE3DC;

  --glass-bg:              rgba(255, 255, 255, 0.62);
  --glass-bg-strong:       rgba(255, 255, 255, 0.88);
  --glass-border:          rgba(12, 20, 16, 0.08);
  --glass-highlight:       rgba(255, 255, 255, 0.90);
  --glass-blur:            14px;

  --glow-primary:          0 0 0 1px rgba(23,96,58,.10),  0 8px 28px -10px rgba(23,96,58,.28);
  --glow-accent:           0 0 0 1px rgba(214,57,26,.12), 0 8px 28px -10px rgba(214,57,26,.25);
  --glow-soft:             0 1px 0 0 var(--glass-highlight), 0 10px 32px -14px rgba(12,20,16,.18);

  --shadow-1: 0 1px 2px rgba(12,20,16,.06);
  --shadow-2: 0 4px 16px -4px rgba(12,20,16,.10);
  --shadow-3: 0 12px 40px -12px rgba(12,20,16,.14);
  --shadow-4: 0 24px 64px -16px rgba(12,20,16,.18);
}
```

**These values were contrast-checked before being written down.** Measured WCAG ratios, foreground over `--glass-bg` composited on `--color-background` (the worst case — glass reduces effective contrast, which is where glassmorphism designs normally fail AA):

| Ink | On dark glass | On light glass |
|---|---|---|
| `text-main` | 16.32 | 18.49 |
| `text-muted` | 6.12 | 6.33 |
| `primary` | 6.40 | 7.50 |
| `primary-hover` | 8.28 | 10.21 |
| `secondary` | 7.18 | 6.34 |
| `tertiary` | 7.31 | 5.63 |
| `accent` | 6.04 | 4.66 |

And the inversion that justifies the `on-primary` token: `#050807` on dark-mode `#46A96C` = **6.85 (passes)**; plain white on the same green = **2.94 (fails)**. Light mode: white on `#17603A` = **7.58**.

Every value clears 4.5:1. **Re-measure if you change any hex** — and measure the composite, not the token. Target 4.5:1 for body text, 3:1 for large text and UI boundaries.

**High-contrast mode must switch glass off entirely.** Add to `index.css`:

```css
[data-high-contrast] {
  --glass-bg: var(--color-surface);
  --glass-bg-strong: var(--color-surface);
  --glass-blur: 0px;
  --glow-primary: none; --glow-accent: none; --glow-soft: none;
}
[data-high-contrast][data-theme='dark']  { --color-border: #4A544C; --color-text-muted: #B6C0B8; }
[data-high-contrast][data-theme='light'] { --color-border: #8E9A90; --color-text-muted: #38443C; }
```

### Radii — the sharp-corner rule is repealed, but not abolished

v2.0 used 2px/4px. v3.0 needs curvature for glass to read, but **numbers still live in square cells**.

| Alias | Value | Used for |
|---|---|---|
| `rounded-sm` | 6px | Inputs, badges, table cells, **any container holding a metric** |
| `rounded-md` | 10px | Buttons, list rows, toasts |
| `rounded-lg` | 16px | Cards, panels, tiles |
| `rounded-xl` | 22px | Modals, hero panels, the sidebar |
| `rounded-full` | 9999px | Avatars, pills, spinner, progress caps |

### Typography — one change

Keep **Inter** (body), **Bricolage Grotesque** (headings), **IBM Plex Mono** (all metrics). Add optical sizing and tighter display tracking for large headings; introduce a `font-display` step at 40–64px for the landing and auth pages. The eyebrow rule (uppercase, letterspaced, muted, for any label naming a field/column/status) and the mono rule are **carried forward verbatim from v2.0 §3** — do not restate them differently, restate them identically.

### Motion — the new contract

v2.0 allowed six transitions. v3.0 allows motion as a system, with hard rules:

| Rule | Spec |
|---|---|
| Durations | 120ms (micro), 220ms (standard), 400ms (entrance), 700ms (scroll reveal). Nothing longer. |
| Easing | `cubic-bezier(0.22, 1, 0.36, 1)` for entrances, `cubic-bezier(0.4, 0, 0.2, 1)` for state changes. |
| Springs | Allowed only for drag/pointer-tracked elements. Never for entrances. |
| Stagger | Max 40ms per item, max 8 items. Longer lists animate as one block. |
| Reveal | Growth, not slide: `scale(0.97) → 1` plus opacity. No horizontal translation over 8px. |
| Loops | Only two are permitted app-wide: the spinner, and the ambient background mesh. Everything else fires once. |
| Reduce-motion | Every animation must reduce to a **cross-fade or nothing** — never to a jump-cut that loses state. |
| Celebration | None. No confetti, no bloom, no mascot. A completed streak gets a glow, not a party. |

Implement the reduce-motion rule structurally, not per-component:

```ts
// apps/web/src/hooks/useReducedMotion.ts (new)
// Reads BOTH the OS media query and the in-app [data-reduce-motion] attribute.
// Feed the result into motion's MotionConfig at the root of App.tsx:
//   <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
```

Wire `MotionConfig` once in `App.tsx`. Any component that then needs a manual bail-out reads the same hook — never `window.matchMedia` directly.

---

## 5. The five sources — what each one actually is, and how to use it

### 5.1 Aceternity UI — `https://ui.aceternity.com` — ⛔ REFERENCE ONLY, DO NOT VENDOR

~110 free components, shadcn-registry distributed, motion-based. It is the best *catalogue of ideas* of the five sources and the worst *source of code* for this repo. Read the licence box below before installing anything.

```bash
npx shadcn@latest init                                        # once, in apps/web
npx shadcn@latest add https://ui.aceternity.com/registry/<name>.json
```

Optional namespace form (shadcn CLI 3.0+) — register in `components.json`, then `npx shadcn@latest add @aceternity/<name>`:

```json
{ "registries": { "@aceternity": "https://ui.aceternity.com/registry/{name}.json" } }
```

Discovery: `npx shadcn@latest search @aceternity -q "card"` · `npx shadcn@latest list @aceternity`

**Manual copy-paste is preferable here.** The registry writes to Next-style `components/ui/` and `hooks/` roots; this is a Vite app with `src/`. Read the component page, paste into `apps/web/src/components/aceternity/<name>.tsx`, then apply the §3 fixes.

- **Verified Next-free.** Across every registry file inspected — sidebar, floating-dock, tabs, animated-modal, multi-step-loader, timeline, focus-cards, text-generate-effect, placeholders-and-vanish-input, glowing-effect, card-spotlight, canvas-reveal-effect, bento-grid, moving-border, hover-border-gradient, stateful-button, file-upload, aurora-background — **no `next/image`, `next/link` or `next/navigation` imports**. Only `"use client"` (strip it) and Next-style file paths (move to `src/`). Demo code on component pages sometimes uses `next/image`; take the registry source, not the demo.
- **Tailwind v4 docs, Tailwind v3.4 repo.** Component pages now lead with v4 `@theme inline` syntax. Translate every one — recipe in Appendix B.
> ### ⛔ LICENCE — RESOLVED, AND IT CHANGES THE PLAN
>
> Aceternity's licence was verified after this brief was first written. **You may not commit adapted Aceternity source into this repository.**
>
> From `https://ui.aceternity.com/licence`, verbatim:
> - *"You can create unlimited end products for yourself or your clients"* and *"End products may be sold, licensed, sub-licensed, or freely distributed."*
> - **but** *"You cannot re-distribute the Item as a stock image or **its source files, regardless of modifications**"*
> - and *"You cannot sell, resell, or distribute the Item or derivative works on any marketplace."*
>
> From `https://ui.aceternity.com/terms`: you must not *"Redistribute content from ui.aceternity.com"* or *"Reproduce, duplicate or copy material from ui.aceternity.com"*; *"All intellectual property rights are reserved."* **Neither page carves out the free components from the paid ones.**
>
> PlantPal+ is a **public, MIT-licensed GitHub repository**. Committing adapted component source there redistributes the source files and re-licenses them onward under MIT — precisely what the licence forbids, "regardless of modifications". The deployed app would be fine; the repo is not.
>
> **The rule for this project:** Aceternity is a **visual reference only**. Look at it, learn from it, name it in design notes — never paste its source into `apps/web`. Everything structural comes from the MIT sources in §5.6, or gets written from scratch. See the substitution table in §6.0.
>
> This is a reading of a licence page, not legal advice. Read `https://ui.aceternity.com/licence` yourself before overriding it.

Transitive deps you may pull in: `@tabler/icons-react`, `lucide-react`, `@radix-ui/react-tabs`, `@radix-ui/react-label`, `@radix-ui/react-hover-card`, `react-dropzone`, `simplex-noise`, `mini-svg-data-uri`, `three` + `@react-three/fiber` + `@react-three/drei` + `three-globe`, `@tsparticles/*`, `dotted-map`, `qss`, `react-syntax-highlighter`. **Check the dependency before installing** — see the performance budget in §8.

### 5.2 Animata — `https://animata.design` ⚠️ (this is what "animaster" is)

**There is no UI library called "animaster."** The npm registry returns not-found; `animaster.dev` does not exist. The only real match is a UIST 2026 research project on text-to-video generation (`animaster-tool.github.io`) — unrelated. **Animata** is what was meant, and it is an excellent fit.

- **155+ animated React components across 19 categories.** MIT licensed, free forever. By Codse. 2.7k stars.
- Explicitly **not** a UI framework — "a collection of animations and effects" designed to sit alongside whatever system you already have. That makes it the right source for *widgets and micro-interactions*, where Aceternity is the right source for *structure*.
- **Works in Vite** — homepage lists Remix, Vite, Astro, Gatsby, TanStack alongside Next.

```bash
npx shadcn@latest add https://animata.design/r/<category>/<slug>.json
# e.g.  https://animata.design/r/widget/water-tracker.json
#       https://animata.design/r/text/counter.json
#       https://animata.design/r/tabs/fluid-tabs.json
```

- **Tailwind 3.4 needs `tailwindcss-animate`** (`npm i tailwindcss-animate`, add to `plugins`). Not needed on v4.
- Uses `motion/react`. The GitHub README still says Framer Motion — the live docs are correct.
- **Documented gotcha, quoted from their setup docs:** *"the docs may be missing CSS configuration (custom `@keyframes` or `@theme` values)"*. If a copied component doesn't animate, read its source in the repo and port the keyframes yourself.
- **Registry `dependencies` arrays are not reliable.** `https://animata.design/r/text/counter.json` reports `dependencies: []` while the component's own docs page says it is built with Motion. **Read the component source for its imports before assuming what it needs** — do not trust the registry metadata alone.
- Some newer components ship a **sibling `.css` file** instead of Tailwind config keyframes — Vite-friendly, just `import './marquee.css'`.
- `cn` lives at `libs/utils.ts` in their convention; point it at your `@/lib/utils` instead. Their rule: *"If it starts with `@/` then it is Animata's component, else it is an external dependency."*
- Accessibility: keyboard focus, SR labels and `prefers-reduced-motion` fallbacks are claimed and were confirmed present in the components inspected. Verify per component anyway.

**The `widget/` category is the single most valuable thing in this brief.** It contains, verbatim: `water-tracker`, `calorie-counter`, `weekly-progress`, `sleep-tracker`, `study-timer`, `battery-level`, `score-board`, `expense-tracker`, `storage-widget`, `alarm-clock`, `calendar-event`, `reminder`, `shopping-list`, `notes`. These are *exactly* the widget vocabulary of a habit tracker, already animated. Mine them for the dashboard rather than inventing tiles.

### 5.3 21st.dev — `https://21st.dev`

12,000+ community components from ~700 design engineers, shadcn-convention. **In 2026 it is prompt-and-MCP-first, not CLI-first.**

The `npx shadcn@latest add "https://21st.dev/r/<author>/<component>"` pattern is **not surfaced anywhere on the current site** — treat it as legacy and unverified. The real paths are: *copy prompt → paste into your agent*, *copy code*, or **MCP**.

Since you are Claude Code, use MCP:

```bash
npx @21st-dev/cli@latest init --client claude
```

or configure manually (API key from `https://21st.dev/mcp`):

```json
{ "mcpServers": { "21st": { "url": "https://21st.dev/api/mcp",
    "headers": { "x-api-key": "YOUR_21ST_API_KEY" } } } }
```

Note the verb is `init`, not `install`. Magic MCP (`@21st-dev/magic`) is superseded by the unified 21st MCP and now runs as a stdio proxy to it; old Magic API keys were reset. Tools exposed: `generate`, `get_inspiration`, `search_logo`, plus catalogue search and code retrieval.

Pricing: free tier = **2 component copies/day** plus full registry browsing. Builder $6/mo yearly, Builder+AI $15/mo yearly, Team $7.50/seat. (A legacy `/magic` pricing page still shows Free/Pro $20/Max $100 — the two pages disagree; `/pricing` is the current one.)

**Use 21st.dev for gap-filling, not as the backbone.** Two reasons: components are **author-licensed individually** — there is no blanket licence — so check each component's page before shipping; and it is unvetted for framework portability, so Next-isms are common. After pasting anything from 21st.dev: strip `"use client"`, replace `next/image` → `<img>`, `next/link` → react-router `<Link>`, confirm the animation dep, and confirm it doesn't need React 19.

Highest-value categories for this app: **Dashboards (400)**, **Charts & Data Viz (246)**, **Progress (375)**, **Grids & Bento (620)**, **Empty States (77)**, **Onboarding (53)**, **Steppers (124)**, **Spinner Loaders (480)**, **Sidebars (95)**, **Tabs (239)**, **Toasts (79)**, **File Uploads (154)**, **Calendars (239)**, **Stats & KPIs (153)**. Browse at `https://21st.dev/community/components/s/<slug>` or `https://21st.dev/s/<slug>`.

### 5.6 The MIT stack — where the code actually comes from

With Aceternity out as a code source, structure comes from these. All verified MIT.

**Magic UI — `https://magicui.design`** · **MIT** (confirmed in `github.com/magicuidesign/magicui/blob/main/LICENSE.md`). ~78 components. The closest thing to a drop-in Aceternity replacement for effects.

```bash
npx shadcn@latest add "https://magicui.design/r/<name>.json"   # URL form — verified live
pnpm dlx shadcn@latest add @magicui/<name>                     # namespaced form the docs now show
```

> **⚠ Tailwind version split.** `magicui.design` is now **Tailwind v4**. The **Tailwind v3 catalogue lives at a separate domain: `v3.magicui.design`** (per `https://magicui.design/docs/legacy`). You are on 3.4 — **pull from `v3.magicui.design`**, or translate per Appendix B. The v3 set is a subset; the newest components (Light Rays, Noise Texture, Backlight, Glyph Matrix, Progressive Blur, Dia Text Reveal, Text 3D Flip, Hexagon/Striped Pattern, Dotted Map) may be absent there. **The exact v3 registry URL form was not verified — check it before scripting installs.**

Uses `motion` (registry declares `"dependencies": ["motion"]`, source imports `motion/react`) — same package as Animata, so no second animation library. Has an official Vite guide at `/docs/installation/vite`. Contains `"use client"` (strip it); a couple of components may use `next/image` (Tweet Card, Hero Video Dialog are the likely ones) — **grep each `.json` for `next/` before adding.**

Verified components you will actually use: `dock` · `magic-card` · `bento-grid` · `marquee` · `lens` · `globe` · `dotted-map` · `number-ticker` · `text-animate` · `text-reveal` · `blur-fade` · `animated-list` · `border-beam` · `shine-border` · `neon-gradient-card` · `animated-beam` · `meteors` · `particles` · `scroll-progress` · `animated-circular-progress-bar` · `dot-pattern` · `grid-pattern` · `flickering-grid` · `retro-grid` · `ripple` · `warp-background` · `light-rays` · `progressive-blur` · `typing-animation` · `number-ticker` · `word-rotate` · `hyper-text` · `sparkles-text` · `animated-shiny-text` · `aurora-text` · `line-shadow-text` · `morphing-text` · `spinning-text` · `highlighter` (slug is `highlighter`, **not** `text-highlighter`) · `shimmer-button` · `ripple-button` · `rainbow-button` · `pulsating-button` · `shiny-button` · `interactive-hover-button` · `file-tree` · `terminal` · `safari` / `iphone` / `android` device mocks · `confetti` (do not use — see the motion contract).

**Magic UI has no interactive primitives at all** — no modal, tooltip, sidebar, carousel, input, or stateful button. That is what the next two are for.

**shadcn/ui — `https://ui.shadcn.com`** · **MIT.** The interactive primitives: `dialog`, `tooltip`, `sidebar`, `carousel` (Embla), `tabs`, `popover`, `select`. Installs through the same CLI. Note v2.0 of the design language dropped shadcn deliberately — re-adding it is one of the reversals the §10 changelog must record. **Adopt primitives selectively**; do not replace the hand-rolled `Input`/`Select`/`Combobox`, whose ARIA wiring is better than a default install and is covered by tests.

**Animate UI — `https://animate-ui.com`** · **MIT** (confirmed via repo). Animated versions of shadcn primitives — the likely home for the animated dialog, tooltip and stateful button. Component list and Tailwind v3 support **UNVERIFIED**; check `/docs` before committing to it.

**Animata** (§5.2) · **MIT.** Widgets and micro-interactions.

> **Origin UI — do not use.** `originui.com` now redirects to `coss.com/ui`, and `github.com/origin-space/originui` is **AGPLv3 at the repo root** with only `apps/origin/` and `apps/ui/` under MIT. AGPL anywhere near this app is a licensing problem you do not want. Wrong component category anyway.

**Add a `THIRD_PARTY_LICENSES.md` at the repo root** listing every vendored component, its source URL and its licence, and retain each MIT notice. That file is what makes this migration defensible; it is a Phase 2 deliverable, not a Phase 10 one.

### 5.4 recent.design — `https://recent.design`

**Inspiration, not code.** A curated daily gallery (it is the rebranded *Godly* — `godly.website` now redirects here). 250k monthly visitors, 35k+ newsletter subscribers, weekly. No API, no RSS; `sitemap.xml` lists ~780 entry URLs.

Browse by query string, not path: `recent.design/?category=web` · `?category=interface` · `?category=typography` · `recent.design/websites?category=health`. Entries live at `/i/{id}-{slug}` and carry style/colour/interaction/tech tags.

**Use it to validate that a pattern is current before you build it**, and to steal specific mechanics. The entries that matter for this app (all verified, all August 2026 unless noted):

| Entry | Why it matters here |
|---|---|
| **GitHub Contribution Filler** (@ggsimm, 50.1k) | The contribution-heat-grid is *the* habit-tracker idiom and still performs. Build one for the streak. |
| **Digital Stamp Site** (@xian0063) | Paper grain, magnifier lens, pencil UI details on a graph-paper canvas. The texture layer that keeps Glasshouse from being generic. |
| **Receipt Printer** (@dqnamo) | A physical receipt animating out of a printer, light/dark aware. Precedent for a mono-numeral log readout. |
| **Status Chip Components** (@humanharshad) | Semantic status badges with icons — directly applicable to plant states (due / overdue / healthy). |
| **Paper Crumple** (@andyhsuco, 53.3k) | Tactile destructive-action feedback. Consider for discarding a draft log entry. |
| **Tiny Computer Co.** (@tinycompco) | Changelog-as-page-section with typewriter reveal — a model for the growth log. |
| **Journal App** (Hours, 46.7k) | **The anti-reference.** 3D flower creatures blooming as you journal. Do not build this. |
| **SquadEasy** (squadeasy.com) | Bold electric-green team fitness challenges — the closest live analogue to the fitness module. |
| **Superpower**, **Lovi**, **Endel Manifesto**, **Him + Hers** | The health category, such as it is: only 5 entries and mostly legacy. Health/wellness is *under-designed* — an opportunity, not a template. |
| **Postevand** | Minimal + Clean + 3D + Large Type + **Muted** — the palette register for a natural/sustainable product. |

Patterns worth adopting, each observed on real featured work: oversized display type as the layout; editorial layouts applied to product pages (*Shopify Editions*); texture as substrate; monochrome-plus-one-hot-accent (*Dirt*, *SquadEasy*, *Rauno Freiberg*); light/dark shipped as a designed feature rather than a toggle afterthought (called out explicitly in both *Receipt Printer* and *Lovable Journey Stamp*); scroll-driven reveals; skeuomorphic revival done deliberately. React + Tailwind is the default stack of featured work — you are building in the house stack.

### 5.5 rebrand.gallery — `https://rebrand.gallery`

**Identity system reference.** Founded July 2023 by Sahkyo; a curated gallery of rebrands and visual identities. Three content types: **Intros** (reveal videos), **Bentos** (asset grids), **Shots** (individual assets). Entries carry the agency credit, year, industry and style tags, **hex swatches**, and typeface *categories* (Serif/Sans/Display/Script/Handwritten) — note that individual typefaces are usually **not** named, so do not claim a specific typeface from this source. Free to submit; €99 on acceptance. Some entries are behind Rebrand Pro.

Filters: formats (Billboard & OOH, Packaging, Brand guidelines, Signage, Brand motion, Merch, **Editorial & print**, Stationery) · industries (AI, Fintech, Crypto, Hospitality, **Food**, **Healthcare**, Sports, Culture) · styles (Minimalist, Geometric, Playful, Bold, 3D, Retro, **Hand-drawn**, Gradient, Mascot, Wordmark).

Lessons applied to this brief:

1. **Three colours, not a palette.** Bob's Red Mill ships exactly three; Ellis Butchers four. Glasshouse's token set above obeys this — everything beyond ground/ink/leaf/accent is a tint.
2. **Off-white, not white.** `#FFFFFD` and `#FDF2E2` over `#FFFFFF`. Adopted in the light surface token.
3. **Near-black green over blue-slate.** `#002E24` is a real 2026 choice. Adopted in the dark ground.
4. **Wordmark-first over symbol-first.** *Wordmark* is one of ten style filters; keep the PlantPal+ wordmark as the identity anchor rather than commissioning a mark. The existing `SproutMark` is a supporting glyph, not the logo.
5. **Motion identity is the primary artefact in 2026** — the gallery's home grid is entirely logo-motion video, and "Intros" is a top-level content type. Give the wordmark a defined entrance behaviour (used once, on the landing page; never inside the app).
6. **Sub-brand lockups, not sub-brands.** The Calendly rebrand (Smith & Diction) ships "contextual sub-brand lockups across scheduling, payments, and AI features." For three modules — plants / fitness / nutrition — that is the pattern: **one system, three contextual lockups**, expressed through the existing primary/secondary/tertiary inks. Do not give each module its own visual identity.
7. **Data visualisation is an identity component**, not a downstream UI concern (Maiella is tagged *Data Visualization*). Draw the charts in the brand's own vocabulary — hairline grids, mono axis labels, the category inks — rather than accepting a library's defaults.
8. **The icon set is part of the identity.** If you replace the hand-drawn inline SVGs with a library, that is an identity decision and belongs in the design doc, not a silent import.

> **Verification note.** The Healthcare and Sports industry feeds on rebrand.gallery were not opened during research, so no wellness or fitness rebrand is named above. Do not assert one. The food/nature examples are verified and are the strongest evidence for this palette.

---

## 6. Component map — every surface, every component, every file

Rules that apply to the whole map:

- **A component is adopted only if it is token-bound.** Strip every hard-coded colour and replace with the token classes. A pasted component that still contains `bg-slate-900` is not done.
- **Adapt, don't wrap.** Put adapted sources in `apps/web/src/components/aceternity/` and `apps/web/src/components/animata/`, re-export the app-facing version from `src/components/ui.tsx` or a sibling. Screens import from the app's own barrel, never from a vendor folder directly. This keeps the swap surface small.
- **Every adopted component gets a one-line source comment**: `/** Adapted from Aceternity UI <name> — https://ui.aceternity.com/components/<slug>. Token-bound, reduce-motion aware. */`
- **Effort ranking.** Where two components do the same job, prefer the one with fewer dependencies. `focus-cards` (the registry index lists no npm dependencies — confirm at install) beats `card-spotlight` (pulls three.js via `canvas-reveal-effect`) unless the extra weight buys something real.

### 6.0 Source substitution table — read before §6.1

Every Aceternity name in the sections below is now a **visual reference**. Build it from the MIT column. Verified by checking Magic UI's catalogue component by component.

| Wanted (Aceternity name) | MIT route | Notes |
|---|---|---|
| Floating Dock | **Magic UI `dock`** | Direct replacement — cursor-proximity magnification, `iconSize`/`iconMagnification`/`iconDistance` |
| Glowing Effect / Card Spotlight | **Magic UI `magic-card`** | Cursor-tracked radial gradient **and** border glow. `gradientSize`/`gradientColor`/`gradientOpacity`/`gradientFrom`/`gradientTo`. Also `backlight`, `shine-border`, `border-beam`, `glare-hover`. **Bonus: no three.js**, so the Achievements WebGL exception in §8 disappears |
| Bento Grid | **Magic UI `bento-grid`** or Animata `bento-grid/*` | |
| Infinite Moving Cards | **Magic UI `marquee`** | Vertical, reverse, pause-on-hover |
| Lens | **Magic UI `lens`** | Near-identical API — `zoomFactor`, `lensSize`, `isStatic` |
| World Map / Globe | **Magic UI `dotted-map`** / `globe` | Prefer `dotted-map` per the perf budget |
| Text Generate Effect | **Magic UI `text-animate`** `by="word"` | Scroll-driven variant: `text-reveal` |
| Number counter | **Magic UI `number-ticker`** or Animata `text/counter` | |
| Moving Border / Hover Border Gradient | **Magic UI `border-beam`**, `shine-border`, `neon-gradient-card` | |
| Meteors / Spotlight / Aurora Background | **Magic UI `meteors`**, `light-rays`, `warp-background`, `particles` | No direct aurora-background equivalent — hand-roll the mesh with CSS gradients, which is what §4 wants anyway |
| Animated Modal | **shadcn/ui `dialog`** + `motion`, or Animate UI | **Better: keep the existing `Modal`** and port only the entrance animation. Its focus trap is better than a default install |
| Animated Tooltip | **shadcn/ui `tooltip`** + `motion` | |
| Sidebar | **shadcn/ui `sidebar`** + a width transition | Magic UI has none |
| Apple Cards Carousel | **shadcn/ui `carousel`** (Embla) | |
| Stateful Button | **Animate UI**, or write it | ~30 lines: idle → pending → success, awaiting the caller's promise |
| Focus Cards | **Write it** | `group-hover` + `blur-sm` on siblings. Genuinely trivial |
| **Compare** (before/after slider) | **Write it** | No MIT equivalent exists — Magic UI's `code-comparison` is a *code* diff. This is the highest-value component in the brief, so build it: two stacked images, a `clip-path` inset driven by pointer/drag x, a handle, keyboard arrows. Half a day, and it's yours under MIT |
| **Timeline** (scroll-progress vertical) | **Write it** | `motion`'s `useScroll` + `useTransform` on a rail height. Magic UI's `scroll-progress` is a horizontal top bar, not this |
| Tracing Beam | **Write it** or skip | Same mechanism as the timeline rail |
| Multi Step Loader | **Write it** | Magic UI `animated-list` + `animated-circular-progress-bar` get you partway |
| Placeholders And Vanish Input | **Write it** or drop | Magic UI has no inputs. The canvas-vanish is expensive and fights reduce-motion — **recommend dropping it**; rotating placeholders alone give most of the value |
| Container Scroll Animation / Sticky Scroll Reveal / Layout Grid | **Write it** | `useScroll` + `layoutId`. Landing-page only, so cheap to defer |
| Expandable Card | **Write it** with `motion` `layoutId` | The shared-layout transition is ~20 lines |

**Net effect:** roughly two-thirds drops in from MIT sources; about eight components get written. Those eight are mostly small, and three of them (`compare`, the timeline rail, the streak grid) are the most distinctive things in the app — worth owning outright.

### 6.1 Primitives — `src/components/ui.tsx`

Rewrite in place. Keep **all 14 export names and their prop signatures** — a dozen files import them and 72 tests exercise them.

| Export | v3.0 treatment | Source |
|---|---|---|
| `Button` | Glass fill + `--glow-primary` on primary variant. Loading state keeps the label mounted (width must not change — existing behaviour, keep it). | Aceternity `stateful-button` for the async loading→success flow; `hover-border-gradient` for the secondary variant; `moving-border` reserved for the landing CTA only |
| `Input` / `Select` | Glass field, hairline border, focus ring becomes a focus *glow*. Keep native elements, keep `aria-invalid`/`aria-describedby`/`htmlFor` wiring exactly. | — |
| `Combobox` | Keep the entire ARIA implementation untouched (roles, `aria-activedescendant`, the "nothing highlighted until arrow key" convention, the outside-click and blur handling). Restyle the popup only. | Aceternity `placeholders-and-vanish-input` for the *search* variant on Plants/Nutrition, as a separate export — do not replace `Combobox` |
| `Card` | Glass surface: `--glass-bg`, `--glass-border`, 1px `--glass-highlight` top edge, `--shadow-2`, `rounded-lg` | — |
| `Alert` | Tone-tinted glass, left tone edge | — |
| `Spinner` | Keep. One of only two permitted loops. | — |
| `Badge` | Semantic status chips with icons | Pattern from *Status Chip Components* (recent.design) |
| `Progress` | Animated fill with growth easing; keep `aria-valuenow/min/max` and the label/`srLabel` contract | Animata `progress/*` |
| `EmptyState` | Illustrated, inviting | Animata `skeleton/*` family for the loading sibling |
| `ErrorState` | **Stays visually distinct from `EmptyState`.** Accent-tinted, retry button prominent. | — |
| `Modal` | **Keep the entire focus trap, scroll lock, restore-focus and `busy` logic verbatim** — it handles jsdom's null `offsetParent`, focus escaping the panel, and shift-Tab wrap. Only restyle the panel. | Aceternity `animated-modal` for the *entrance animation only*; port the animation into the existing Modal, do not swap the implementation |
| `StatCard` | The centrepiece. Glass tile, `glowing-effect` border, mono value counting up on mount. | Aceternity `glowing-effect` (`lucide-react` only — **not** `card-spotlight`, which pulls three.js via `canvas-reveal-effect`) + Animata `text/counter` |
| `PageHeader` | Display-size heading, optional action slot | Aceternity `text-generate-effect` — **first visit only**, never on re-render |
| `ToastProvider` | Keep the hand-rolled implementation entirely: the pause-on-hover/focus timers, the `role="alert"` vs `role="status"` split, the max-3 stack, the 6.5s error / 4s default timing. Restyle the toast surface and replace the `toast-in` keyframe with the growth easing. | — |

`Glowing Effect` gotcha: **`disabled` defaults to `true`.** Pass `disabled={false}` or nothing renders.

### 6.2 App shell — `src/layouts/AppShell.tsx` + `src/navigation/navItems.tsx`

- **Desktop sidebar** → Aceternity **`sidebar`** (`@tabler/icons-react` + motion). Hover-expand, mobile-responsive. **Replace its `SidebarLink` `<a href>` with react-router `<NavLink>`** — as shipped it does a full page load and destroys client-side routing.
- **Mobile bottom bar** → Aceternity **`floating-dock`**, or keep the current tab bar restyled as glass. The dock is the more distinctive choice; the tab bar is the safer one for thumb reach. Prototype the dock, keep the tab bar if the dock loses a11y or reach.
- **`navItems.tsx`**: fix the documented drift — the six icons are at `strokeWidth={2}` with round caps while everything else is 1.5/square, and the file carries a stale "swap for lucide-react later" comment. Either standardise them to the house convention or commit fully to `@tabler/icons-react` (which several adopted components already pull in) and delete the comment. Decide once, apply everywhere, record it in the design doc.
- **Preserve exactly**: `NAV_ITEMS` as the single source for both navigations; the `module` gating filter with fail-open on `settings === null`; the skip link as first focusable element; the route-change focus move to `<main tabIndex={-1}>` and scroll reset. `AppShell.test.tsx` asserts several of these.
- Ambient background: one very-low-opacity aurora mesh on the app ground. **Static in reduce-motion.** Aceternity `aurora-background` — CSS-only, no JS dependency.

### 6.3 Landing page — `src/pages/LandingPage.tsx` (new)

The GitHub Pages demo currently drops visitors straight onto a login form. Build a real landing page at `/` for unauthenticated visitors; authenticated users continue to the dashboard. **This is where the heavy components live** — it is visited once and costs nothing in daily use. Lazy-load the whole route.

| Section | Component | Source |
|---|---|---|
| Hero | `spotlight-new` + `aurora-background` + `flip-words` cycling "plants · workouts · meals" | Aceternity |
| Wordmark entrance | Motion identity, plays once | Per rebrand.gallery lesson 5 |
| Product shot | `container-scroll-animation` (3D rotate-to-flat) or `macbook-scroll` | Aceternity |
| Three modules | `bento-grid` with the three contextual lockups | Aceternity |
| Feature scroll | `sticky-scroll-reveal` | Aceternity |
| Indian catalogue | `world-map` with arcs to India — the seeded catalogue is 94 plant species and 180 foods, a genuinely distinctive fact worth a section | Aceternity (`dotted-map` dep) |
| Engineering story | `timeline` for the six delivered phases; `code-block` for the algorithm vectors from the README | Aceternity |
| Numbers band | `text/counter` on 228 requirements · 307 tests · 119 user stories | Animata |
| Social proof | `infinite-moving-cards` | Aceternity |
| CTA | `moving-border` button | Aceternity |

**One WebGL component maximum on this page**, and only if it earns its place. `github-globe` pulls `three` + `three-globe` + `@react-three/fiber` + `@react-three/drei` — prefer `world-map` (`dotted-map`, a fraction of the weight) unless the globe is doing something the map cannot.

### 6.4 Auth — `LoginPage`, `RegisterPage`, `AuthLayout`, `NotFoundPage`

- Split layout: glass form panel on an animated ground. `aurora-background` or `background-beams` (not both).
- Form styling from Aceternity `signup-form` (`@radix-ui/react-label`), but **keep the existing `Input` component and its ARIA wiring** — take the visual treatment, not the implementation.
- Submit button: `stateful-button` async flow. It awaits your `onClick` promise, so the existing login/register handlers slot in directly.
- Password strength on `RegisterPage`: `Progress` with tone shifting through tertiary → primary.
- `NotFoundPage`: Animata `text/glitch-text` on the 404, Aceternity `background-boxes` beneath. Keep it a real 404 with a route home — never a silent redirect.

### 6.5 Dashboard — `src/pages/DashboardPage.tsx`

The most-visited screen. Highest polish, tightest performance budget.

| Element | Now | v3.0 |
|---|---|---|
| Greeting + dateline | `PageHeader` | `text-generate-effect` on the greeting, **once per session** (guard with a ref or session flag — re-animating on every dashboard visit is obnoxious) |
| Streak chip | Bordered pill with flame icon | **A contribution heat-grid** — 12 weeks of daily activity, one cell per day, filled with `--color-primary` at four opacity steps. Build it; no library ships this. Pattern per *GitHub Contribution Filler*. Mono count beside it. |
| Stat tiles (1–4, module-gated) | `StatCard` grid | Aceternity `bento-grid` layout + `glowing-effect` borders + Animata `text/counter` on the values. Preserve the `tileCols` logic that adapts 2/3/4 columns to enabled modules. |
| Plants due | `StatCard` | Overdue count glows in `--color-accent` when > 0 |
| Steps | `StatCard` | Animata `widget/weekly-progress` treatment; secondary ink |
| Calories | `StatCard` | Animata `widget/calorie-counter`; tertiary ink |
| Water | not present | Animata `widget/water-tracker` — the nutrition module already tracks water intake; surface it |
| Reminders list | `Card` rows | Glass rows, staggered entrance (max 8, 40ms), swipe-to-dismiss on touch. **Keep the optimistic-removal-with-functional-update logic exactly** — it is written specifically to survive concurrent dismissals. |
| Today list | `Card` rows | Same. Keep `handleLogWater`'s per-item `wateringIds` Set so two plants can be watered concurrently without sharing a spinner. |
| All-caught-up | `EmptyState` | Restyle. Do not celebrate — a glow, not confetti. |
| Loading | Single `Spinner` | Animata `skeleton/*` matching the real layout |
| Errors | Three separate `ErrorState`s (dashboard / reminders / total) | **Keep all three.** This granularity is the "failed request never masquerades as empty" invariant in practice. |

### 6.6 Plants — `PlantsPage`, `PlantDetailPage`

**Plants list**
- Grid → Aceternity **`focus-cards`** (hovered card sharpens, others blur; the registry index lists no npm dependencies — verify at install) or `card-hover-effect`. Prefer `focus-cards`.
- Species search → `placeholders-and-vanish-input` with rotating placeholders drawn from the seeded Indian catalogue ("Tulsi", "Curry leaf", "Money plant"…). Canvas-based, so add the `getContext` stub from §3.5.
- Quick view without navigation → `expandable-card` (needs the extra `hooks/use-outside-click.ts` file; the plain `expandable-card.json` registry path 401s — install the demo variants).
- Card imagery → Animata `image/tilted-cover`.
- Status → `Badge` chips: due / overdue / healthy, in primary / accent / muted.
- Add-plant modal → keep `Modal`; add `multi-step-loader` only if the create flow is genuinely multi-step. Do not fake steps for effect.

**Plant detail — the best opportunity in the app**
- Growth log with photo timeline → Aceternity **`timeline`** (scroll-progress vertical) or **`tracing-beam`**. This is what those components are for.
- **Before/after growth photos → Aceternity `compare`.** A draggable before/after slider over two growth-log photos is the single highest-value component match in this entire brief. Build it.
  - Install (the page pairs it with sparkles — verified): `npx shadcn@latest add @aceternity/compare @aceternity/sparkles`. If you don't want the particle dependency, take the `compare` source alone and drop the sparkle layer.
  - Verified props: `firstImage` · `secondImage` · `className` · `firstImageClassName` · `secondImageClassname` · `initialSliderPercentage` (default 50) · `slideMode` `"hover" | "drag"` (default `"hover"`) · `showHandlebar` (default true) · `autoplay` (default false) · `autoplayDuration` (default 5000).
  - Use `slideMode="drag"` here. Hover-to-compare is unusable on touch, and this is a mobile-first app.
- Photo zoom → `lens`.
- Photo gallery → `apple-cards-carousel` or `parallax-scroll`.
- Care history → Animata `list/transaction-list`.
- Watering schedule → Animata `progress/animatedtimeline`.
- **Photos are URLs, not uploads** (documented known gap: no object storage). Do **not** wire Aceternity `file-upload` to a non-existent endpoint. Either leave the URL field, or install `file-upload` purely as the visual shell over the existing URL input and say so in a comment.

### 6.7 Fitness — `src/pages/FitnessPage.tsx`

- Tabs → Animata `tabs/fluid-tabs` or Aceternity `tabs`.
- Charts → Animata `graphs/bar-chart`, `gauge-chart`. Draw them in the brand vocabulary: hairline grid, mono axis labels, `--color-secondary` series. **Do not install Recharts** — v2.0 dropped it deliberately and these cover the need.
- Steps counter → Animata `text/counter` or `text/ticker`.
- Goal ring → Animata `graphs/gauge-chart`.
- Streak → the same contribution-grid component as the dashboard. Build once, use three times.
- Workout log rows → `list/transaction-list`.
- Log button → `stateful-button`.

### 6.8 Nutrition — `src/pages/NutritionPage.tsx` (the largest page, 40KB)

- **The hand-rolled SVG calorie ring stays.** It has a 700ms `stroke-dashoffset` transition and works. Restyle it with the glow token; do not replace a working custom component with a library one.
- Macro breakdown → Animata `graphs/donut-chart`.
- Food search → `placeholders-and-vanish-input` over the 180-food Indian catalogue.
- Meal log → `list/transaction-list`.
- Water intake → Animata `widget/water-tracker`.
- Daily targets → `Progress` with growth easing.
- Custom food form → keep `Modal`. Note the 200-per-account cap and the no-delete gap — surface the count, don't hide the limit.
- **`NutritionPage.customFood.test.tsx` is one of the more intricate tests.** Run it after every change to this file.

### 6.9 Achievements — `src/pages/AchievementsPage.tsx`

The one page where a heavier effect is justified — it is visited rarely and is inherently celebratory.

- Badge grid → **Magic UI `magic-card`**. This replaces the old plan of Aceternity `card-spotlight`, which pulled `three` via `canvas-reveal-effect` — `magic-card` gives the same cursor-tracked spotlight with no WebGL, so the lazy-load exception is no longer needed here.
- Locked vs unlocked → Animata `card/flip-card`.
- Badge hover detail → Aceternity `animated-tooltip`.
- Featured achievement → `3d-pin`.
- Tier progress → `Progress`.
- Grid → `layout-grid` for click-to-expand.

### 6.10 Settings — `src/pages/SettingsPage.tsx` (35KB, heavily tested)

**Lowest-risk-appetite page in the app.** `SettingsPage.test.tsx` is 16KB and this screen owns the accessibility toggles that everything else depends on.

- Sectioned tabs → Aceternity `tabs`.
- Keep every native form control and its ARIA wiring.
- Save actions → `stateful-button`.
- Accessibility section → **add a live preview** so the user can see reduce-motion / larger-text / high-contrast take effect. This is now a bigger deal than in v2.0, because there is far more motion to reduce.
- Module toggles → glass switches. Server Invariant 34 refuses an all-off state; keep surfacing that clearly.
- Danger zone (account deletion) → `--color-accent`, `--glow-accent`, no glass. Destructive actions should not look soft.

### 6.11 Onboarding — `src/pages/OnboardingPage.tsx`

- Step progression → Aceternity `multi-step-loader` for the completion sequence; `container-scroll-animation` between steps.
- Progress → `Progress` or a stepper from 21st.dev's **Steppers (124)** category.
- Preloader → Animata `preloader/split-reveal`.
- **Read the existing header comment before changing routing.** Nothing currently redirects into onboarding because no endpoint exposes `profiles.onboarding_completed_at`; it is reached by link only. Do not "fix" that as part of a restyle — it is a known API gap, not a UI bug.

---

## 7. The accessibility contract — extended for glass and motion

Everything in `01-design-language.md` §8 carries forward. Glass and motion add four new obligations.

1. **Glass must not eat contrast.** Composite `--glass-bg` over `--color-background` and measure the *result*, not the token. This is where glassmorphism designs normally fail WCAG. Body text 4.5:1, large text and UI boundaries 3:1. Check both themes.
2. **High contrast switches glass off**, per the `[data-high-contrast]` block in §4. Verify visually with the toggle on: every card must still have a visible boundary, because in this design the border carries all the structure.
3. **Reduce-motion is load-bearing, not cosmetic.** Wire `MotionConfig` once at the root from `useReducedMotion()`, which reads *both* the OS media query and `[data-reduce-motion]`. Then verify by hand: turn the in-app toggle on and walk every screen. Nothing may become unreachable, unreadable, or stuck mid-transition. Scroll-driven components are the usual offenders — a `timeline` whose content only appears at scroll progress > 0 is broken under reduce-motion.
4. **Larger text still scales everything.** `[data-larger-text]` sets root font-size to 112.5% and every size in the app is rem-based. Any hard-coded `px` you introduce in a pasted component breaks this. Convert them.

Unchanged and still mandatory: focus-visible rings on every interactive element (accent ring on destructive), `text-on-primary` never raw white, skip link first in tab order, route-change focus to `<main>`, `role="alert"` for errors and `role="status"` + `aria-live="polite"` for non-errors, `aria-busy` on loading buttons, progress bars with `aria-valuenow/min/max` and an accessible name.

**New in v3.0:** every decorative animated element gets `aria-hidden`. A shimmering border is not content.

---

## 8. Performance budget — a hard limit

This ships to GitHub Pages, talks to a free-tier Render API that sleeps after 15 idle minutes, and is used on Indian mobile connections. The budget is part of the design.

| Constraint | Limit |
|---|---|
| Interior route JS (Dashboard, Plants, Fitness, Nutrition, Settings) | **≤ 250 KB gzip** including shared chunks |
| Landing route | ≤ 400 KB gzip, lazy-loaded |
| WebGL routes | **Ideally zero.** Magic UI's `magic-card` replaces `card-spotlight` without three.js, which removes the only reason the app had for a WebGL route. If one survives: at most one, lazy-loaded, never Dashboard. |
| Largest Contentful Paint, dashboard, 4G | ≤ 2.5s |
| Cumulative Layout Shift | ≤ 0.1 — skeletons must match the real layout's dimensions |
| Long tasks on route change | none > 200ms |

Rules that follow:

- **Route-level code splitting** via `React.lazy` + `Suspense` in `App.tsx`. The landing and achievements routes must not be in the initial bundle.
- **`motion` costs ~34 KB gzip.** Use `LazyMotion` with `domAnimation` features rather than the full bundle, and import the `m` component instead of `motion` in interior screens.
- **Never install `three`, `three-globe`, `@react-three/fiber` or `@react-three/drei` for an interior screen.** They are ~600 KB+ combined. If `card-spotlight` on Achievements pushes past budget, downgrade to `glowing-effect`.
- **`@tsparticles/*` (Sparkles) is heavy.** Landing page only, or skip it.
- **Audit after every phase**: `npm run build --workspace @plantpal/web` and read the chunk sizes Vite prints. If a chunk grew unexpectedly, find out what you pulled in before moving on.
- **`backdrop-filter` is a GPU cost.** Cap it: at most two blurred layers stacked at any point, and never blur a scrolling list's rows individually — blur the container.

---

## 9. Tests — 72 web tests, and how not to lie to them

`apps/web` has 72 component and behaviour tests under jsdom, part of **347 across the monorepo** (335 passing + 12 skipped — not the 307 the README claims; the drift is entirely in the API suite). They exist because two adversarial multi-agent audits found and closed 6 critical and 4 major defects. Treat them as the specification.

Test files you will touch: `components/ui.test.tsx` · `layouts/AppShell.test.tsx` · `pages/NutritionPage.customFood.test.tsx` · `pages/OnboardingPage.test.tsx` · `pages/PlantDetailPage.growth.test.tsx` · `pages/PlantsPage.edit.test.tsx` · `pages/SettingsPage.test.tsx` · `lib/apiClient.test.ts` · `lib/errorMessages.test.ts`

**The rule: never weaken a test to make a restyle pass.** When a test breaks, classify it in the commit message:

| Class | Meaning | Action |
|---|---|---|
| **A — real regression** | The test asserts user-visible behaviour (a role, a label, focus order, an announcement) and the restyle broke it | Fix the code. Never the test. |
| **B — brittle selector** | The test queried a class name, a DOM shape, or a text string that was incidental | Fix the test to query by role/label instead, and say so |
| **C — genuinely obsolete** | The interaction itself changed by design (e.g. a tab bar became a dock) | Rewrite the test for the new interaction, and justify the change in the commit body |

Anything you cannot confidently put in a class is class A. Assume regression.

**Setup work (Phase 0):** add the jsdom stubs from §3.5 — `IntersectionObserver`, `ResizeObserver`, `HTMLCanvasElement.getContext`, and `MotionGlobalConfig.skipAnimations = true`. Do not stub these inside individual test files.

**New tests to add** (these are part of "done", not optional extras):

1. `[data-reduce-motion]` on `<html>` results in no running animations on the dashboard.
2. `[data-high-contrast]` switches glass tokens to opaque surfaces.
3. `[data-larger-text]` scales the shell without overflow.
4. Module gating still hides nav items and dashboard tiles in the new navigation.
5. `ErrorState` and `EmptyState` remain distinguishable — assert on role and retry affordance, not styling.
6. The lazy-loaded WebGL route is not imported by any interior route (a static import-graph assertion or a bundle-size check).

Run at every gate:

```bash
npm run typecheck
npm run lint
npm test
npm run build --workspace @plantpal/web
```

The 12 auth integration tests skip themselves without `DATABASE_URL` — that is expected and not a failure.

**Count drift is itself a finding.** If the totals move for a reason you did not cause, say so in the gate report rather than adjusting the expected number silently. CI runs `typecheck` + `test` on Node 20.11 and 22 against a real PostgreSQL service container on every push and PR to `main`.

---

## 10. Mobile parity — `apps/mobile`

**None of the five sources work in React Native.** Aceternity, Animata and 21st.dev are all DOM + Tailwind CSS. Do not attempt to install them. This is a parallel implementation that *matches the language*, not the code.

Current state: Expo 57, RN 0.86, **React 19.2**, TS 6.0, no animation library, no NativeWind. `src/theme.ts` exports the eleven tokens as a `Palette` object plus `space`, `monoFont`, and the `danger`/`warning`/`success` aliases. `src/components/ui.tsx` is the hand-rolled native primitive set. Nine screens.

Work:

1. **Mirror every new token** in `theme.ts` — including the glass, glow and shadow groups. Native names stay camelCase (`glassBg`, `glowPrimary`, `surfaceRaised`).
2. **Add `react-native-reanimated`** (Expo SDK 57 supported) for the motion contract. Optionally `expo-blur` for real glass and `expo-linear-gradient` for the ambient mesh. Nothing else.
3. **Translate the motion contract** — same durations, same easings, same growth-not-slide rule. Reanimated's `withTiming` with a matching bezier.
4. **Reduce-motion on native** reads `AccessibilityInfo.isReduceMotionEnabled()` *and* the app's own setting. The in-app preference must work independently of the OS one, exactly as on web.
5. **Do not break the offline outbox.** `OutboxIndicator` and `OutboxProvider` must stay visible and legible on the new surfaces — 24 tests cover the outbox and it is the app's most load-bearing offline behaviour.
6. **Keep the elevation honest.** iOS shadows and Android elevation diverge; use `theme.ts` to express the four-step scale per platform rather than scattering `Platform.select` through screens.

Note the React version split: web is React 18.3, mobile is React 19.2. Keep them separate; do not unify as part of this work.

---

## 11. Documentation — the part that makes this a real project

This repository's stated premise is that every artefact traces to the requirement it satisfies. A restyle that ships without doc updates breaks that.

### `docs/design/01-design-language.md` → v3.0

Rewrite following the **existing structure exactly** — sections 1–10, same headings, same table shapes. v2.0's §10 "What Changed From v1.0" is the model; v3.0 needs the equivalent **§10 "What Changed From v2.0"**, and it must be honest:

| v2.0 said | v3.0 ships | Why |
|---|---|---|
| Hairlines over shadows; no `box-shadow` anywhere | Four-step elevation scale + glass surfaces | *(state the real trade: what v2.0 gained in density and calm, and what v3.0 buys with depth)* |
| Sharp corners — 2px controls, 4px containers | 6/10/16/22px scale; metrics still in square cells | |
| Near-zero motion; six functional transitions total | A motion system with durations, easings and a stagger cap | *(and state the cost: a larger reduce-motion surface to verify)* |
| Dependency-free component layer | `motion`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, icon library, adapted vendor components | *(v2.0 dropped shadcn/Lucide/Framer Motion/Recharts by name — record the reversal of each, including which ones stayed dropped: Recharts and NativeWind should remain out)* |
| Light default, dark as a flip | Dark-first, light derived | |

Also update: §2 token tables (both themes, plus the new glass/glow/shadow groups), §5 radii, §6 icons (record whichever icon decision you made), §7 motion (replace wholesale), §8 accessibility (add the four glass/motion obligations), §9 the shipped Tailwind config.

### `docs/design/02-component-inventory.md`

Update the component tables, and extend **§7 (dependency decisions)** with the reversal record: what is being added, from where, under what licence, and the per-component source URL. Note explicitly that Aceternity's licence is **unverified** and must be confirmed before any commercial use.

### `README.md`

- "Technology" section: record the new web dependencies.
- The Phase table: Phase 2 (Design) and Phase 3 (Implementation) both have new work under them. Add a line rather than silently changing a ✅.
- **Correct the test count.** The README says 307; the repo has 347 (335 + 12 skipped). Restate the per-workspace breakdown with the real API figure.
- Keep every "Known gaps" entry accurate — the restyle does not close any of them. Photos are still links, quiet hours still unenforced, no purge sweep, no password reset delivery, custom foods still undeletable.

---

## 12. Execution plan — phases and gates

Work phase by phase. **Stop at each gate.** Every gate runs the full command set and produces one commit.

```bash
npm run typecheck && npm run lint && npm test && npm run build --workspace @plantpal/web
```

| Phase | Work | Gate condition |
|---|---|---|
| **0 — Foundation** | `@/` alias in all three configs · `src/lib/utils.ts` with the strict-mode-safe `cn` · install `motion clsx tailwind-merge tailwindcss-animate` · jsdom stubs in `src/test/setup.ts` · `useReducedMotion` hook · `MotionConfig` in `App.tsx` | **All 307 tests pass and the app looks identical.** Zero visual change in Phase 0. If anything looks different, you did too much. |
| **1 — Tokens** | v3.0 tokens in `index.css` · `tailwind.config.js` colours, radii, keyframes, animation · `[data-high-contrast]` glass override · mirror in `apps/mobile/src/theme.ts` | Contrast checks pass in both themes and in high-contrast. Tests green. |
| **2 — Primitives** | **First: create `THIRD_PARTY_LICENSES.md` and confirm every source you are about to vendor is MIT.** Then rewrite `src/components/ui.tsx`. All 14 exports keep their names and signatures. | `ui.test.tsx` green **without edits**. If it needs edits, classify them per §9. **No Aceternity source anywhere in `apps/web`** — grep for it. |
| **3 — Shell** | `AppShell`, `navItems`, ambient background, route-level lazy loading | `AppShell.test.tsx` green. Module gating verified by hand with each toggle off. |
| **4 — Auth + landing** | Login, Register, AuthLayout, NotFound, new LandingPage + route | Landing route absent from the initial bundle (check the Vite chunk output). |
| **5 — Dashboard** | Tiles, contribution grid, reminders, today list, skeletons | All three `ErrorState` branches still reachable — test by forcing failures. Interior bundle ≤ 250 KB gzip. |
| **6 — Plants** | PlantsPage, PlantDetailPage, `compare` before/after, timeline | `PlantsPage.edit.test.tsx` and `PlantDetailPage.growth.test.tsx` green. |
| **7 — Fitness + Nutrition** | Charts, tabs, counters, calorie ring restyle | `NutritionPage.customFood.test.tsx` green. |
| **8 — Achievements + Settings + Onboarding** | Badge grid, settings tabs + a11y live preview, onboarding steps | `SettingsPage.test.tsx` and `OnboardingPage.test.tsx` green. Achievements route lazy-loaded. |
| **9 — Mobile parity** | Tokens, reanimated, primitives, nine screens | Mobile typecheck + the 24 outbox tests green. Outbox indicator legible. |
| **10 — Docs + audit** | Design language v3.0, component inventory, README · full a11y pass · full perf pass · new tests from §9 | Every §12 checklist item ticked. |

**Commit discipline.** One commit per phase, on a branch (`feat/glasshouse-ui`), never directly on `main`. Commit body states: what changed, which tests were touched and under which class (A/B/C), and the measured bundle delta.

---

## 13. Definition of done

Do not report completion until every line is true.

**Correctness**
- [ ] `npm run typecheck` clean across all four workspaces
- [ ] `npm run lint` clean
- [ ] `npm test` — no regressions against the 347-test baseline (335 passing + the same 12 auth integration tests skipping without `DATABASE_URL`)
- [ ] `npm run build --workspace @plantpal/web` succeeds
- [ ] No test was weakened; every modified test is classified A/B/C in a commit body
- [ ] `tsconfig.base.json` strict flags unchanged — nothing relaxed to accommodate vendor code

**Design system**
- [ ] Zero hard-coded colours in any component; everything resolves through a token
- [ ] `--color-on-primary` inverts correctly and passes AA in both themes
- [ ] Every metric in the app is `font-mono`
- [ ] Web and mobile token names match one-for-one
- [ ] Every adopted vendor component carries its source-URL comment

**Accessibility**
- [ ] Glass-composited text contrast measured and passing in both themes
- [ ] `[data-high-contrast]` disables glass and glow; every card still bounded
- [ ] `[data-reduce-motion]` walked screen by screen — nothing unreachable or stuck
- [ ] `[data-larger-text]` scales without overflow; no hard-coded px introduced
- [ ] Focus visible everywhere; skip link first; route-change focus lands on `<main>`
- [ ] Errors announce; non-errors don't steal focus; decorative animation is `aria-hidden`

**Performance**
- [ ] Interior routes ≤ 250 KB gzip; landing ≤ 400 KB, lazy
- [ ] At most one WebGL route, lazy-loaded, not Dashboard
- [ ] CLS ≤ 0.1 — skeletons dimensionally match their content
- [ ] Bundle deltas recorded per phase

**Behaviour preserved**
- [ ] Module gating works with each toggle off, fails open while settings load
- [ ] `EmptyState` and `ErrorState` remain visually and semantically distinct
- [ ] Optimistic reminder dismissal still survives concurrent dismissals
- [ ] Concurrent watering still uses per-item loading state
- [ ] Modal focus trap, scroll lock and focus restore unchanged
- [ ] Combobox ARIA behaviour unchanged
- [ ] Toast timing, pause-on-hover and role split unchanged
- [ ] Mobile offline outbox indicator visible and legible

**Documentation**
- [ ] `01-design-language.md` at v3.0 with an honest §10 changelog
- [ ] `02-component-inventory.md` §7 records every re-added dependency and its licence position
- [ ] `README.md` technology and phase tables updated; Known gaps still accurate
- [ ] `THIRD_PARTY_LICENSES.md` exists, lists every vendored component with source URL and licence, and retains each MIT notice
- [ ] **No Aceternity-derived source in the repository** — verified by grep, not by memory
- [ ] Magic UI components taken from the Tailwind v3 catalogue, or translated per Appendix B

---

# Appendix A — Verified component index

Everything below was confirmed to exist at the URL given. Anything unverified is marked. Do not invent component names; if something you want isn't here, look it up before writing an install command.

## A.1 Aceternity UI

Canonical URL: `https://ui.aceternity.com/components/<slug>` · Registry: `https://ui.aceternity.com/registry/<name>.json`

**Backgrounds & ambient** — `background-beams` (motion) · `background-beams-with-collision` (motion) · `aurora-background` (CSS only) · `spotlight` · `spotlight-new` · `sparkles` (@tsparticles/* — heavy) · `meteors` · `shooting-stars-and-stars-background` · `grid-and-dot-backgrounds` · `wavy-background` (simplex-noise) · `vortex` (simplex-noise) · `lamp-effect` (registry name `lamp`) · `hero-highlight` (mini-svg-data-uri) · `background-gradient` · `background-gradient-animation` · `background-lines` · `background-boxes` · `background-ripple-effect` · `dotted-glow-background` · `noise-background` · `google-gemini-effect` · `svg-mask-effect` · `canvas-reveal-effect` (**three + @react-three/fiber**) · `glowing-stars-effect` · `dither-shader` · `cloud-shader`

**Text** — `text-generate-effect` · `typewriter-effect` · `flip-words` · `text-hover-effect` · `text-reveal-card` · `colourful-text` · `container-cover` (page title "Cover") · `container-text-flip` · `layout-text-flip` · `pointer-highlight` · `squiggly-text` · `encrypted-text` · `text-flipping-board` · `canvas-text` · `ascii-art`

**Cards** — `3d-card-effect` (registry `3d-card`) · `card-hover-effect` · `evervault-card` · `wobble-card` · `glare-card` · **`focus-cards` (registry lists no deps)** · `expandable-card` (needs `hooks/use-outside-click.ts`; install the demo variants) · `card-stack` · `card-spotlight` (**pulls three via canvas-reveal-effect**) · `comet-card` · `draggable-card` · **`glowing-effect` (lucide-react only — the dashboard workhorse)** · `bento-grid` (@tabler/icons-react, no JS animation) · `direction-aware-hover` · `tooltip-card` · `cards-free`

**Buttons & inputs** — `moving-border` · `hover-border-gradient` · `tailwindcss-buttons` · `stateful-button` · `magnetic-button` · `placeholders-and-vanish-input` · `gooey-input` · `signup-form` (registry `input`, `label`) · `file-upload` (@tabler/icons-react, react-dropzone) · `loader` · `multi-step-loader`

**Navigation & layout** — `sidebar` · `floating-dock` · `floating-navbar` · `resizable-navbar` · `navbar-menu` · `tabs` (page title "Animated Tabs") · `animated-modal` · `sticky-banner` · `layout-grid` · `timeline` · `code-block` (react-syntax-highlighter) · `terminal` · `keyboard` · `notch`

**Scroll & parallax** — `sticky-scroll-reveal` · `tracing-beam` · `container-scroll-animation` · `macbook-scroll` · `parallax-scroll` (+`parallax-scroll-2`) · `parallax-hero-images` · `hero-parallax` · `hero-sections-free` · `feature-sections-free`

**Media & data** — `infinite-moving-cards` · `apple-cards-carousel` · `carousel` · `images-slider` · **`compare`** · `lens` · `animated-testimonials` · `3d-marquee` · `chromatic-image` · `pixelated-canvas` · `webcam-pixel-grid` · `images-badge` · `scales`

**3D & maps** — `github-globe` (registry `globe`; three + three-globe + fiber + drei) · `3d-globe` · `world-map` (dotted-map — the light alternative) · `3d-pin`

**Pointer & tooltips** — `animated-tooltip` · `following-pointer` · `link-preview` (@radix-ui/react-hover-card, qss)

**Slug corrections** worth knowing: "Shooting Stars" and "Stars Background" share one page (`shooting-stars-and-stars-background`) · "Cover" is `container-cover` · "Meteors" is titled "Meteor Effect" · "Globe" is `github-globe` · "Tabs" is titled "Animated Tabs" · "Parallax Scroll" is titled "Parallax Grid Scroll" · "Expandable Card" is titled "Expandable Cards".

**Not free components:** Testimonials and Pricing exist only as paid blocks (`/blocks/testimonials`, `/blocks/pricing-sections`). **"Animated Icons" does not exist on Aceternity** — no component or registry entry by that name was found.

**Paid boundary:** ~110 free components at `/components/*`. Paid = Blocks (`/blocks/<category>` — hero-sections, feature-sections, illustrations, backgrounds, navbars, testimonials, logo-clouds, bento-grids, cta-sections, login-and-signup-sections, pricing-sections, empty-states, blog-sections, cards, contact-sections, faqs, footers, stats-sections, team-sections, text-animations, shaders, sidebars) and Templates. Pro is Next.js 15 + Tailwind v4 first and would need porting. **Everything this brief needs is free.**

## A.2 Animata — `https://animata.design/docs/<category>/<slug>`

**Widget (30) — mine this first.** Square: `cycling` `battery-level` `alarm-clock` `calendar-event` `live-score` `direction-card` `expense-tracker` `flight-widget` `fund-widget` `mobile-detail` `profile` `score-board` `storage-widget` **`water-tracker`** `battery` `weather-card` **`weekly-progress`** `clock-with-photo` `music-widget` `sleep-tracker` `reminder` `vpn-widget` `study-timer` `security-alert` `delivery-card` · Tall: `storage-status` **`calorie-counter`** `reminder-widget` `notes` `shopping-list`

**Text (40)** — `animated-gradient-text` `blur-out-up` `bold-copy` `bottom-up-letters` `circular-text` **`counter`** `cycle-text` `double-underline` `fade-through` `focus-blur-resolve` `gibberish-text` `glitch-text` `jitter-text` `jumping-text-instagram` `kinetic-center-build` `line-by-line-slide` `mask-reveal-up` `micro-scale-fade` `mirror-text` `per-character-rise` `per-word-crossfade` `scale-down-fade` `shared-axis-y` `shared-axis-z` `shimmer-sweep` `roll-text` `short-slide-down` `short-slide-right` `soft-blur-in` `split-text` `spring-scale-in` `swap-text` `text-border-animation` `text-explode-imessage` `text-flip` **`ticker`** `top-down-letters` `typing-text` `underline-hover-text` `wave-reveal`

**Background (10)** — `animated-beam` `blurry-blob` `boids-ecosystem` `diagonal-lines` `dot` `grid` `interactive-grid` `moving-gradient` `shooting-stars` `zigzag`

**Button (13)** — `work-button` `shining-button` `arrow-button` `swipe-button` `external-link-button` `get-started-button` `algolia-white-button` `algolia-blue-button` `duolingo` `ai-button` `add-to-cart` `status-button` `slide-arrow-button`

**Card (11)** — `card-comment` `card-spread` `card-stack` `case-study-card` `collab-card` `flip-card` `github-card-shiny` `github-card-skew` `glowing-card` `led-board` `swap-text-card`

**List (7)** — `avatar-list` `flipping-cards` `menu-animation` `orbiting-items` `orbiting-items-3-d` `reveal-image` **`transaction-list`**

**Skeleton (6)** — `code` `cookie-banner` `list` `receipt` `report` `wide-card`

**Container (5)** — `animated-border-trail` `announcement-ribbon` `cursor-tracker` `marquee` `sibling-focus-nav`

**Image (5)** — `disclose-image` `images-reveal` `skew-image` `tilted-cover` `trailing-image`

**Graphs (5)** — `bar-chart` `donut-chart` `gauge-chart` (two further names UNVERIFIED — the index page 403'd)

**Hero (4)** — `hero-section-text-hover` `product-features` `shape-shifter` `slack-intro` · **Bento grid (3)** — `gradient` `three` `eight` · **Tabs (3)** — `fluid-tabs` `gooey-tabs` `shift-tabs` · **FABs (2)** — `flower-menu` `speed-dial` · **Icon (2)** — `hover-interaction` `icon-ripple` · **PreLoader (2)** — `split-reveal` `vertical-tiles` · **Progress (2)** — `animatedtimeline` `spinner` · **Overlay (1)** — `modal` · **Scroll (1)** — `stacked-sections`

Install: `npx shadcn@latest add https://animata.design/r/<category>/<slug>.json`. Note `https://animata.design/r/registry.json` is a 404 — there is no browsable index endpoint.

## A.3 21st.dev categories (with live counts)

Index `https://21st.dev/community/components` · category `https://21st.dev/community/components/s/<slug>` or `https://21st.dev/s/<slug>`

**Most relevant here:** Dashboards (400) · Charts & Data Viz (246) · Progress (375) · Grids & Bento (620) · Empty States (77) · Onboarding (53) · Steppers (124) · Spinner Loaders (480) · Sidebars (95) · Tabs (239) · Toasts (79) · File Uploads (154) · Calendars (239) · Stats & KPIs (153) · Search Bars (218) · Date Pickers (250) · Notifications (247)

**Also available:** Accordions (234) · AI Chats (248) · Alerts (240) · Avatars (597) · Badges (605) · Buttons (2,043) · Cards (1,780) · Carousels (239) · Checkboxes (238) · Cursors (152) · Dialogs (328) · Dropdowns (506) · File Trees (61) · Forms (1,522) · Globes (41) · Icons (851) · Inputs (949) · Links (354) · Lists (349) · Menus (287) · Numbers (54) · Paginations (130) · Popovers (179) · Profiles (270) · Radio Groups (152) · Selects (316) · Sliders (217) · Tables (313) · Tags (74) · Text Areas (187) · Toggles (532) · Tooltips (267)

**Marketing blocks:** Heroes (1,152) · Texts (663) · Calls to Action (501) · Navigation Menus (477) · Images (428) · Backgrounds (365) · Features (318) · Scroll Areas (293) · Galleries (272) · Pricing Sections (216) · FAQs (191) · Testimonials (161) · Videos (162) · Stats & KPIs (153) · Steppers (124) · Marquees (113) · Borders (111) · Timelines (74) · Announcements (71) · Footers (65) · Maps (51) · Hooks (51) · Docks (49) · Comparisons (31) · Clients (17)

Component URL shape: `https://21st.dev/@<author>/components/<slug>`. Verified examples: `@manuarora700/container-scroll-animation` · `@arunachalam/scroll-expansion-hero` · `@serafimcloud/splite` · `@easemize/spotlight-card` · `@jatin-yadav05/radial-orbital-timeline` · `@sshahaider/testimonials-columns-1` · `@kokonutd/background-paths` · `@tommyjepsen/animated-hero` · `@preetsuthar17/button` · `@prebuiltui/button-ui/button-variants` · `@reuno-ui/pearl-button`. Mirrored libraries on the platform: Aceternity UI (87), Magic UI (62), shadcn/ui (87), Origin UI (44), Geist (87).

---

# Appendix B — Tailwind v4 → v3.4 translation recipe

Aceternity component pages now lead with Tailwind v4 CSS-first syntax. This repo is on **Tailwind 3.4**. The translation is mechanical:

> A v4 `--animate-<name>: <value>` token becomes a v3 `theme.extend.animation['<name>'] = '<value>'` entry, and the nested `@keyframes` becomes a `theme.extend.keyframes` entry with camelCased CSS properties.

**Given (v4, from the site):**

```css
@theme inline {
  --animate-aurora: aurora 60s linear infinite;
  @keyframes aurora {
    from { background-position: 50% 50%, 50% 50%; }
    to   { background-position: 350% 50%, 350% 50%; }
  }
}
```

**Write (v3.4, in `apps/web/tailwind.config.js`):**

```js
theme: { extend: {
  animation: { aurora: 'aurora 60s linear infinite' },
  keyframes: {
    aurora: {
      from: { backgroundPosition: '50% 50%, 50% 50%' },
      to:   { backgroundPosition: '350% 50%, 350% 50%' },
    },
  },
}}
```

Keyframes you will need, from verified v4 sources:

| Component | v4 token | v3 animation value | Keyframes |
|---|---|---|---|
| Aurora Background | `--animate-aurora` | `aurora 60s linear infinite` | as above |
| Meteor Effect | `--animate-meteor-effect` | `meteor 5s linear infinite` | `0% { transform: rotate(215deg) translateX(0); opacity: 1 }` · `70% { opacity: 1 }` · `100% { transform: rotate(215deg) translateX(-500px); opacity: 0 }` |
| Spotlight | `--animate-spotlight` | `spotlight 2s ease .75s 1 forwards` | `0% { opacity: 0; transform: translate(-72%,-62%) scale(.5) }` · `100% { opacity: 1; transform: translate(-50%,-40%) scale(1) }` |
| Infinite Moving Cards | `--animate-scroll` | `scroll var(--animation-duration,40s) var(--animation-direction,forwards) linear infinite` | `to { transform: translate(calc(-50% - .5rem)) }` |

**Workflow after installing any component:** grep its source for `animate-`, for `--<colour>` CSS variables, and for `@theme`. Port each to `tailwind.config.js` before assuming the component is broken.

**The `addVariablesForColors` plugin.** Some v3-era Aceternity components read raw Tailwind palette colours as CSS variables in inline styles (`--blue-500`, `--violet-200`). The classic plugin flattens the palette into `:root` variables. Its verbatim published source could not be verified — the `/docs/tailwind-css-config` URL 404s and pages now lead with v4 — so **verify before relying on it**. The widely-used shape:

```js
// UNVERIFIED verbatim — confirm against a current component's requirements
const flattenColorPalette = require('tailwindcss/lib/util/flattenColorPalette').default
function addVariablesForColors({ addBase, theme }) {
  const all = flattenColorPalette(theme('colors'))
  addBase({ ':root': Object.fromEntries(Object.entries(all).map(([k, v]) => [`--${k}`, v])) })
}
// plugins: [addVariablesForColors]
```

Prefer to avoid it: in a token-bound design you should be replacing those raw palette references with PlantPal+ tokens anyway, which removes the need for the plugin entirely.

---

# Appendix C — Reference board

Pin these while working. Every one was verified at the URL given.

**Palettes to work from** (rebrand.gallery, 2026)

| Brand | Agency | Hexes | Take |
|---|---|---|---|
| Ellis Butchers | Studio Blackburn | `#000000` `#002E24` `#F23900` `#FFFFFD` | Near-black green + hot orange + off-white. The Glasshouse dark theme is built from this logic. |
| Bob's Red Mill | Turner Duckworth | `#412A2E` `#E03C32` `#FDF2E2` | Three colours total. Hand-drawn, script and serif — heritage without nostalgia. |
| Maiella | Multiverse Studio | Dark green / accent green / white | Single-hue tonal system, tagged *Data Visualization*. Proof a green-only system carries a data product. |
| Instagram 2026 | — | — | Gradients + hand-drawn + a defined icon set. Rigour plus one warm human element. |

**Mechanics to steal** (recent.design)

- Contribution heat-grid → *GitHub Contribution Filler* (@ggsimm)
- Paper grain + graph paper + magnifier → *Digital Stamp Site* (@xian0063)
- Printed ledger readout, light/dark aware → *Receipt Printer* (@dqnamo)
- Semantic status chips → *Status Chip Components* (@humanharshad)
- Tactile destructive feedback → *Paper Crumple* (@andyhsuco)
- Changelog-as-section with typewriter reveal → *Tiny Computer Co.*
- Editorial layout on a product page → *Shopify Editions*
- Interactive typographic explainer → *Leading and Measure* (Josh Puckett)

**The anti-reference:** *Journal App* by Hours — 3D flower creatures blooming as you log, collectible insights garden. The maximalist version of this product. Glasshouse is glass and light, not creatures.

**Closest live analogue:** *SquadEasy* — bold electric-green team fitness challenges.

**Health/wellness on recent.design is thin** — five entries, mostly legacy: Superpower, Lovi, Endel Manifesto, Him + Hers, SquadEasy. Nutrition and plants are effectively absent. Read that as headroom: there is no dominant visual language for this category to conform to.

---

## One-line source-of-truth summary

- **Aceternity UI** → ⛔ **visual reference only, never vendored.** Its licence forbids redistributing source files "regardless of modifications", and this repo is public and MIT. Browse it for ideas; build from the MIT column in §6.0.
- **Magic UI** (`magicui.design`, **MIT**) → the structural replacement. Tailwind v3 catalogue at **`v3.magicui.design`**. Uses `motion`, same as Animata.
- **shadcn/ui** (**MIT**) → interactive primitives Magic UI lacks: dialog, tooltip, sidebar, carousel.
- **Animata** (this is what "animaster" meant — no such library exists) → widgets and micro-interactions. `npx shadcn@latest add https://animata.design/r/<cat>/<slug>.json`. **MIT.** Needs `tailwindcss-animate` on Tailwind 3.4.
- **21st.dev** → gap-filling via MCP: `npx @21st-dev/cli@latest init --client claude`. Per-author licences — check each. Free tier: 2 copies/day.
- **recent.design** → inspiration and pattern validation. No API, no RSS; browse by `?category=`.
- **rebrand.gallery** → identity and palette logic. Agencies and hexes are reliable; typeface names are not.
- **Everything must end up token-bound, reduce-motion-safe, inside the performance budget, and passing all 307 tests.**
