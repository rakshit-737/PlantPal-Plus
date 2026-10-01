/**
 * Tailwind tokens per docs/design/01-design-language.md, revised by the 2026-10
 * "Conservatory" v4.0 direction (index.css carries the palette and its
 * rationale; this file maps it onto utilities).
 *
 * Colours are wired to CSS custom properties (declared in index.css) so a single
 * `data-theme` switch flips the whole palette between light and dark without
 * duplicating utility classes. v2.0's sharp-corner rule is repealed — glass
 * needs curvature to read as a pane — but not abolished: `sm` stays tight
 * because anything holding a metric still lives in a square-ish cell. Metrics
 * use font-mono so numbers read like ledger entries.
 */
import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * Wraps a token so Tailwind's opacity modifiers work on it.
 *
 * Tailwind can only apply `/40` to a colour it can decompose into channels. A
 * bare `var(--x)` is opaque to it, so rather than failing it emits *no rule at
 * all* — `bg-accent/10` silently produces nothing, and the element renders
 * untinted with no error anywhere. That had quietly disabled every tinted
 * surface in the app: Alert fills and borders, Badge tones, ErrorState, the
 * combobox's active row.
 *
 * The usual fix is to store channel triplets and use `rgb(var(--x) / <alpha-value>)`,
 * but that would stop the tokens being readable hex and break the one-for-one
 * mirror with apps/mobile/src/theme.ts. color-mix keeps the hex and lets the
 * modifier through: with no modifier Tailwind substitutes 1, which mixes 100%
 * of the colour and leaves it untouched.
 */
const alphaToken = (name) =>
  `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`

/** @type {import('tailwindcss').Config} */
export default {
  // Test files are excluded deliberately: a class name quoted in an assertion
  // is not a class the app renders, but Tailwind cannot tell the difference and
  // compiles it into the shipped stylesheet.
  content: ['./index.html', './src/**/!(*.test|*.spec).{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: alphaToken('--color-background'),
        'background-alt': alphaToken('--color-background-alt'),
        surface: alphaToken('--color-surface'),
        'surface-raised': alphaToken('--color-surface-raised'),
        primary: alphaToken('--color-primary'),
        'primary-hover': alphaToken('--color-primary-hover'),
        // Glow/highlight only — not contrast-checked as ink, so never text.
        'primary-glow': alphaToken('--color-primary-glow'),
        secondary: alphaToken('--color-secondary'),
        tertiary: alphaToken('--color-tertiary'),
        accent: alphaToken('--color-accent'),
        'on-primary': alphaToken('--color-on-primary'),
        'text-main': alphaToken('--color-text-main'),
        'text-muted': alphaToken('--color-text-muted'),
        // Decorative hairlines only. Anything a user operates gets
        // border-control, which is the one that clears WCAG 1.4.11's 3:1.
        border: alphaToken('--color-border'),
        'border-control': alphaToken('--color-border-control'),
        // Glass panes. `glass` is the resting surface, `glass-strong` the one
        // used where content sits above other content (modals, popovers).
        // These tokens already carry their own alpha; a modifier on top scales
        // it rather than replacing it, which is the sensible reading.
        glass: alphaToken('--glass-bg'),
        'glass-strong': alphaToken('--glass-bg-strong'),
        'glass-border': alphaToken('--glass-border'),
        'glass-highlight': alphaToken('--glass-highlight'),
      },
      borderRadius: {
        // Inputs, badges, table cells — anything holding a metric.
        sm: '8px',
        // Buttons, list rows, toasts.
        md: '12px',
        // Cards, panels, tiles.
        lg: '18px',
        // Modals, hero panels, the sidebar.
        xl: '24px',
        '2xl': '28px',
        full: '9999px',
      },
      backdropBlur: {
        glass: 'var(--glass-blur)',
      },
      boxShadow: {
        1: 'var(--shadow-1)',
        2: 'var(--shadow-2)',
        3: 'var(--shadow-3)',
        4: 'var(--shadow-4)',
        'glow-primary': 'var(--glow-primary)',
        'glow-accent': 'var(--glow-accent)',
        'glow-soft': 'var(--glow-soft)',
        // A pane: the 1px top-edge highlight that makes glass read as glass,
        // over the standard resting elevation. Composed here so components do
        // not each hand-roll the inset layer and drift apart.
        glass: 'inset 0 1px 0 0 var(--glass-highlight), var(--shadow-2)',
        'glass-raised': 'inset 0 1px 0 0 var(--glass-highlight), var(--shadow-3)',
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        // Working headings — section titles, card titles, dialog titles.
        heading: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Display serif for page titles and the marketing surfaces: the one
        // voice in the product that is allowed to be expressive.
        display: ['Fraunces', 'ui-serif', 'Georgia', '"Times New Roman"', 'serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Display steps for the landing and auth surfaces. Large type needs
        // tighter tracking or it reads as loose at these sizes.
        display: ['clamp(2.75rem, 1.4rem + 5.4vw, 5.25rem)', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        'display-sm': ['clamp(2rem, 1.3rem + 2.6vw, 3rem)', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
      },
      spacing: {
        // 8pt grid aliases from the design language doc.
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
      },
      transitionTimingFunction: {
        entrance: 'var(--ease-entrance)',
        state: 'var(--ease-state)',
      },
      transitionDuration: {
        micro: '120ms',
        standard: '220ms',
        entrance: '400ms',
        reveal: '700ms',
      },
      keyframes: {
        // Growth, not slide: the reveal for lists, tiles and panels. No
        // horizontal translation, per the motion contract.
        'grow-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.985)' },
          to: { opacity: '1', transform: 'none' },
        },
        // The reduce-motion fallback for anything using grow-in — a
        // cross-fade, never a jump-cut that loses state.
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'grow-in': 'grow-in var(--motion-entrance) var(--ease-entrance) both',
        'fade-in': 'fade-in var(--motion-standard) var(--ease-state) both',
      },
    },
  },
  // Animata components assume this plugin on Tailwind 3.x; it is not needed on
  // v4. Registered here rather than at install time so the config change lands
  // with the tokens it belongs to. Imported, not `require`d — this package is
  // "type": "module", so the config is ESM.
  plugins: [tailwindcssAnimate],
}
