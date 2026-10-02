# PlantPal+ Design Language

| Field | Value |
| --- | --- |
| Document | `01-design-language.md` — Visual direction and core UI theme tokens |
| Version | 4.0 "Conservatory" |
| Updated | 2026-10-02 |
| Owner | Rakshit |

> **v4.0 supersedes v3.0 "Glasshouse" and v2.0 "field notebook".** This document describes what is in the repository today. §11 records how the language got here and why each change was made, so an older reading of the design is explained rather than silently contradicted.

## 1. Visual Direction

PlantPal+ looks after three living things — your plants, your body and your diet — so the interface is a **conservatory at two hours of the day**. Light mode is ivory paper and deep emerald ink under morning glass; dark mode is a botanical noir: near-black with a green undertone, luminous emerald, moonlit sky and champagne gold.

Surfaces are **panes of glass**: translucent, softly blurred, lit along their top edge and resting on a layered shadow, so depth reads as one material. Behind them sits a slow **aurora** — the three module inks as washes of light — and a few percent of film grain, which is what stops a large gradient reading as a rendering bug. Page titles are set in an expressive **display serif**; everything you operate is set in a quiet grotesque.

The v2.0 ledger survives underneath every surface. **Every metric is still set in a monospace with tabular figures**, so grams, millilitres, steps and streak counts line up like entries in a book; rules that merely separate content are still hairlines; and colour is still scarce enough that a glowing emerald button always means "act".

Design tenets, in priority order:

1. **Tokens are the only styling truth.** Every colour resolves through a CSS custom property, mapped in `tailwind.config.js` and mirrored in `apps/mobile/src/theme.ts`. No component hard-codes a hex value.
2. **Contrast is measured, not guessed.** Each ink is checked against every ground it can sit on, including glass composites, by `apps/web/src/test/tokens.test.ts` on every test run.
3. **Numbers are mono.** If a value can be counted, summed or compared, it is `font-mono`.
4. **One material.** Every card is a `.pane`. Glow marks state, never cursor position.
5. **Motion explains, then gets out of the way.** Entrances grow rather than slide, nothing outlasts the reveal step, and every animation can be switched off (§8).
6. **Accessible by construction.** Focus rings, the on-primary pair and three in-app accessibility modes ship as part of the token set (§9).

## 2. Colour Tokens

Declared in `apps/web/src/index.css` and mirrored in `apps/mobile/src/theme.ts`. Light is the default; `data-theme="dark"` on `<html>` flips the whole palette. `apps/web/index.html` applies the stored or system theme before first paint, so a dark-mode reload never flashes white.

**Cascade order is load-bearing:** `:root` and `[data-theme='dark']` have the same specificity, so the dark block must come after the light one. The token test fails if they are swapped.

**Module inks.** Primary (emerald) is plant care and the brand, secondary (sky) is fitness, tertiary (gold/bronze) is nutrition, accent (coral) is alarm.

### Light theme (`:root`, `[data-theme='light']`)

| Token | Tailwind | Value | Role |
| --- | --- | --- | --- |
| `--color-background` | `bg-background` | `#f6f4ee` | Ivory ground. |
| `--color-background-alt` | `bg-background-alt` | `#eeebe2` | Second ground for banded sections. |
| `--color-surface` | `bg-surface` | `#fffdf8` | Warm paper; opaque fallback for glass. |
| `--color-surface-raised` | `bg-surface-raised` | `#ffffff` | Active rows, hovered secondary buttons, focused fields. |
| `--color-primary` | `*-primary` | `#0d5c3c` | Deep emerald. 6.7:1 on every light ground; carries white text at 8:1. |
| `--color-primary-hover` | `*-primary-hover` | `#094a30` | Hover, and the readable tone for success copy. |
| `--color-primary-glow` | `*-primary-glow` | `#2fbf7f` | **Glow and highlight only** — never text or icons. |
| `--color-on-primary` | `text-on-primary` | `#ffffff` | Text on a solid primary fill. Inverts in dark mode. |
| `--color-secondary` | `*-secondary` | `#1d5b82` | Fitness ink. |
| `--color-tertiary` | `*-tertiary` | `#7f5410` | Nutrition ink. |
| `--color-accent` | `*-accent` | `#b8380f` | Burnt coral: errors, destructive actions. ≥ 4.5:1 on every light ground. |
| `--color-text-main` | `text-text-main` | `#0e1813` | Body and heading ink. |
| `--color-text-muted` | `text-text-muted` | `#536159` | Eyebrows, hints, secondary lines. |
| `--color-border` | `border-border` | `#e3dfd3` | **Decorative hairlines only** (~1.3:1). |
| `--color-border-control` | `border-border-control` | `#7d8279` | Every interactive boundary. Clears WCAG 1.4.11's 3:1. |

