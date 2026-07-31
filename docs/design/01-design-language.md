# PlantPal+ Design Language

| Field | Value |
| --- | --- |
| Document | `01-design-language.md` — Visual direction and core UI theme tokens |
| Version | 2.0 |
| Updated | 2026-07-31 |
| Owner | Rakshit |

> **v2.0 supersedes v1.0.** v1.0 described an emerald/shadcn/Framer-Motion app that was never shipped. This document describes what is actually in the repository after the 2026-07 "field notebook" redesign. See §10 for what changed and why.

## 1. Visual Direction

PlantPal+ is a **gardener's field notebook** — a daily care ledger, not a wellness dashboard. The ground is paper-tinted rather than pure white (`#f6f7f4`), the ink is a single deep leaf green (`#226d3c`) used sparingly for the things you can act on, and structure comes from **hairline rules, never shadows**: every card, tab bar, sidebar and toast is separated by a 1px border in `--color-border` and nothing floats. Corners are **sharp** — the largest radius in regular use is 4px, most surfaces are 2px — because a ruled page has square cells. Labels are set as small uppercase letterspaced **eyebrows**, the way a column heading is written in a ledger. And **every metric is set in mono** (`IBM Plex Mono` on web, the system monospace on native) so that grams, millilitres, streak counts and kcal totals align down the page like entries in a book. Colour is deliberately scarce: one leaf green carries all affirmative meaning, and the secondary/tertiary/accent inks appear only where a category genuinely needs to be distinguished. The result reads as calm, dense, and legible at a glance — a page you write on, not a product that celebrates at you.

Design tenets, in priority order:

1. **Tokens are the only styling truth.** Every colour in the app resolves through a CSS custom property; there is no hard-coded hex in any component.
2. **Hairlines over shadows.** No `box-shadow` anywhere. Separation is a border or nothing.
3. **Sharp corners.** 2px on controls, 4px on containers. 8px exists in the config but is unused.
4. **Numbers are mono.** If a value is countable or comparable, it is `font-mono`.
5. **Near-zero motion.** Motion is functional feedback only (see §7).
6. **Accessible by construction, not by audit.** Focus rings, on-primary contrast pairs, and three in-app accessibility modes ship as part of the token set (see §8).

## 2. Colour Tokens

Declared in `apps/web/src/index.css` and mirrored exactly in `apps/mobile/src/theme.ts`. Light is the default; `data-theme="dark"` on `<html>` flips the entire palette. `apps/web/index.html` applies the stored/system theme before first paint so a dark-mode reload never flashes white.

### Light theme (`:root`, `[data-theme='light']`)

| Token | Tailwind class | Value | Role |
| --- | --- | --- | --- |
| `--color-background` | `bg-background` | `#f6f7f4` | Paper. The page ground, and the hover fill for ghost rows. |
| `--color-surface` | `bg-surface` | `#ffffff` | Card, sidebar, tab bar, modal panel, input field. |
| `--color-primary` | `*-primary` | `#226d3c` | Leaf ink. Primary buttons, active states, progress fill, success. |
| `--color-primary-hover` | `*-primary-hover` | `#1a5530` | Primary button hover; also the readable text tone for success copy. |
| `--color-secondary` | `*-secondary` | `#38708f` | Fitness / info category ink. |
| `--color-tertiary` | `*-tertiary` | `#9a6b0f` | Nutrition / warning category ink. |
| `--color-accent` | `*-accent` | `#b3402e` | Errors, destructive actions, validation. |
| `--color-text-main` | `text-text-main` | `#1b241e` | Body and heading ink. Also the active-nav fill on desktop. |
| `--color-text-muted` | `text-text-muted` | `#5d6a61` | Eyebrows, hints, secondary lines, inactive nav. |
| `--color-border` | `border-border` | `#dce1da` | Every hairline rule in the app. |
| `--color-on-primary` | `text-on-primary` | `#ffffff` | Text/icons placed on a solid `primary` fill. |

### Dark theme (`[data-theme='dark']`)

| Token | Value | Note |
| --- | --- | --- |
| `--color-background` | `#0b0e0c` | Near-black, tinted the same green — not a blue-slate. |
| `--color-surface` | `#141815` | One step up from ground; the border still does the separating. |
| `--color-primary` | `#46a96c` | Lifted leaf green so it clears the dark ground. |
| `--color-primary-hover` | `#5fbf80` | Hover moves *lighter* in dark mode, unlike light mode. |
| `--color-secondary` | `#6fa7c7` | |
| `--color-tertiary` | `#c99a3c` | |
| `--color-accent` | `#d96c57` | |
| `--color-text-main` | `#ecf0ec` | |
| `--color-text-muted` | `#8b968d` | |
| `--color-border` | `#242a25` | |
| `--color-on-primary` | `#0b0e0c` | **Inverts.** See §8 — white on `#46a96c` fails AA, dark ink passes. |

