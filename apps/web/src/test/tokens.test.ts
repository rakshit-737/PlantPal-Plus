/**
 * Design-token contract tests for the Glasshouse palette.
 *
 * These parse the real index.css rather than a copy of its values, because the
 * design language's standing instruction is to re-measure whenever a hex
 * changes — a duplicated table in a test would just drift and keep passing.
 *
 * The measurement that matters is the COMPOSITE: glass is translucent, so ink
 * on a pane is really ink on (pane over ground). Measuring against the glass
 * token alone overstates contrast, which is the usual way glassmorphism
 * designs end up failing AA while looking checked.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// The mobile theme comes through Vite's `?raw`; index.css cannot, because
// vitest runs with `css: false` and hands back an empty string for any CSS
// import, query string or not. So the stylesheet is read off disk.
import mobileTheme from '../../../mobile/src/theme.ts?raw'

const here = path.dirname(fileURLToPath(import.meta.url))

// Comments are stripped first: index.css discusses its own selectors in prose
// (the cascade-order warning names [data-theme='dark']), and a naive search
// would match the explanation instead of the rule — silently testing the wrong
// theme's values while still passing.
const css = fs
  .readFileSync(path.join(here, '..', 'index.css'), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** The declarations of the first rule whose selector matches, brace-matched. */
function block(selector: string): Record<string, string> {
  // Anchored on "selector {" so a longer selector that merely starts with this
  // one ([data-high-contrast] vs [data-high-contrast][data-theme='dark'])
  // cannot be mistaken for it. Whitespace inside the selector is matched
  // loosely so a reformat — or a line-ending change — does not break the test.
  const pattern = selector
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s*')
  const at = css.search(new RegExp(pattern + '\\s*\\{'))
  if (at === -1) throw new Error(`selector not found in index.css: ${selector}`)
  const open = css.indexOf('{', at + selector.length)
  let depth = 0
  let end = open
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) {
      end = i
      break
    }
  }
  const out: Record<string, string> = {}
  for (const m of css.slice(open + 1, end).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]!] = m[2]!.trim()
  }
  return out
}

const LIGHT = block(":root,\n[data-theme='light']")
const DARK = block("[data-theme='dark']")
const HC = block('[data-high-contrast]')
const HC_LIGHT = block("[data-high-contrast],\n[data-high-contrast][data-theme='light']")
const HC_DARK = block("[data-high-contrast][data-theme='dark']")

type RGB = [number, number, number]

function parseColor(value: string): { rgb: RGB; alpha: number } {
  const rgba = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/)
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
      alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
    }
  }
  const h = value.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`unparseable colour: ${value}`)
  return { rgb: [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB, alpha: 1 }
}

/** Composite a possibly-translucent colour over an opaque ground. */
function flatten(value: string, ground: RGB): RGB {
  const { rgb, alpha } = parseColor(value)
  return rgb.map((c, i) => alpha * c + (1 - alpha) * ground[i]!) as RGB
}

function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as RGB
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg: RGB, bg: RGB): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const INKS = ['text-main', 'text-muted', 'primary', 'primary-hover', 'secondary', 'tertiary', 'accent']
const THEMES: [string, Record<string, string>][] = [
  ['light', LIGHT],
  ['dark', DARK],
]