### Dark theme (`[data-theme='dark']`)

| Token | Value | Note |
| --- | --- | --- |
| `--color-background` | `#060a08` | Near-black with a green undertone. |
| `--color-background-alt` | `#0a100d` | |
| `--color-surface` | `#0d1411` | |
| `--color-surface-raised` | `#131c18` | |
| `--color-primary` | `#4fd59a` | Luminous emerald. |
| `--color-primary-hover` | `#7be3b4` | Hover moves *lighter* in dark mode. |
| `--color-primary-glow` | `#34e0a1` | Glow only. |
| `--color-on-primary` | `#060a08` | **Inverts.** White on this emerald is 1.9:1 and fails AA; the ground is 10.7:1. |
| `--color-secondary` | `#7cc4ea` | Moonlit sky. |
| `--color-tertiary` | `#e6bd6a` | Champagne gold. |
| `--color-accent` | `#ff7b5c` | |
| `--color-text-main` | `#edf4ef` | |
| `--color-text-muted` | `#8fa096` | |
| `--color-border` | `#1c2621` | Decorative only (~1.2:1). |
| `--color-border-control` | `#66746d` | |

### Glass, glow and atmosphere

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--glass-bg` | `rgba(255,253,248,.66)` | `rgba(17,26,22,.58)` | Resting pane fill (`bg-glass`). |
| `--glass-bg-strong` | `rgba(255,253,248,.90)` | `rgba(17,26,22,.84)` | Content above content: modals, top bar, dock (`bg-glass-strong`). |
| `--glass-border` | `rgba(14,24,19,.08)` | `rgba(255,255,255,.07)` | Pane edge. |
| `--glass-highlight` | `rgba(255,255,255,.95)` | `rgba(255,255,255,.10)` | The 1px lit top edge. |
| `--glass-blur` | `16px` | `18px` | `backdrop-blur-glass`. |
| `--glow-primary` / `--glow-accent` / `--glow-soft` | | | Box-shadow glows. Consumed as shadows, never as colours. |
| `--aurora-1…3` | | | The module inks as light, for the ambient wash. |
| `--grain-opacity` | `0.035` | `0.05` | Film-grain strength. |

Tailwind wraps every token in `color-mix(in srgb, var(--x) calc(<alpha-value> * 100%), transparent)`, so opacity modifiers such as `bg-accent/10` work on custom properties while the tokens stay readable hex.

### Mobile mirror

`apps/mobile/src/theme.ts` exports the same palette as `light` and `dark` `Palette` objects (camelCase keys — `backgroundAlt`, `primaryGlow`, `borderControl`, `glassBgStrong` …) plus three aliases kept for existing screens: `danger` → accent, `warning` → tertiary, `success` → primary. `usePalette()` picks one from `useColorScheme()`. The token test fails if any shared value drifts between the two files.

## 3. Typography

Three families, three jobs. Loaded from Google Fonts in `apps/web/index.html` (variable axes, `display=swap`) and declared under `theme.extend.fontFamily`.

| Family | Tailwind | Role |
| --- | --- | --- |
| **Geist** | `font-sans` (body default), `font-heading` | All body copy, labels, buttons, fields, and working headings (section, card and dialog headings). |
| **Fraunces** | `font-display` | Page titles, dialog titles, the landing and auth headlines, the wordmark. The one voice allowed to be expressive. |
| **Geist Mono** | `font-mono` | Every metric, unit, ratio and read-out. `font-variant-numeric: tabular-nums` is applied globally to `.font-mono`. |

The body sets `font-size-adjust: from-font`, so the fallback face keeps the web font's x-height while it loads and the swap does not reflow the page. React Native bundles no font packages by design: `theme.ts` exports `monoFont` (Menlo on iOS, `monospace` elsewhere) and native headings use the system sans.

### Scale as built

| Role | Spec | Where |
| --- | --- | --- |
| Display | `text-display` — `clamp(2.75rem, 1.4rem + 5.4vw, 5.25rem)`, line-height 1.02, tracking −0.035em, Fraunces | Landing hero |
| Display small | `text-display-sm` — `clamp(2rem, 1.3rem + 2.6vw, 3rem)` | Landing section titles, auth headline |
| Page title | Fraunces 34px → 40px (`sm+`), medium, tracking −0.025em | `PageHeader` |
| Dialog title | Fraunces 26px medium | `Modal` |
| Ledger metric | Geist Mono 34px medium, tracking −0.03em | `StatCard` value |
| Section heading | Geist 20px semibold | "Workout log", "Meals", "Care history" |
| Body | Geist 15px (fields) / 14px (copy) | Inputs, rows, hints |
| Field label | Geist 13px medium, `text-main`, sentence case | `Input`, `Select`, `Combobox` |
| Eyebrow | 11px semibold, uppercase, tracking 0.12em, muted (`.eyebrow`) | Section labels, stat labels, page eyebrows |
| Badge | 11px semibold, uppercase, tracking 0.06em | `Badge` |
| Mono detail | Geist Mono 12px | `Progress` read-out, `StatCard` sub-line, inline units |
| Dock label | 10px medium | Mobile-web tab dock |

**Eyebrow rule.** Eyebrows name sections and metrics — "TODAY'S RINGS", "HYDRATION", "YOUR GARDEN". Field labels are sentence case in v4.0 (v2.0 set them as eyebrows; see §11).

**Mono rule.** If a number can be counted, summed or compared it is `font-mono`, including inside prose (`New goal <span class="font-mono">2500 ml</span> is recorded with…`). Dates written as words are not metrics and stay in Geist.

## 4. Spacing

An 8pt grid, exposed as named aliases so `p-md`, `gap-sm` and `py-xl` read as intent rather than arithmetic.

| Alias | Value | Typical use |
| --- | --- | --- |
| `xs` | 4px | Label→field gap, icon→text gap |
| `sm` | 8px | Sibling gap, toast stack gap |
| `md` | 16px | Grid gutters, field padding, phone page padding |
| `lg` | 24px | Card padding, section spacing |
| `xl` | 32px | Major section separation, desktop page padding |
| `2xl` | 48px | Generous vertical padding on centred and full-page layouts (web only) |

`theme.ts` exports the same scale as numbers (`space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }`); there is no `2xl` on native — safe-area insets cover that case.

## 5. Shape and Elevation

### Radii

v2.0's sharp-corner rule is repealed — glass needs curvature to read as a pane — but not abolished: small cells that hold a metric stay tight.

| Alias | Value | Used for |
| --- | --- | --- |
| `rounded-sm` | 8px | Small cells holding a metric. |
| `rounded-md` | 12px | Buttons, fields, list rows, nav items. (`Button size="lg"` uses 14px.) |
| `rounded-lg` | 18px | Cards, tiles and toasts — every `Card`. |
| `rounded-xl` | 24px | Modals, hero panels, the mobile-web dock. |
| `rounded-2xl` | 28px | Icon wells in empty and error states. |
| `rounded-full` | 9999px | Badges, avatars, rings, toggles, dots. |

Native mirrors the scale a step smaller (`radius = { sm: 6, md: 10, lg: 16, xl: 22 }`).

### Elevation

Four steps, each a soft contact shadow under a long ambient one — the layering is what reads as depth rather than "drop shadow".

| Step | Tailwind | Used for |
| --- | --- | --- |
| `--shadow-1` | `shadow-1` | Secondary buttons, toggles at rest |
| `--shadow-2` | `shadow-2`, inside `shadow-glass` | Panes at rest |
| `--shadow-3` | `shadow-3`, inside `shadow-glass-raised` | Hovered tiles, raised cards |
| `--shadow-4` | `shadow-4` | Modals, the dock, toasts |

`theme.ts` exports the same four steps as `lightElevation` / `darkElevation` (iOS shadow fields plus Android `elevation`).

### Signature surfaces (`@layer components` in `index.css`)

| Class | What it is |
| --- | --- |
| `.pane` | The one card material: glass fill, 1px glass border, lit top edge, faint vertical sheen, `--shadow-2`, `backdrop-filter: blur() saturate(140%)`. `Card` is `pane rounded-lg p-lg`. |
| `.edge-gradient` | A 1px emerald → sky → gold gradient border, drawn with a masked pseudo-element, for the one or two surfaces per page that are the point of the page. |
| `.btn-primary` | The primary action: a lit emerald gradient with an inner highlight and `--glow-primary`. The only thing in the app that glows at rest. |
| `.text-brand` | Emerald → gold gradient type for a single emphasised word in a display line. Both stops clear 4.5:1 on every ground. |
| `.eyebrow` | The eyebrow label (§3). |
| `.rule-fade` | A hairline that fades out at both ends, for dividing bands without a hard rule. |
| `progress.ring` | A native `<progress>` drawn as a ring with a conic gradient and a radial mask — real progressbar semantics, no SVG path maths. `--value` is an `@property` so the ring sweeps in. |
| `.app-aurora`, `.app-grain` | The ambient atmosphere behind the shell: three radial washes of the module inks drifting over 48s, and an SVG-turbulence grain tile. |
| `.reveal` | Scroll reveal for landing sections, as CSS scroll-driven animation behind `@supports` — where it is unsupported, the content is simply there. |

## 6. Icons

**No icon library.** Icons are inline SVG written next to the screens that use them.

```tsx
<svg
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth={1.6}
  strokeLinecap="round"
  strokeLinejoin="round"
  className="h-5 w-5 shrink-0"
  aria-hidden
