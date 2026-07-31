# PlantPal+ Component Inventory

| Field | Value |
| --- | --- |
| Document | `02-component-inventory.md` — Component mapping and animation strategy |
| Version | 2.0 |
| Updated | 2026-07-31 |
| Owner | Rakshit |

> **v2.0 supersedes v1.0.** v1.0 planned shadcn/ui, React Native Paper, Lucide, Framer Motion, Lottie and Recharts. **None of those are installed.** The shipped app hand-rolls a small primitive set against the design tokens. See §7 for what was dropped and why.

## 1. Overview

The entire web UI is built from one file — `apps/web/src/components/ui.tsx` — and the entire native UI from its mirror, `apps/mobile/src/components/ui.tsx`. Between them they have **zero UI dependencies**: `apps/web/package.json` ships `react`, `react-dom`, `react-router-dom` and `@plantpal/shared`; `apps/mobile/package.json` ships Expo modules and `react-native-safe-area-context`. Nothing else.

Three rules govern every component here:

- **Tokens only.** No hard-coded colour. Every value resolves through a Tailwind class backed by a CSS custom property (web) or a `usePalette()` field (native).
- **Native elements first.** `<button>`, `<input>`, `<select>`, `<label htmlFor>`. Keyboard support and screen-reader semantics come free; we only hand-roll ARIA where no native element exists (`Combobox`, `Modal`).
- **Field-notebook styling.** `rounded-sm`/`rounded-md` only, hairline borders instead of shadows, uppercase letterspaced eyebrows for labels, and every metric in `font-mono`.

## 2. Web Component Inventory

All exported from `apps/web/src/components/ui.tsx`. Covered by `apps/web/src/components/ui.test.tsx`.

### Button

| | |
| --- | --- |
| **Purpose** | Every clickable action. There is no separate IconButton, FAB or link-button. |
| **Props** | `variant?: 'primary' \| 'secondary' \| 'ghost' \| 'danger'` (default `primary`), `loading?: boolean` (default `false`), plus all native `ButtonHTMLAttributes`. |
| **States** | Idle · hover (variant-specific) · focus-visible (`ring-2` + `ring-offset-2 ring-offset-background`) · disabled (`opacity-60`, `cursor-not-allowed`) · loading. |

Variants: **primary** is a solid `bg-primary` fill with `text-on-primary`. **secondary** is `bg-surface` with a hairline border that darkens to `text-muted` on hover. **ghost** is transparent muted text that gains a `bg-surface` wash on hover. **danger** is an *accent-outline stamp* — transparent fill, `border-accent/40`, `text-accent`, `bg-accent/10` on hover, and it rings in `accent` rather than `primary`.

**Usage rules**
- `loading` implies disabled (`disabled={disabled || loading}`) and sets `aria-busy`.
- **The label stays mounted while loading** — a spinner dot is prepended, never substituted, so the button never changes width mid-request. Do not swap children for "Saving…".
- **Never a solid red button.** Destructive intent is `variant="danger"`, an outline. Confirmation for a genuinely destructive action belongs in a `Modal`, not in the button's colour.
- **Every independently-triggerable action owns its busy flag.** A list of ten "Water" buttons needs ten flags, not one — the shipped pattern is `useState<Set<string>>` keyed by row id (`PlantsPage`, `DashboardPage`) so watering one plant never spins the other nine. Same for the hydration `+250` / `+500` pair in `NutritionPage`.

### Input

| | |
| --- | --- |
| **Purpose** | A labelled text field. Wraps label + input + message in one `flex-col gap-xs`. |
| **Props** | `label: string` (**required**), `error?: string`, `hint?: string`, plus all native `InputHTMLAttributes`. `forwardRef` to the `<input>`. |
| **States** | Idle · focus-visible (`ring-2 ring-primary`) · error (`border-accent` + `aria-invalid`) · hint · disabled (native). |