### Mobile semantic aliases

`apps/mobile/src/theme.ts` exports the same eleven tokens as a `Palette` object (camelCase: `primaryHover`, `textMain`, `textMuted`, `onPrimary`) plus three aliases kept for existing screens — `danger` → accent, `warning` → tertiary, `success` → primary. There is no separate traffic-light palette; status is carried by the notebook's own inks. `usePalette()` selects light/dark from `useColorScheme()`.

## 3. Typography

Three families, three jobs. Loaded from Google Fonts in `apps/web/index.html`; declared under `theme.extend.fontFamily` in `apps/web/tailwind.config.js`.

| Family | Tailwind | Stack | Role |
| --- | --- | --- | --- |
| **Inter** | `font-sans` (default) | `Inter, system-ui, sans-serif` | All body copy, labels, buttons, form fields. The `<body>` default. |
| **Bricolage Grotesque** | `font-heading` | `"Bricolage Grotesque", Inter, system-ui, sans-serif` | Page titles, modal titles, empty/error-state titles, the wordmark. Weights 600/700/800 only. |
| **IBM Plex Mono** | `font-mono` | `"IBM Plex Mono", ui-monospace, monospace` | Every metric, unit, ratio, latin name and read-out. Weights 400/500/600. |

React Native has no bundled font packages by design: `apps/mobile/src/theme.ts` exports `monoFont` (`Menlo` on iOS, `monospace` elsewhere) and native headings use the system sans at the weights below. `apps/mobile/src/lib/fonts.ts` re-exports `monoFont` so the theme stays the single source.

### Scale as built

| Role | Size / weight | Where |
| --- | --- | --- |
| Page title | 26px `font-heading` bold, `tracking-tight` | `PageHeader` |
| Wordmark | 20px `font-heading` extrabold, `tracking-tight` | App shell sidebar |
| Modal title | 18px `font-heading` bold | `Modal` |
| State title | 16px `font-heading` semibold | `EmptyState`, `ErrorState` |
| Ledger metric | 30px `font-mono` semibold, `tracking-tight` | `StatCard` value (mobile: 24px) |
| Body | 16px Inter regular | Inputs, primary copy |
| Body small | 14px Inter regular | Hints, list rows, errors, button labels (semibold) |
| Mono detail | 12px `font-mono` | `Progress` read-out, `StatCard` sub, `Combobox` sub, inline units |
| Eyebrow | 11px medium, `uppercase`, `tracking-[0.08em]` | Section labels, `StatCard` label |
| Field-label eyebrow | 12px (`text-xs`) medium, `uppercase`, `tracking-[0.08em]` | `Input`, `Select` and `Combobox` labels |
| Badge eyebrow | 11px medium, `uppercase`, `tracking-[0.06em]` | `Badge` — tighter tracking than the rest, so a short status word stays compact inside its border |
| Wide eyebrow | 11px medium, `uppercase`, `tracking-[0.14em]` | Sidebar tagline ("Daily care ledger") |
| Toast eyebrow | 10px medium, `uppercase`, `tracking-[0.08em]` | `ToastProvider` |
| Tab label | 10px medium | Mobile bottom tab bar |

**Eyebrow rule:** any label that names a field, a column or a status is an eyebrow — uppercase, letterspaced, muted. Never sentence-case a form label.

**Mono rule:** if a number can be counted, summed or compared, it is `font-mono` — including inside prose (`New goal <span class="font-mono">2500 ml</span> is recorded with…`). Dates written as words are not metrics and stay in Inter.

## 4. Spacing

An 8pt grid, exposed as named `spacing` aliases in `apps/web/tailwind.config.js` so `p-md`, `gap-sm`, `py-xl` read as intent rather than arithmetic.

| Alias | Value | Typical use |
| --- | --- | --- |
| `xs` | 4px | Label→field gap, icon→text gap, badge padding |
| `sm` | 8px | Sibling gap, control vertical padding, toast stack gap |
| `md` | 16px | Control horizontal padding, grid gutters, shell padding (mobile viewport) |
| `lg` | 24px | Card padding, section spacing, desktop toast inset |
| `xl` | 32px | Major section separation, desktop shell padding |
| `2xl` | 48px | Generous vertical padding on centred/full-page layouts — auth screens, 404, empty detail panes (web only) |