>
  <path d="…" />
</svg>
```

- **24×24 viewBox, `fill="none"`, `stroke="currentColor"`** — the icon inherits its context's ink, so it themes for free.
- **Stroke 1.5–1.6 with round caps and joins** in v4.0 glyphs (navigation, dashboard, brand).
- **`aria-hidden`** always; the adjacent text or an `aria-label` on the control carries the meaning.
- The brand mark (`BrandMark` in `apps/web/src/components/Brand.tsx`) is the one filled glyph: a sprout on an emerald tile.

> **Known drift:** some page-level glyphs written for v2.0 (care actions, the fitness and nutrition empty states) still use `strokeWidth={1.5}` with **square** caps. They are legible and on-token; bring them to round caps when those files are next touched.

## 7. Charts and Data Display

No chart library. Every visualisation is hand-drawn against the tokens:

- **Rings** — `Ring` (`progress.ring`): the dashboard's concentric Move/Nourish rings, the nutrition calorie ring and the plant-detail watering ring.
- **Weekly steps** — `FitnessPage`: seven bars for the whole week, zero days included, today highlighted.
- **Hydration glass** — `NutritionPage`: a glass that fills towards the day's goal, with a figure and a `Progress` bar carrying the accessible value.
- **Bars** — the shared `Progress` component, one tone per category, never per severity.

Every chart renders in both themes and under `[data-high-contrast]`, and every decorative visual has a text or `<progress>` equivalent for assistive technology.

## 8. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--motion-micro` | 120ms | Small state changes |
| `--motion-standard` | 220ms | Hover, focus, colour and border transitions; toast entrance |
| `--motion-entrance` | 420ms | `animate-grow-in` (6px rise + 0.985 scale) for panels and modals |
| `--motion-reveal` | 700ms | Progress fills and the slowest reveals |
| `--ease-entrance` | `cubic-bezier(0.22, 1, 0.36, 1)` | Entrances |
| `--ease-state` | `cubic-bezier(0.4, 0, 0.2, 1)` | State changes |