**Usage rules**
- The label is an eyebrow: 11px, uppercase, `tracking-[0.08em]`, muted. It is required — there are no unlabelled fields in this app.
- The id resolves `id ?? name ?? slugified label`, so `htmlFor` always binds without callers inventing ids.
- `error` and `hint` are mutually exclusive in the ARIA wiring: `aria-describedby` points at the error when present, otherwise the hint. Pass both freely; the error wins while it exists.
- Validation messages go in `error` (field-level), not in an `Alert` (form-level).

### Select

Same shape and contract as `Input` (`label` required, `error`, `hint`, `forwardRef`, all native `SelectHTMLAttributes`), wrapping a **native `<select>`** styled `appearance-none` with an inline chevron SVG positioned in the `pr-xl` gutter.

**Usage rule:** use `Select` for closed sets the user can enumerate (units, meal type, care action). Reach for `Combobox` only when the list is long enough or remote enough that typing beats scrolling.

### Combobox

| | |
| --- | --- |
| **Purpose** | Accessible autocomplete for large or remote option sets — plant species, foods, exercises. |
| **Props** | `label`, `query: string`, `onQueryChange: (q: string) => void`, `options: ComboOption[]`, `onSelect: (option: ComboOption \| null) => void`, `placeholder?`, `loading?`, `error?`, `hint?`, `emptyText?` (default `'No matches'`). |
| **`ComboOption`** | `{ id: string; label: string; sub?: string }` — `sub` renders as a quiet **mono** second line (latin name, macros, MET value). |
| **States** | Closed · open with results · open with `emptyText` · loading (inline `Spinner` in the field) · error/hint. |