`apps/mobile/src/theme.ts` exports the same scale as numbers: `space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }`. There is no `2xl` on native — the safe-area inset covers that case.

## 5. Radii

| Alias | Value | Used for |
| --- | --- | --- |
| `rounded-lg` | 8px | **Reserved — currently unused.** Do not reach for it without a reason. |
| `rounded-md` | 4px | Containers: `Card`, `Modal` panel, `ErrorState`. Mobile: `borderRadius: 4`. |
| `rounded-sm` | 2px | Controls: `Button`, `Input`, `Select`, `Combobox`, `Alert`, `Badge`, `Toast`, nav links, skip link. Mobile: 2–3. |
| `rounded-full` | 9999px | **Two exceptions only** — the `Spinner` ring and the in-button loading dot. |

Sharp corners are the signature. A new component that wants a soft edge is almost certainly wrong.

## 6. Icons

**No icon library.** Icons are inline SVG paths written next to the screens that use them.

The convention:

```tsx
<svg
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth={1.5}
  strokeLinecap="square"
  className="h-5 w-5 shrink-0"
  aria-hidden
>
  <path d="…" />
</svg>
```

- **24×24 viewBox, `fill="none"`, `stroke="currentColor"`** — the icon inherits whatever text colour its context sets, so it themes for free.
- **`strokeWidth` 1.5 and `strokeLinecap="square"`** — the square cap is what makes the set read as pen-on-paper rather than a rounded UI kit.
- **`h-5 w-5`** at nav/row scale, `h-4 w-4` inline with small text, `h-6 w-6` for the wordmark sprout.
- **`aria-hidden`** always. Icons are decoration; the adjacent text or an `aria-label` on the control carries the meaning.

This convention replaced emoji throughout the web app (`/** Inline stroke icons, matching the nav-item style (no emoji). */`), and the mobile tab bar likewise uses short uppercase eyebrow labels instead of emoji glyphs. The reference implementations are `SproutMark` in `apps/web/src/layouts/AppShell.tsx` and `rowIcon` in `apps/web/src/pages/DashboardPage.tsx`.

> **Known drift:** `apps/web/src/navigation/navItems.tsx` still draws its six nav icons at `strokeWidth={2}` with round caps, and carries a stale "swap for lucide-react later" comment. Everything else in the app is 1.5/square. Bring `navItems.tsx` in line the next time it is touched; do not copy it as a model.

## 7. Motion

**Near-none by design.** A ledger does not animate. The complete inventory of motion in the app:

| Motion | Spec | Where |
| --- | --- | --- |
| Colour transitions | `transition-colors` (Tailwind default 150ms) | Buttons, nav links |
| Spinner rotation | `animate-spin` | `Spinner`, in-button loading dot |
| Toast entrance | `toast-in` keyframe — 6px rise + fade, 160ms ease-out | `.toast-enter` in `index.css` |
| Progress fill | `transition-all` | `Progress` bar width |
| Calorie ring | `stroke-dashoffset` 700ms ease-out | Nutrition donut (hand-rolled SVG) |
| Press feedback | `opacity` 0.85 while pressed | Mobile `Button` |

No spring physics, no layout animation, no Lottie, no confetti, no staggered list entrances.

### Two reduced-motion mechanisms

Both live in `apps/web/src/index.css` and must be kept in sync — the second exists because a user can want calm motion in this app without changing their OS.

1. **OS preference:** `@media (prefers-reduced-motion: reduce)` clamps `animation-duration`, `animation-iteration-count` and `transition-duration` on `*`, `*::before`, `*::after`.
2. **In-app preference:** `[data-reduce-motion] *` applies the identical clamp. `SettingsContext` stamps the attribute on `<html>` from the user's `reduce_motion` setting (Settings → Accessibility) via `root.toggleAttribute`.

Any new animation must survive both being on — i.e. it may not be load-bearing for comprehension.

## 8. Accessibility Contract

These are commitments of the design system, not per-screen decisions.

**Focus.** Every interactive element shows `focus-visible:ring-2 focus-visible:ring-primary` (destructive controls ring in `accent`). Buttons add `ring-offset-2 ring-offset-background` so the ring reads against a card. Default outlines are suppressed only where a visible ring replaces them. The mobile bottom tab bar uses `focus-visible:ring-inset` so the ring is not clipped by the viewport edge.