The rules: entrances **grow**, they never slide sideways; nothing animates longer than the reveal step; motion is never load-bearing for comprehension. The web app uses the `motion` library for the lit pill that glides between navigation items (`layoutId`), route entrances (opacity plus a few pixels of rise) and the staged entrances on the landing and auth pages; CSS handles everything else. Stat values count up on arrival (`useCountUp`), and rings sweep in through the `--value` transition.

### Three reduced-motion mechanisms

1. **OS preference:** `@media (prefers-reduced-motion: reduce)` clamps animation and transition durations **and delays** on every element — clearing the delay is what stops a staggered list arriving as a sequence of jump-cuts.
2. **In-app preference:** `[data-reduce-motion]` applies the identical clamp and switches off the scroll-driven `.reveal`. `SettingsContext` stamps the attribute from Settings → Accessibility.
3. **JavaScript motion:** `MotionConfig reducedMotion="always"` wraps the app whenever either preference is on, and `useCountUp` jumps straight to the answer.

## 9. Accessibility Contract

These are commitments of the design system, not per-screen decisions.

**Focus.** Every interactive element shows `focus-visible:ring-2` in `primary` (destructive controls ring in `accent`), with `ring-offset-2 ring-offset-background`. Fields add a glow **on top of** the ring, never instead of it — the glow disappears in high-contrast mode and the ring must survive.

