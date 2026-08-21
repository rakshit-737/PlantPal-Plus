/**
 * Tailwind tokens per docs/design/01-design-language.md, revised by the 2026-08
 * "Glasshouse" v3.0 direction.
 *
 * Colours are wired to CSS custom properties (declared in index.css) so a single
 * `data-theme` switch flips the whole palette between light and dark without
 * duplicating utility classes. v2.0's sharp-corner rule is repealed — glass
 * needs curvature to read as a pane — but not abolished: `sm` stays tight
 * because anything holding a metric still lives in a square-ish cell. Metrics
 * use font-mono so numbers read like ledger entries.
 */
import tailwindcssAnimate from 'tailwindcss-animate'

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
        background: 'var(--color-background)',
        'background-alt': 'var(--color-background-alt)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        // Glow/highlight only — not contrast-checked as ink, so never text.
        'primary-glow': 'var(--color-primary-glow)',
        secondary: 'var(--color-secondary)',
        tertiary: 'var(--color-tertiary)',
        accent: 'var(--color-accent)',
        'on-primary': 'var(--color-on-primary)',
        'text-main': 'var(--color-text-main)',
        'text-muted': 'var(--color-text-muted)',
        border: 'var(--color-border)',
        // Glass panes. `glass` is the resting surface, `glass-strong` the one
        // used where content sits above other content (modals, popovers).
        glass: 'var(--glass-bg)',
        'glass-strong': 'var(--glass-bg-strong)',
        'glass-border': 'var(--glass-border)',
        'glass-highlight': 'var(--glass-highlight)',
      },
      borderRadius: {
        // Inputs, badges, table cells — anything holding a metric.
        sm: '6px',
        // Buttons, list rows, toasts.
        md: '10px',
        // Cards, panels, tiles.
        lg: '16px',
        // Modals, hero panels, the sidebar.
        xl: '22px',
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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['"Bricolage Grotesque"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Display step for the landing and auth surfaces. Large type needs
        // tighter tracking or it reads as loose at these sizes.
        display: ['clamp(2.5rem, 1.6rem + 4.5vw, 4rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
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
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
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