**On-primary.** Never place raw white on `--color-primary`. Use `text-on-primary`, which resolves to `#ffffff` in light mode and `#0b0e0c` in dark — white on the lifted dark-mode green (`#46a96c`) fails WCAG AA, dark ink passes. `::selection` uses the same pair.

**Contrast pairs.** The sanctioned combinations are: `text-main`/`text-muted` on `background` or `surface`; `on-primary` on `primary`; `primary-hover` for success *text* (the raw `primary` is reserved for fills and is intentionally darker/lighter than the readable text tone); `accent`, `secondary` and `tertiary` as text only on their own 10% tints.

**Larger text.** `[data-larger-text]` sets the root `font-size` to `112.5%`. Every Tailwind size in the app is rem-based, so the whole interface scales — no per-component overrides exist or are needed.

**High contrast.** `[data-high-contrast]` darkens the two lowest-contrast tokens rather than repainting the palette: `--color-border` → `#9aa39b` and `--color-text-muted` → `#3f4a42` in light; `#4a544c` / `#b6c0b8` in dark. Because the hairline rules carry all structure, strengthening the border is the single highest-leverage contrast fix.

**Structure.** A "Skip to content" link is the first focusable element in the shell. Route changes move focus to `<main tabIndex={-1}>` and reset scroll, so keyboard and screen-reader users land on the new page. Form controls are native elements with real `<label htmlFor>`, `aria-invalid` and `aria-describedby` wiring (see `02-component-inventory.md`).

**Semantics.** Errors announce (`role="alert"`), successes and info do not steal focus (`role="status"`, `aria-live="polite"`). Loading buttons carry `aria-busy`. Progress bars carry `aria-valuenow/min/max` and an accessible name, via `label` or `srLabel`.

## 9. Token Configuration (as shipped)

`apps/web/tailwind.config.js`:

```javascript
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        secondary: 'var(--color-secondary)',
        tertiary: 'var(--color-tertiary)',
        accent: 'var(--color-accent)',
        'on-primary': 'var(--color-on-primary)',
        'text-main': 'var(--color-text-main)',
        'text-muted': 'var(--color-text-muted)',
        border: 'var(--color-border)',
      },
      borderRadius: { lg: '8px', md: '4px', sm: '2px', full: '9999px' },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['"Bricolage Grotesque"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px' },
    },
  },
  plugins: [],
}
```

Note `darkMode: ['class', '[data-theme="dark"]']` — the `dark:` variant keys off the same attribute the tokens do, so the two can never disagree.

## 10. What Changed From v1.0

v1.0 specified a design that was replaced wholesale by the 2026-07 redesign. Recorded here so a reader of the old document understands this is a deliberate change, not documentation rot.

| v1.0 said | v2.0 ships | Why |
| --- | --- | --- |
| Emerald `#10B981` primary, blue/amber/coral supporting set, `#F9FAFB` ground, `#111827` midnight dark | Deep leaf `#226d3c` (light) / `#46a96c` (dark), paper `#f6f7f4` ground, green-tinted near-black `#0b0e0c` dark | Emerald reads as generic SaaS; a single deep leaf ink on paper reads as a garden ledger and keeps colour scarce enough that a green button always means "act". |
| Radii 16 / 12 / 8px, "friendly geometry", soft shadows on cards | Radii 8 (unused) / 4 / 2px, hairline borders, **no shadows at all** | Sharp corners and rules are the notebook signature; shadows imply floating chrome, which fights the page metaphor. |
| Inter with Outfit as a "charming alternative" | Inter (body) + Bricolage Grotesque (headings) + IBM Plex Mono (**all metrics**) | The mono family is the substantive addition: it is what makes columns of numbers align and read as ledger entries. |
| "Micro-interactions", spring physics, Lottie growth animations, confetti | Six functional transitions, total (§7) | Motion was decoration competing with data density, and it made the reduced-motion contract hard to honour. |
| `--color-on-primary` did not exist | First-class token that **inverts** between themes | Without it, dark mode shipped white-on-green text that failed WCAG AA. |
| No in-app accessibility modes | `[data-reduce-motion]`, `[data-larger-text]`, `[data-high-contrast]` attribute selectors driven by user settings | OS-level preferences are not always the user's preference *for this app*. |

Dependency changes (shadcn/ui, Lucide, Framer Motion, Recharts, RN Paper, NativeWind — all dropped) are recorded in `02-component-inventory.md` §7, since they are component-inventory decisions rather than token decisions.