**Boundaries.** Anything a user operates draws its edge with `border-control`, which clears 3:1. `border` is a decorative hairline at ~1.3:1 and never outlines a control.

**On-primary.** Never place raw white on `--color-primary`. Use `text-on-primary`, which inverts to near-black in dark mode. `::selection` uses the same pair.

**Larger text.** `[data-larger-text]` sets the root `font-size` to 112.5%. Every Tailwind size is rem-based, so the whole interface scales.

**High contrast.** `[data-high-contrast]` turns glass **opaque** rather than tinting it — translucency is what costs contrast — removes every glow (as `0 0 #0000`, never `none`, which would invalidate a composed shadow list and take the focus ring with it), removes the aurora, grain, gradient borders and gradient type, and strengthens `border`, `border-control` and `text-muted` in both themes.

**Structure.** "Skip to content" is the first focusable element in the shell. Route changes move focus to `<main tabIndex={-1}>` without scrolling and reset the scroll position. Form controls are native elements with real `<label htmlFor>`, `aria-invalid` and `aria-describedby`.

**Semantics.** Errors announce (`role="alert"`); successes and info do not steal focus (`role="status"`). Loading buttons carry `aria-busy`. Bars and rings are real progressbars with an accessible name.

## 10. Token Configuration

`apps/web/tailwind.config.js` maps every custom property onto a utility and adds the radii, elevation, blur, font families, display sizes, motion durations and easings, and the `grow-in` / `fade-in` keyframes described above. `darkMode: ['class', '[data-theme="dark"]']` keys the `dark:` variant off the same attribute the tokens use, so the two can never disagree. Test files are excluded from Tailwind's `content` globs so a class name quoted in an assertion is never compiled into the shipped stylesheet.

## 11. History

| Version | Date | Direction | What changed, and why |
| --- | --- | --- | --- |
| 1.0 | 2026-07 | Emerald SaaS (planned) | Emerald `#10B981`, shadcn/ui, Framer Motion, Lottie. Never shipped. |
| 2.0 | 2026-07-31 | "Field notebook" | Paper ground, one deep leaf ink, hairlines instead of shadows, 2–4px corners, IBM Plex Mono for every metric, six functional transitions. Introduced `--color-on-primary` and the three in-app accessibility modes. |
| 3.0 | 2026-08 | "Glasshouse" | Owner-approved reversal of v2.0's restraint: glass panes, layered elevation, glow, the `motion` library for layout animation, and `--color-border-control` so interactive edges clear 3:1. |
| **4.0** | **2026-10** | **"Conservatory"** | The current language. A new contrast-measured palette (ivory and emerald by day, botanical noir by night, sky and gold as module inks); Fraunces display serif with Geist and Geist Mono; one `.pane` material; signature surfaces (edge gradient, lit primary button, gradient type, `<progress>` rings); aurora and grain; sentence-case field labels; a richer motion scale with a third reduced-motion mechanism for JavaScript animation. |

**What carried through every version:** token indirection, the mono-numeral rule, the on-primary inversion, the separation of load-failure and empty states, and the full accessibility contract.