**Ownership split.** The parent owns the query text and the option list, so debounced fetching lives where the data lives. The component owns open state, keyboard navigation and ARIA (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`, `role="listbox"`/`"option"`).

**Usage rules**
- **Selection contract:** `onSelect` fires with the picked option; the parent then sets `query` to that option's label. Typing afterwards fires `onSelect(null)` — a stale id can never ride along under newer text. Callers must honour this or they will submit mismatched ids.
- Nothing is highlighted until an arrow key asks for it (`activeIndex` starts at `-1`), so Enter on typed text never silently picks a row the user did not aim at.
- The highlight resets when the **option ids** change, not on every parent re-render — re-rendering must not drop a user mid-navigation.
- Escape calls `stopPropagation` while open, so closing the list does not also close an enclosing `Modal`.
- Focus leaving the widget closes the list, so the listbox never covers the control the user tabbed to.

### Card

| | |
| --- | --- |
| **Purpose** | The only container. Every panel in the app is a Card. |
| **Props** | `children`, `className?`. |
| **Styling** | `rounded-md border border-border bg-surface p-lg`. |

**Usage rules:** no shadow, ever. Do not nest Cards — use a hairline `border-t`/`border-border` divider inside one Card instead. `className` is for layout (`flex`, `grid`, `gap-*`), not for repainting the surface.

### Alert

| | |
| --- | --- |
| **Purpose** | A **form-level** inline notice: auth failures, submission successes. |
| **Props** | `tone?: 'error' \| 'success' \| 'info'` (default `error`), `children`. |
| **Semantics** | `role="alert"`. |

Tones are 40%-border / 10%-tint pairs on `accent`, `primary` (text in `primary-hover`) and `secondary`.

**Usage rules:** field-level problems belong in `Input.error`, not here. Alert renders no dismiss affordance — callers clear it by unmounting (setting their error state to null). Transient confirmations should be a **toast**, not an Alert; use Alert only when the message must persist next to the form.

### Spinner

| | |
| --- | --- |
| **Purpose** | Indeterminate loading, inline or full-panel. |
| **Props** | `size?: 'sm' \| 'md' \| 'lg'` (16 / 24 / 32px). |
| **Semantics** | `role="status"`, `aria-label="Loading"`. |

A pure CSS border ring (`border-border border-t-primary animate-spin`) — one of only two `rounded-full` exceptions in the design.

**Usage rule:** first load of a page uses a centred `size="lg"` Spinner; a refresh of already-rendered data should keep the data on screen rather than replacing it with a spinner. Inline `size="sm"` for in-field states (Combobox).

### Badge

| | |
| --- | --- |
| **Purpose** | Small status/tier/count stamp. |
| **Props** | `tone?: 'default' \| 'success' \| 'warning' \| 'danger' \| 'info'` (default `default`), `children`. |
| **Styling** | `rounded-sm`, 11px, medium, uppercase, `tracking-[0.06em]`, border + 10% tint. |

**Usage rule:** a Badge is a *label*, never a control — if it is clickable it should be a `Button`. Keep the text to one or two words; it is set uppercase and will not wrap gracefully.

### Progress

| | |
| --- | --- |
| **Purpose** | Linear progress against a target — macros, hydration, streak goals. |
| **Props** | `value: number`, `max: number`, `label?: string`, `srLabel?: string`, `tone?: 'primary' \| 'secondary' \| 'tertiary'` (default `primary`). |
| **Semantics** | `role="progressbar"` with `aria-valuenow` / `aria-valuemin` / `aria-valuemax`, named by `label ?? srLabel`. |

The fill is clamped to 0–100% and returns 0 when `max <= 0`, so a missing target cannot produce a NaN width. When `label` is given, the component renders a header row with the label on the left and a **mono** `value / max` read-out on the right.

**Usage rules**
- **`srLabel` is not optional in practice.** If you render the visible label yourself (a section heading above the bar), you must pass `srLabel` — otherwise the bar reaches screen readers as an unnamed progressbar.
- Tones map to categories (primary = plants/protein, secondary = fitness/carbs, tertiary = nutrition/fat), not to severity.

### EmptyState

| | |
| --- | --- |
| **Purpose** | A list or screen that legitimately has no rows yet. |
| **Props** | `icon?: ReactNode`, `title: string`, `body?: string`, `action?: ReactNode`. |

**Usage rules:** the copy invites the next action ("No plants yet — add your first"), and `action` should carry the `Button` that performs it. Pass a stroke SVG per §6 of `01-design-language.md` for `icon`, not an emoji.

### ErrorState

| | |
| --- | --- |
| **Purpose** | A **load failure**. Deliberately distinct from `EmptyState`. |
| **Props** | `title?` (default `"Couldn't load this"`), `body?` (default `'The server could not be reached. Your data is safe — try again.'`), `onRetry?: () => void`, `retryLabel?` (default `'Try again'`). |
| **Semantics** | `role="alert"`; accent-tinted panel with a `Connection trouble` eyebrow; retry renders as `Button variant="secondary"`. |

**Usage rule — the important one:** *an empty garden invites planting; a failed request explains itself and offers a retry.* **A load failure must render `ErrorState` with an `onRetry`, never `EmptyState`.** Showing "No plants yet" when the fetch died tells the user their data is gone. Every page that fetches keeps a separate `…Error` boolean alongside its data (`dashError`, `remindersError`, `loadError`) precisely so the two cases can never collapse into one. Reassure explicitly that nothing was lost.

### Modal

| | |
| --- | --- |
| **Purpose** | Focused create/confirm flows without leaving the page — Add plant, Log workout, Remove plant. |
| **Props** | `open: boolean`, `onClose: () => void`, `title: string`, `children`, `busy?: boolean` (default `false`). |
| **Semantics** | `role="dialog"`, `aria-modal`, `aria-labelledby` on the `font-heading` title. |

**Behaviour**
- **Focus trap.** Tab and Shift+Tab cycle inside the panel. If focus escapes entirely (e.g. a button disables itself and the browser drops focus to `<body>`), the next Tab **recaptures** to the first focusable element rather than walking the page. With no focusable children, Tab is swallowed.
- The trap deliberately does **not** filter by `offsetParent`: the panel sits inside a fixed-position backdrop where `offsetParent` is null in some engines (and always under jsdom), which would empty the candidate list and swallow Tab entirely. The selector already skips `[disabled]`, and conditionally-hidden fields in this app are unmounted rather than `display:none`.
- Focus moves into the panel on open and is **restored** to the previously active element on close.
- Body scroll locks while open and the previous `overflow` is restored on close.
- **`busy` guards dismissal.** While `busy`, Escape and backdrop clicks are ignored so an in-flight save cannot be discarded by a stray click. Pass the same flag that drives the submit button's `loading`.

### StatCard

| | |
| --- | --- |
| **Purpose** | A dashboard ledger tile: eyebrow label, big mono value, quiet mono context line. |
| **Props** | `label: string`, `value: string`, `sub: string`, `accent: string` — **`accent` is a Tailwind text-colour class** (e.g. `'text-primary'`), applied to the value. |

**Usage rules:** `value` is pre-formatted by the caller (locale separators, units) because the component only renders. Both `value` and `sub` are `font-mono` — a StatCard whose number is not mono is a bug. `accent` must be a token-backed class; never an arbitrary hex.

### PageHeader

| | |
| --- | --- |
| **Purpose** | The consistent top of every page. |
| **Props** | `title: string`, `subtitle?: string`, `action?: ReactNode`. |
| **Styling** | 26px `font-heading` bold `tracking-tight`; subtitle 14px muted; `action` pinned right, `shrink-0`. |

**Usage rule:** exactly one `PageHeader` per route, and it owns the only `<h1>`. The page's primary action (Add plant, Log workout) goes in `action`; there is no FAB.

### ToastProvider / useToast

| | |
| --- | --- |
| **Purpose** | Ephemeral confirmation and failure feedback. |
| **API** | `useToast()` → `{ success(message), error(message), info(message) }`. |
| **Provider** | `<ToastProvider>` wraps the app; the viewport is a fixed `aria-live="polite"` region — bottom-centre above the mobile tab bar (`bottom-[calc(72px+env(safe-area-inset-bottom))]`), bottom-right on `md+`. |

**Behaviour**
- Each toast is a hairline card with a 2px **tone-coloured left edge** and an eyebrow: `Logged` (success, `primary`), `Not saved` (error, `accent`), `Note` (info, `secondary`).
- Dismissal timers: **4000ms**, **6500ms for errors**. Hover or focus **pauses** the timer; leaving restarts a 2000ms grace period.
- Stack is capped — new toasts append to `list.slice(-3)`, so at most four are on screen.
- Errors render `role="alert"`; success and info render `role="status"`.
- Each toast has a dismiss button labelled `Dismiss notification`.
- Entrance is the `toast-enter` class (160ms rise + fade) and is neutralised by both reduced-motion mechanisms.
- `useToast()` returns a **safe no-op triple** outside a provider, so components can be unit-tested without wrapping.

**Usage rules:** success copy confirms the verb that caused it ("Watered Monstera"), not a generic "Saved". Error copy says what failed and that retrying is safe. A message the user must act on is an `Alert` or `ErrorState`, not a toast — toasts disappear.

## 3. Mobile Component Inventory

`apps/mobile/src/components/ui.tsx`, styled from `apps/mobile/src/theme.ts`. Small on purpose — these cover every screen.

| Component | Props | Notes |
| --- | --- | --- |
| **`type`** (StyleSheet) | — | Shared text treatments: `type.eyebrow` (11px, uppercase, `letterSpacing: 1`), `type.metric` (mono, 24px, 600), `type.mono` (mono, 12px). Import these instead of re-declaring per screen. |
| **Eyebrow** | `text`, `color?`, `style?` | Uppercase letterspaced section label, `textMuted` by default. |
| **MetricText** | `text`, `color?`, `style?` | A ledger value in mono. Pair with an `Eyebrow` above it to make a stat tile — there is no native `StatCard`. |
| **Card** | `children`, `style?` | `borderWidth: StyleSheet.hairlineWidth`, `borderRadius: 4`, `padding: space.md`. |
| **Button** | `title`, `onPress`, `variant?` (`primary\|secondary\|ghost\|danger`), `loading?`, `disabled?` | Mirrors the web variant semantics — `danger` is an accent-outline stamp, not a solid red fill. `radius 3`, `opacity 0.85` while pressed, `ActivityIndicator` replaces the label while loading, `accessibilityRole="button"`. |
| **Input** | `label?`, `value`, `onChangeText`, `placeholder?`, `secureTextEntry?`, `keyboardType?`, `autoCapitalize?` (default `'none'`) | Label renders through `Eyebrow`. `radius 3`, hairline border. |
| **Badge** | `text`, `color?` | Colour drives a `1a` (10%) fill and `66` (40%) border of the same ink — same construction as the web tones. `radius 2`. |
| **Spinner** | — | Centred `ActivityIndicator size="large"` in `primary`, with `space.xl` vertical padding. No size prop. |
| **EmptyState** | `icon: string`, `title`, `body` | **`icon` is a text glyph here**, rendered at 36px — the native side has no inline-SVG equivalent of the web's stroke icons. |
| **PageHeader** | `title`, `subtitle?` | 24px/700 `letterSpacing: -0.4`. No `action` slot; screens place their own action button. |
| **ErrorText** | `message` | Accent-coloured inline validation line; renders nothing for an empty string. |
| **OfflineNotice** | `onRetry`, `retrying?` | In `components/OfflineNotice.tsx`. The native counterpart to `ErrorState`: "Couldn't reach the server" + secondary Retry button in a Card. Same rule applies — a fetch failure uses this, never `EmptyState`. |

## 4. Web / Mobile Parity

| Concern | Web | Mobile | Parity |
| --- | --- | --- | --- |
| Colour tokens | `index.css` custom properties | `theme.ts` `Palette` objects | **Exact** — same eleven hex values per theme. Changing one without the other is a bug. |
| Theme switch | `data-theme` on `<html>`, persisted in `localStorage` | `useColorScheme()` (OS only) | Partial — no in-app override on native yet. |
| Spacing | `xs…2xl` Tailwind aliases | `space = { xs…xl }` | Near-exact; native has no `2xl` (safe-area insets cover it). |
| Radii | 2 / 4 (8 unused) | 2 / 3 / 4 | Equivalent. |
| Mono metrics | IBM Plex Mono via `font-mono` | `monoFont` — Menlo (iOS) / `monospace` | Equivalent; no bundled font package on native by design. |
| Headings | Bricolage Grotesque | System sans at 600–700 | Web-only display face. |
| Button | 4 variants + `loading` | 4 variants + `loading` | **Exact** semantics. |
| Card / Input / Badge / Spinner / EmptyState / PageHeader | ✓ | ✓ | Present both sides; native versions have fewer props. |
| Load-failure state | `ErrorState` (+ `onRetry`) | `OfflineNotice` (+ `onRetry`) | Same contract, different name. |
| Select / Combobox / Modal / Progress / StatCard / Toasts | ✓ | — | **Web only.** Native screens compose `Eyebrow` + `MetricText` for tiles and use platform affordances instead of a custom dialog layer. |
| Nav iconography | Inline stroke SVG (§6 of doc 01) | Uppercase eyebrow tab labels, no glyphs | Both emoji-free. |

## 5. Icons and Illustrations

**No icon library, no illustration set.** Icons are inline stroke SVGs authored beside the screens that use them — 24×24 viewBox, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.5}`, `strokeLinecap="square"`, `aria-hidden`. The full convention, the reference implementations, and the one known drift (`navItems.tsx`, still at `strokeWidth={2}` with round caps) are documented in `01-design-language.md` §6.

Empty states use a stroke icon plus copy — there are no unDraw illustrations and no Lottie files in the repository.

## 6. Charts

**No chart library.** The two data visualisations in the app are hand-rolled SVG against the same tokens:

- **Calorie ring** (`NutritionPage`) — two `<circle>` elements, a `border`-coloured track and a `primary` arc driven by `strokeDasharray`/`strokeDashoffset`, with the value written in the centre via `<text className="fill-text-main font-mono">`. The 700ms `stroke-dashoffset` transition is the app's only non-trivial animation.
- **Macro bars** — the shared `Progress` component with `tone` per macro, not a chart.

**Usage rule:** if a new visualisation is needed, draw it in SVG with `var(--color-*)` strokes and `font-mono` labels before proposing a dependency. Charts must render correctly in both themes and under `[data-high-contrast]`.

## 7. What Was Dropped From v1.0 — and Why

Every third-party UI dependency planned in v1.0 was removed before ship. The unifying reason: **a dependency-free UI keeps the design tokens the single source of styling truth, and keeps the bundle small.** Each library below would have shipped its own colours, radii, motion curves and DOM structure, which then have to be fought back into the field-notebook language — the override layer costs more than the components saved.

| v1.0 planned | Status | Why it was dropped |
| --- | --- | --- |
| **shadcn/ui** (web components) | **Not installed** | Its defaults (soft radii, shadow elevation, its own focus treatment) are exactly what the redesign rejects. The dozen primitives we actually use are ~800 lines in one file we fully control, and native `<button>`/`<input>`/`<select>` give us keyboard and screen-reader behaviour for free. |
| **React Native Paper** (FAB, Snackbar) | **Not installed** | Material Design has a strong visual opinion that fights the notebook language, and it is a large dependency for two widgets. The FAB was designed away entirely — the page's primary action lives in `PageHeader.action`. |
| **NativeWind** | **Not installed** | Native styles are plain `StyleSheet` objects reading `usePalette()`. Parity with the web is enforced by keeping `theme.ts` in lock-step with `index.css`, which is a smaller and more auditable contract than a shared Tailwind build across two platforms. |
| **Lucide** (`lucide-react`, `lucide-react-native`) | **Not installed** | The icon set the design wants is ~15 glyphs. Inline SVG lets us pin `strokeWidth 1.5` and **square** caps — the pen-on-paper detail that makes the set feel hand-drawn — which a shipped icon font/library does not offer, while adding a dependency on both platforms. |
| **Framer Motion** (web) / **Reanimated** springs (native) | **Not installed** | The redesign's motion budget is six functional transitions (`01-design-language.md` §7). Spring physics and layout animation were decoration competing with data density, and they made the two reduced-motion mechanisms hard to honour. CSS transitions clamp cleanly; a JS animation library does not. |
| **Lottie** (growth animations, confetti) | **Not installed** | Celebration animation contradicts the ledger metaphor and would be dead weight under `[data-reduce-motion]`. Achievements are recorded as `Badge` stamps instead. |
| **Recharts** (web) / **Victory Native** (mobile) | **Not installed** | Two visualisations did not justify a charting runtime that ships its own theming layer. Hand-rolled SVG (§6) inherits the tokens automatically, including high-contrast mode. |
| **unDraw** illustrations | **Not used** | Stock illustration reads as marketing; a stroke icon plus honest copy reads as a notebook. |
| **`@gorhom/bottom-sheet`** | **Not installed** | Native screens use plain navigation instead of a sheet layer. |

**What replaced them, in one line:** one hand-rolled primitives file per platform, native elements wherever one exists, inline SVG for icons and charts, CSS transitions for the little motion that remains — all reading from the token set in `01-design-language.md`.

**When to reconsider.** Adding a UI dependency is allowed, but it must (a) render correctly in both themes and under all three accessibility attributes, (b) accept our radii and hairline borders without an override sheet, and (c) not introduce a second source of colour truth. If it cannot do all three, hand-roll it.
