# PlantPal+ Component Inventory

| Field | Value |
| --- | --- |
| Document | `02-component-inventory.md` — Component mapping and interaction contracts |
| Version | 3.0 |
| Updated | 2026-10-02 |
| Owner | Rakshit |

> **v3.0 tracks design language v4.0 "Conservatory".** The primitive set is still hand-rolled against the design tokens; what changed is the material (glass panes instead of hairline cards), the shapes, and a handful of new primitives — `Ring`, `Skeleton`, `useCountUp` and the brand components. §7 records every dependency decision, including the ones v3.0 reversed.

## 1. Overview

The web UI is built from `03_implementation/web/src/components/ui.tsx` plus four small companions — `Brand.tsx`, `ThemeToggle.tsx`, `PlantAvatar.tsx` and the shell in `layouts/AppShell.tsx`. The native UI is built from `03_implementation/mobile/src/components/ui.tsx`.

The web app's runtime dependencies are `react`, `react-dom`, `react-router-dom`, `motion` (layout and entrance animation), `clsx` + `tailwind-merge` (the `cn` class merger in `lib/utils.ts`) and `@plantpal/shared`. There is no component library.

Three rules govern every component:

- **Tokens only.** No hard-coded colour. Every value resolves through a Tailwind class backed by a CSS custom property (web) or a `usePalette()` field (native).
- **Native elements first.** `<button>`, `<input>`, `<select>`, `<label htmlFor>`, `<progress>`. Keyboard and screen-reader behaviour come free; ARIA is hand-rolled only where no native element exists (`Combobox`, `Modal`).
- **One material.** Every card is a `.pane` (`01-design-language.md` §5); every metric is `font-mono`; every interactive edge uses `border-control`.

## 2. Web Component Inventory

Exported from `03_implementation/web/src/components/ui.tsx` unless stated otherwise. Covered by `ui.test.tsx` and the page tests.

### Button

| | |
| --- | --- |
| **Purpose** | Every clickable action. There is no separate IconButton, FAB or link-button component. |
| **Props** | `variant?: 'primary' \| 'secondary' \| 'ghost' \| 'danger'` (default `primary`), `size?: 'sm' \| 'md' \| 'lg'` (32 / 40 / 48px tall, default `md`), `loading?: boolean`, plus all native `ButtonHTMLAttributes`. |
| **States** | Idle · hover · active (`scale-[0.985]`) · focus-visible (`ring-2` + `ring-offset-2`) · disabled (`opacity-55`) · loading. |

Variants: **primary** is `.btn-primary` — a lit emerald gradient with an inner highlight and the primary glow, the only element that glows at rest. **secondary** is a glass button with a `border-control` edge that lifts 1px and turns opaque on hover. **ghost** is muted text that gains a faint wash on hover. **danger** is a full-strength `accent` outline (a control boundary, so it must clear 3:1) with an accent glow on hover, and it rings in `accent`.

**Usage rules**
- `loading` implies disabled and sets `aria-busy`. **The label stays mounted** — a spinner is prepended, never substituted, so the button never changes width mid-request.
- **Never a solid red button.** Destructive intent is `variant="danger"`; confirmation for a genuinely destructive action belongs in a `Modal`.
- **Every independently triggerable action owns its busy flag.** Ten "Water" buttons need ten flags — the shipped pattern is a `Set<string>` keyed by row id (`PlantsPage`, `DashboardPage`), and the hydration `+250` / `+500` pair has one flag each.

### Input

| | |
| --- | --- |
| **Purpose** | A labelled text field: label, field and message in one column. |
| **Props** | `label: string` (**required**), `error?`, `hint?`, plus all native `InputHTMLAttributes`; `forwardRef` to the `<input>`. |
| **Styling** | 44px glass well, `rounded-md`, `border-control` edge (`accent` on error); on focus the ring **and** the primary glow. |

**Usage rules**
- The label is 13px medium sentence case and is required — there are no unlabelled fields.
- The id resolves `id ?? name ?? slugified label`, so `htmlFor` always binds.
- `aria-describedby` points at the error when present, otherwise the hint; errors render with a leading glyph.
- Field problems go in `error`; form-level problems go in an `Alert`.

### Select

Same contract as `Input`, wrapping a **native `<select>`** (`appearance-none`, inline chevron). Use it for closed sets the user can enumerate — units, meal type, status. Reach for `Combobox` only when typing beats scrolling.

### Combobox

| | |
| --- | --- |
| **Purpose** | Accessible autocomplete for large or remote option sets — plant species, foods, exercises. |
| **Props** | `label`, `query`, `onQueryChange`, `options: ComboOption[]`, `onSelect(option \| null)`, `placeholder?`, `loading?`, `error?`, `hint?`, `emptyText?`. |
| **`ComboOption`** | `{ id: string; label: string; sub?: string }` — `sub` renders as a quiet mono second line (latin name, macros, MET value). |

