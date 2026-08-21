/**
 * Tailwind tokens per docs/design/01-design-language.md, revised by the 2026-07
 * "field notebook" redesign.
 *
 * Colours are wired to CSS custom properties (declared in index.css) so a single
 * `data-theme` switch flips the whole palette between light and dark without
 * duplicating utility classes. Radii are deliberately tight — sharp corners and
 * hairline borders are the design's signature; `full` survives only for the
 * spinner. Metrics use font-mono so numbers read like ledger entries.
 */
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
      borderRadius: {
        lg: '8px',
        md: '4px',
        sm: '2px',
        full: '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['"Bricolage Grotesque"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
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
    },
  },
  plugins: [],
}
