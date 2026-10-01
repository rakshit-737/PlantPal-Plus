/**
 * Design tokens — the React Native mirror of apps/web/src/index.css, per
 * docs/design/01-design-language.md. "Conservatory" v4.0: ivory paper and deep
 * emerald under morning glass in light; a botanical noir — near-black with a
 * green undertone, luminous emerald, moonlit sky and champagne gold — in dark.
 * Translucent surfaces and four steps of elevation carry hierarchy, while the
 * ledger survives underneath in the mono metrics and hairline rules.
 *
 * Every web token has a mirror here under the same name in camelCase, so the
 * two clients read as one product. Values must stay in lock-step; changing one
 * side alone is the way this drifts.
 *
 * Two things do not translate and are expressed natively instead:
 *   - `--glass-blur` is a CSS backdrop-filter. On native it is a real blur view
 *     (expo-blur), so this file carries the intensity as a number for that
 *     component rather than a CSS length.
 *   - `--shadow-*` and `--glow-*` are box-shadow strings. iOS and Android model
 *     elevation differently, so the four steps are expressed per-platform here
 *     rather than scattering Platform.select through screens.
 */

import { Platform, useColorScheme } from 'react-native'

export interface Palette {
  background: string
  /** Banded section grounds — a second ground so a screen can have rhythm. */
  backgroundAlt: string
  surface: string
  /** Modals, popovers, active rows. */
  surfaceRaised: string
  primary: string
  primaryHover: string
  /** Glow and highlight only — never use as a text or icon colour. */
  primaryGlow: string
  secondary: string
  tertiary: string
  accent: string
  textMain: string
  textMuted: string
  /** Decorative hairlines only — well below 3:1 by design. */
  border: string
  /** Every interactive boundary. Clears the 3:1 non-text contrast minimum. */
  borderControl: string
  /** Text placed on a solid primary fill. Inverts between themes. */
  onPrimary: string
  /** Translucent pane fill, composited over `background` by the blur view. */
  glassBg: string
  /** The stronger pane, for content sitting above other content. */
  glassBgStrong: string
  glassBorder: string
  /** The 1px top edge that makes a pane read as glass rather than a panel. */
  glassHighlight: string
  danger: string
  warning: string
  success: string
}

export const light: Palette = {
  background: '#f6f4ee',
  backgroundAlt: '#eeebe2',
  // Warm paper rather than pure white: #fff reads as a screenshot.
  surface: '#fffdf8',
  surfaceRaised: '#ffffff',
  primary: '#0d5c3c',
  primaryHover: '#094a30',
  primaryGlow: '#2fbf7f',
  secondary: '#1d5b82',
  tertiary: '#7f5410',
  // Burnt coral: clears 4.5:1 on every light ground. See the note in the web
  // index.css.
  accent: '#b8380f',
  textMain: '#0e1813',
  textMuted: '#536159',
  border: '#e3dfd3',
  borderControl: '#7d8279',
  onPrimary: '#ffffff',
  glassBg: 'rgba(255, 253, 248, 0.66)',
  glassBgStrong: 'rgba(255, 253, 248, 0.9)',
  glassBorder: 'rgba(14, 24, 19, 0.08)',
  glassHighlight: 'rgba(255, 255, 255, 0.95)',
  // Semantic aliases kept for existing screens: the palette carries status in
  // its category inks rather than a separate traffic-light set.
  danger: '#b8380f',
  warning: '#7f5410',
  success: '#0d5c3c',
}

export const dark: Palette = {
  background: '#060a08',
  backgroundAlt: '#0a100d',
  surface: '#0d1411',
  surfaceRaised: '#131c18',
  primary: '#4fd59a',
  primaryHover: '#7be3b4',
  primaryGlow: '#34e0a1',
  secondary: '#7cc4ea',
  tertiary: '#e6bd6a',
  accent: '#ff7b5c',
  textMain: '#edf4ef',
  textMuted: '#8fa096',
  border: '#1c2621',
  borderControl: '#66746d',
  // Inverts. White on this emerald measures 1.9:1 and fails AA; the near-black
  // ground measures 10.7:1 and passes.
  onPrimary: '#060a08',
  glassBg: 'rgba(17, 26, 22, 0.58)',
  glassBgStrong: 'rgba(17, 26, 22, 0.84)',
  glassBorder: 'rgba(255, 255, 255, 0.07)',
  glassHighlight: 'rgba(255, 255, 255, 0.1)',
  danger: '#ff7b5c',
  warning: '#e6bd6a',
  success: '#4fd59a',
}

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light
}

/** Spacing scale, matching the web's xs/sm/md/lg/xl steps. */
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const

/**
 * Corner radii, mirroring the web scale. `sm` stays tight because anything
 * holding a metric still belongs in a square-ish cell.
 */
export const radius = { sm: 6, md: 10, lg: 16, xl: 22, full: 9999 } as const

/**
 * Blur intensity for expo-blur's `intensity` prop (0–100), standing in for the
 * web's 14px backdrop-filter. Not a pixel value — the native API is unitless.
 */
export const glassBlurIntensity = 40

/**
 * The motion contract, shared with the web: durations in ms and the two
 * easing curves. Reanimated takes the bezier control points directly, so the
 * curves are stored as tuples rather than CSS strings.
 */
export const motion = {
  micro: 120,
  standard: 220,
  entrance: 400,
  reveal: 700,
} as const

export const easing = {
  /** Entrances — the web's cubic-bezier(0.22, 1, 0.36, 1). */
  entrance: [0.22, 1, 0.36, 1],
  /** State changes — the web's cubic-bezier(0.4, 0, 0.2, 1). */
  state: [0.4, 0, 0.2, 1],
} as const

/**
 * Elevation, the four steps the web declares as --shadow-1..4. iOS reads the
 * shadow* fields and Android reads `elevation`, so both are supplied and the
 * caller just spreads the step it wants.
 */
export interface Elevation {
  shadowColor: string
  shadowOffset: { width: number; height: number }
  shadowOpacity: number
  shadowRadius: number
  elevation: number
}

function step(
  shadowColor: string,
  height: number,
  shadowOpacity: number,
  shadowRadius: number,
  elevation: number,
): Elevation {
  return { shadowColor, shadowOffset: { width: 0, height }, shadowOpacity, shadowRadius, elevation }
}

export const lightElevation = {
  1: step('#0c1410', 1, 0.06, 2, 1),
  2: step('#0c1410', 4, 0.1, 8, 3),
  3: step('#0c1410', 12, 0.14, 16, 6),
  4: step('#0c1410', 24, 0.18, 28, 12),
} as const

export const darkElevation = {
  1: step('#000000', 1, 0.3, 2, 1),
  2: step('#000000', 4, 0.45, 8, 3),
  3: step('#000000', 12, 0.6, 16, 6),
  4: step('#000000', 24, 0.7, 28, 12),
} as const

export function useElevation(): typeof lightElevation | typeof darkElevation {
  return useColorScheme() === 'dark' ? darkElevation : lightElevation
}

/**
 * System monospace for ledger metrics — the RN stand-in for the web's
 * font-mono. Deliberately not a bundled font package.
 */
export const monoFont: string = Platform.select({
  ios: 'Menlo',
  default: 'monospace',
})