**Ownership split.** The parent owns the query and the option list, so debounced fetching lives where the data lives. The component owns open state, keyboard navigation and ARIA (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`, `listbox`/`option`).

**Usage rules**
- **Selection contract:** `onSelect` fires with the picked option and the parent sets `query` to its label; typing afterwards fires `onSelect(null)`, so a stale id can never ride along under newer text.
- Nothing is highlighted until an arrow key asks for it, so Enter on typed text never picks a row the user did not aim at.
- Escape stops propagation while open, so closing the list does not also close an enclosing `Modal`; focus leaving the widget closes the list.

### Card

| | |
| --- | --- |
| **Purpose** | The container. Every panel in the app is a Card. |
| **Props** | `children`, `className?`, `style?` (an escape hatch for the per-row `animationDelay` of a staggered entrance). |
| **Styling** | `pane rounded-lg p-lg`. |

**Usage rules:** do not nest Cards — use a hairline divider inside one. `className` is for layout and for one of the sanctioned accents (`edge-gradient`, a hover lift); it never repaints the surface.

### Alert

| | |
| --- | --- |
| **Purpose** | A **form-level** inline notice: auth failures, registration results. |
| **Props** | `tone?: 'error' \| 'success' \| 'info'` (default `error`), `children`. |
| **Semantics** | `role="alert"`. Tinted glass with a leading glyph, so the tone is legible before the text is read. |

Transient confirmations are toasts, not Alerts; use an Alert only when the message must persist next to the form.

### Spinner

`size?: 'sm' | 'md' | 'lg'` (16 / 24 / 32px), `role="status"`, `aria-label="Loading"`. A CSS ring whose track uses `border-control` so the whole ring is visible, not just the moving head. A first load uses a centred `lg` Spinner or skeletons; a refresh keeps the existing data on screen.

### Skeleton

`className` sizes the block. `aria-hidden` placeholder shaped like the content it stands in for, so the layout does not shift when data arrives. Used for the dashboard tiles; the page keeps exactly one `role="status"` announcement while loading.

### Badge

| | |
| --- | --- |
| **Purpose** | A small status, tier or count stamp. |
| **Props** | `tone?: 'default' \| 'success' \| 'warning' \| 'danger' \| 'info'`, `children`. |
| **Styling** | A pill (`rounded-full`) led by a tone dot; 11px semibold uppercase; 30% border + 10% tint of the tone ink; `w-fit` and `whitespace-nowrap`, so it never stretches or wraps. |

A Badge is a label, never a control. Keep it to one or two words.

### Progress

| | |
| --- | --- |
| **Purpose** | Linear progress against a target — macros, hydration, steps. |
| **Props** | `value`, `max`, `label?`, `srLabel?`, `tone?: 'primary' \| 'secondary' \| 'tertiary'`. |
| **Semantics** | `role="progressbar"` with `aria-valuenow/min/max`, named by `label ?? srLabel`. |

An 8px gradient pill that grows into place on the entrance curve. The fill clamps to 0–100% and is 0 when `max <= 0`, so a missing target cannot produce a NaN width. **If you render the visible label yourself, pass `srLabel`** — otherwise the bar reaches screen readers unnamed. Tones map to categories, not severity.

### Ring

| | |
| --- | --- |
| **Purpose** | Circular progress — the dashboard rings, the calorie ring, the watering ring. |
| **Props** | `value`, `max?` (default 100), `label` (**required** accessible name), `size?` (px, default 160), `thickness?` (px, default 14), `tone?`, `className?`. |
| **Semantics** | A native `<progress class="ring">`, so it is a real progressbar. |

Rings stack concentrically by giving each a smaller `size`. The value sweeps in from zero after mount (immediately under reduced motion). A figure drawn in the ring's centre is `aria-hidden`; the `<progress>` carries the value.

### EmptyState

`icon?`, `title`, `body?`, `action?`. A list or screen that legitimately has no rows yet. The icon sits in a tinted well; the copy invites the next action and `action` carries the `Button` that performs it.

### ErrorState

| | |
| --- | --- |
| **Purpose** | A **load failure**. Deliberately distinct from `EmptyState`. |
| **Props** | `title?`, `body?` (default reassures that nothing was lost), `onRetry?`, `retryLabel?`. |
| **Semantics** | `role="alert"`; an accent-edged pane with a "Connection trouble" eyebrow and a **primary** retry button — retrying is the whole point of the panel. |

**The important rule:** *an empty garden invites planting; a failed request explains itself and offers a retry.* A load failure must render `ErrorState` with an `onRetry`, never `EmptyState`. Every page that fetches keeps a separate error flag beside its data so the two cases can never collapse into one.

### Modal

| | |
| --- | --- |
| **Purpose** | Focused create and confirm flows — Add plant, Log workout, Log meal, Remove plant. |
| **Props** | `open`, `onClose`, `title`, `children`, `busy?`. |
| **Semantics** | `role="dialog"`, `aria-modal`, `aria-labelledby` on the Fraunces title. |
| **Styling** | `glass-strong` panel, `rounded-xl`, `shadow-4`, over a blurred scrim. A bottom sheet on phones, centred from `sm` up; grows in. |

**Behaviour**
- **Focus trap** with recapture: if focus escapes to `<body>` (a button disabling itself), the next Tab returns to the first focusable element. The trap does not filter by `offsetParent`, which is null inside a fixed backdrop in some engines.
- Focus moves into the panel on open and is restored on close; body scroll locks while open.
- **`busy` guards dismissal** — Escape and backdrop clicks are ignored while a save is in flight.

### StatCard

| | |
| --- | --- |
| **Purpose** | A dashboard ledger tile: eyebrow label, large mono value, quiet mono context line. |
| **Props** | `label`, `value` (pre-formatted string), `sub`, `accent` (a token-backed text class, e.g. `'text-secondary'`), `subTone?`, `meter?` (0–100), `icon?`. |

The value counts up on arrival (`useCountUp`; reduced motion skips to the answer) while a visually hidden copy gives screen readers the final number. `meter` draws a hairline bar **only where a real denominator exists** — "1,180 of 2,000" is a fraction; a streak of 12 days is not, and inventing a target would make one of the bars a lie. `subTone` lets one tile raise an alarm (an overdue count) without a second component.

### PageHeader

| | |
| --- | --- |
| **Purpose** | The top of every page. |
| **Props** | `title`, `subtitle?`, `action?`, `eyebrow?`. |
| **Styling** | Optional eyebrow, then the Fraunces title (34px → 40px), a 15px muted subtitle, and `action` pinned right. |

Exactly one `PageHeader` per route, and it owns the only `<h1>` (the plant detail page builds its own hero with the same scale). The page's primary action goes in `action`; there is no FAB.

### ToastProvider / useToast

| | |
| --- | --- |
| **API** | `useToast()` → `{ success(message), error(message), info(message) }`. Outside a provider it returns a safe no-op, so components unit-test without wrapping. |
| **Viewport** | A fixed live region — bottom-centre above the mobile-web dock, bottom-right from `md` up. |

Each toast is a `glass-strong` card with a tone glyph and an eyebrow — `Logged` (success), `Not saved` (error), `Note` (info). Timers are 4000ms (6500ms for errors); hover or focus pauses them and leaving restarts a 2000ms grace period. At most four are on screen. Errors are `role="alert"`, the rest `role="status"`, and every toast has a "Dismiss notification" button. Success copy confirms the verb that caused it ("Watered Monstera"), not a generic "Saved".

### Companions

| Component | File | Notes |
| --- | --- | --- |
| `BrandMark`, `Wordmark` | `Brand.tsx` | The app-icon tile (a sprout on emerald glass, its leaves in two module inks) and the Fraunces wordmark. Decorative — the surrounding link carries the name. |
| `ThemeToggle` | `ThemeToggle.tsx` | One icon button. Its accessible name says what a press will do ("Switch to dark mode"), not the current state. |
| `PlantAvatar` | `PlantAvatar.tsx` | A plant's monogram on emerald glass with a leaf in the corner; `md` (44px) in lists, `lg` (64px) on the detail hero. Decorative. |
| `useCountUp` | `ui.tsx` | Animates a numeric string to its value; non-numeric strings pass through untouched. |
| `AppShell` | `layouts/AppShell.tsx` | Glass sidebar with grouped navigation (Today · Habits · You) and a gliding active pill from `md` up; a glass top bar and a floating tab dock below `md`. Both read the same `NAV_ITEMS`, so disabling a module hides it everywhere. |

## 3. Mobile Component Inventory

`03_implementation/mobile/src/components/ui.tsx`, styled from `03_implementation/mobile/src/theme.ts`. The native screens have not yet been restyled to v4.0 shapes: `theme.ts` already carries the v4.0 palette, radius scale, motion values and elevation steps, while the components below still draw the v2.0 hairline cards and 2–4px corners.

| Component | Props | Notes |
| --- | --- | --- |
| **`type`** (StyleSheet) | — | Shared text treatments: `type.eyebrow`, `type.metric` (mono, 24px), `type.mono` (mono, 12px). |
| **Eyebrow** | `text`, `color?`, `style?` | Uppercase letterspaced section label. |
| **MetricText** | `text`, `color?`, `style?` | A ledger value in mono. Pair with an `Eyebrow` to make a stat tile. |
| **Card** | `children`, `style?` | Hairline border, `borderRadius: 4`, `padding: space.md`. |
| **Button** | `title`, `onPress`, `variant?`, `loading?`, `disabled?` | Same variant semantics as the web; `danger` is an outline. `ActivityIndicator` while loading. |
| **Input** | `label?`, `value`, `onChangeText`, `placeholder?`, `secureTextEntry?`, `keyboardType?`, `autoCapitalize?` | Label renders through `Eyebrow`. |
| **Badge** | `text`, `color?` | 10% fill and 40% border of the same ink. |
| **Spinner** | — | Centred `ActivityIndicator` in `primary`. |
| **EmptyState** | `icon: string`, `title`, `body` | `icon` is a text glyph here. |
| **PageHeader** | `title`, `subtitle?` | No `action` slot. |
| **ErrorText** | `message` | Accent inline validation line. |
| **OfflineNotice** | `onRetry`, `retrying?` | `components/OfflineNotice.tsx` — the native counterpart to `ErrorState`. |

## 4. Web / Mobile Parity

| Concern | Web | Mobile | Parity |
| --- | --- | --- | --- |
| Colour tokens | `index.css` custom properties | `theme.ts` `Palette` | **Exact**, enforced by the token test. |
| Theme switch | `data-theme` on `<html>`, persisted | `useColorScheme()` (OS only) | Partial — no in-app override on native yet. |
| Spacing | `xs…2xl` | `space = { xs…xl }` | Near-exact; native has no `2xl`. |
| Radii | 8 / 12 / 18 / 24 / 28 | Scale `6 / 10 / 16 / 22` exported; components still use 2–4 | Tokens ready; components pending the native restyle. |
| Elevation and glass | Four shadow steps, `.pane` | `lightElevation` / `darkElevation`, `glassBlurIntensity` exported | Tokens ready; components pending. |
| Mono metrics | Geist Mono | `monoFont` (Menlo / `monospace`) | Equivalent. |
| Display type | Fraunces | System sans | Web-only display face. |
| Button | 4 variants, 3 sizes, `loading` | 4 variants, `loading` | Same semantics. |
| Load-failure state | `ErrorState` + `onRetry` | `OfflineNotice` + `onRetry` | Same contract. |
| Select / Combobox / Modal / Progress / Ring / StatCard / Toasts | ✓ | — | Web only. |

## 5. Icons and Illustrations

No icon library and no illustration set. Icons are inline stroke SVGs authored beside the screens that use them; the convention and the one known drift are in `01-design-language.md` §6. Empty states pair a glyph with honest copy. The brand mark is the only filled glyph.

## 6. Charts

No chart library — see `01-design-language.md` §7. In short: `Ring` for circular progress, `Progress` for bars, and two hand-drawn SVG/CSS pieces (the weekly steps chart and the hydration glass). If a new visualisation is needed, draw it against `var(--color-*)` with mono labels before proposing a dependency; it must render in both themes and under `[data-high-contrast]`.

## 7. Dependency Decisions

The standing reason for hand-rolling: **a dependency-free UI keeps the design tokens the single source of styling truth.** A component library ships its own colours, radii, motion curves and DOM, which then have to be fought back into the language.

| Library | Status | Why |
| --- | --- | --- |
| **shadcn/ui** | Not installed | The primitives the app needs are one file we fully control, and native elements provide keyboard and screen-reader behaviour for free. `clsx` + `tailwind-merge` are installed so a vetted component could be adapted later without a style fight (see `THIRD_PARTY_LICENSES.md`). |
| **Framer Motion → `motion`** | **Installed in v3.0** (reversing v2.0) | Dropped in v2.0 as decoration competing with data density. Re-added for the two things CSS cannot do well — a layout animation that glides between list items, and staged entrances — under `MotionConfig`, so both reduced-motion preferences still win. |
| **`tailwindcss-animate`** | Installed (dev) | Keyframe utilities on Tailwind 3; build-time only. |
| **React Native Paper**, **NativeWind**, **`@gorhom/bottom-sheet`** | Not installed | Native styles are plain `StyleSheet` objects reading `theme.ts`; parity is enforced by the token test rather than a shared build. |
| **Lucide** | Not installed | The app needs a few dozen glyphs; inline SVG themes for free and costs nothing on either platform. |
| **Lottie**, confetti | Not installed | Celebration animation contradicts the product's calm; achievements are medallions and badges. |
| **Recharts / Victory Native** | Not installed | A handful of visualisations do not justify a charting runtime with its own theming layer. |

**When to reconsider.** A UI dependency is allowed if it (a) renders correctly in both themes and under all three accessibility attributes, (b) accepts the token radii, borders and glass without an override sheet, and (c) introduces no second source of colour truth. Anything vendored gets a row in `THIRD_PARTY_LICENSES.md`.