describe.each(THEMES)('%s theme', (_name, T) => {
  const ground = parseColor(T['--color-background']!).rgb

  const surfaces: [string, RGB][] = [
    ['glass over background', flatten(T['--glass-bg']!, ground)],
    ['glass-strong over background', flatten(T['--glass-bg-strong']!, ground)],
    ['background', ground],
    ['background-alt', parseColor(T['--color-background-alt']!).rgb],
    ['surface', parseColor(T['--color-surface']!).rgb],
    ['surface-raised', parseColor(T['--color-surface-raised']!).rgb],
  ]

  it.each(surfaces)('every ink clears AA body text on %s', (_surfaceName, surface) => {
    for (const ink of INKS) {
      const ratio = contrast(parseColor(T[`--color-${ink}`]!).rgb, surface)
      expect(ratio, `${ink} measured ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('pairs on-primary with primary at AA', () => {
    const ratio = contrast(
      parseColor(T['--color-on-primary']!).rgb,
      parseColor(T['--color-primary']!).rgb,
    )
    expect(ratio, `on-primary measured ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
  })

  it('raises boundary contrast in high-contrast mode', () => {
    // With glass off, the border is the only thing separating a card from the
    // ground, so the high-contrast override has to be a real improvement and
    // not merely a different grey.
    const overrides = T === DARK ? HC_DARK : HC_LIGHT
    const surface = parseColor(T['--color-surface']!).rgb
    const normal = contrast(parseColor(T['--color-border']!).rgb, surface)
    const raised = contrast(parseColor(overrides['--color-border']!).rgb, surface)
    expect(raised).toBeGreaterThan(normal)
  })

  it('keeps the high-contrast muted ink at AA on an opaque surface', () => {
    const overrides = T === DARK ? HC_DARK : HC_LIGHT
    const ratio = contrast(
      parseColor(overrides['--color-text-muted']!).rgb,
      parseColor(T['--color-surface']!).rgb,
    )
    expect(ratio, `hc text-muted measured ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
  })
})

describe('cascade order', () => {
  it('declares the dark block after the light one', () => {
    // `:root` and `[data-theme='dark']` both have specificity (0,1,0), so on
    // <html data-theme="dark"> — which matches both — source order alone picks
    // the winner. Declaring dark first would let the `:root` light values
    // override it and silently disable dark mode everywhere, with no error and
    // no failing selector to find.
    const light = css.search(/:root,\s*\[data-theme='light'\]\s*\{/)
    const dark = css.search(/\[data-theme='dark'\]\s*\{/)
    expect(light).toBeGreaterThan(-1)
    expect(dark).toBeGreaterThan(light)
  })
})

describe('the on-primary token is load-bearing', () => {
  it('rejects white on the dark-mode primary', () => {
    // The reason the token exists rather than a hard-coded white. If this ever
    // passes, the dark primary drifted light enough that the whole inversion
    // rule can be reconsidered — until then, white here is a real AA failure.
    const ratio = contrast([255, 255, 255], parseColor(DARK['--color-primary']!).rgb)
    expect(ratio).toBeLessThan(4.5)
  })

  it('inverts between the two themes', () => {
    expect(parseColor(LIGHT['--color-on-primary']!).rgb).toEqual([255, 255, 255])
    expect(parseColor(DARK['--color-on-primary']!).rgb).toEqual(
      parseColor(DARK['--color-background']!).rgb,
    )
  })
})

describe('high-contrast mode', () => {
  it('switches glass off entirely rather than tinting it', () => {
    // Translucency is what costs contrast; a "high-contrast glass" would be a
    // contradiction. Panes become the opaque surface and the blur goes to zero.
    expect(HC['--glass-bg']).toBe('var(--color-surface)')
    expect(HC['--glass-bg-strong']).toBe('var(--color-surface)')
    expect(HC['--glass-blur']).toBe('0px')
  })

  it('removes every glow', () => {
    for (const glow of ['--glow-primary', '--glow-accent', '--glow-soft']) {
      expect(HC[glow], glow).toBe('none')
    }
  })
})

describe('mobile token parity', () => {
  /** The object literal for `export const <name>: Palette = { ... }`. */
  function palette(name: string): Record<string, string> {
    const at = mobileTheme.indexOf(`export const ${name}: Palette = {`)
    expect(at, `${name} palette not found in mobile theme.ts`).toBeGreaterThan(-1)
    const end = mobileTheme.indexOf('\n}', at)
    const out: Record<string, string> = {}
    for (const m of mobileTheme.slice(at, end).matchAll(/(\w+):\s*'([^']+)'/g)) out[m[1]!] = m[2]!
    return out
  }

  // Web custom property -> mobile camelCase key.
  const MIRRORED: [string, string][] = [
    ['--color-background', 'background'],
    ['--color-background-alt', 'backgroundAlt'],
    ['--color-surface', 'surface'],
    ['--color-surface-raised', 'surfaceRaised'],
    ['--color-primary', 'primary'],
    ['--color-primary-hover', 'primaryHover'],
    ['--color-primary-glow', 'primaryGlow'],
    ['--color-secondary', 'secondary'],
    ['--color-tertiary', 'tertiary'],
    ['--color-accent', 'accent'],
    ['--color-text-main', 'textMain'],
    ['--color-text-muted', 'textMuted'],
    ['--color-border', 'border'],
    ['--color-on-primary', 'onPrimary'],
    ['--glass-bg', 'glassBg'],
    ['--glass-bg-strong', 'glassBgStrong'],
    ['--glass-border', 'glassBorder'],
    ['--glass-highlight', 'glassHighlight'],
  ]

  it.each([
    ['light', LIGHT],
    ['dark', DARK],
  ])('%s palette matches the web token for token', (name, T) => {
    const native = palette(name)
    for (const [web, mobile] of MIRRORED) {
      const expected = parseColor(T[web]!)
      const actual = parseColor(native[mobile]!)
      expect(actual.rgb, `${web} vs mobile ${mobile}`).toEqual(expected.rgb)
      expect(actual.alpha, `${web} alpha vs mobile ${mobile}`).toBeCloseTo(expected.alpha, 3)
    }
  })
})
