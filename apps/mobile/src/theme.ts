/**
 * Design tokens — the React Native mirror of apps/web/src/index.css, per
 * docs/design/01-design-language.md. "Field notebook" direction: a gardener's
 * ledger — green-tinted ink on paper white, one deep leaf accent, sharp
 * corners, hairline borders, metrics in mono. Values must stay in lock-step
 * with the web token set so the two clients read as one product.
 */

import { Platform, useColorScheme } from 'react-native'

export interface Palette {
  background: string
  surface: string
  primary: string
  primaryHover: string
  secondary: string
  tertiary: string
  accent: string
  textMain: string
  textMuted: string
  border: string
  /** Text placed on a solid primary fill. */
  onPrimary: string
  danger: string
  warning: string
  success: string
}

export const light: Palette = {
  background: '#f6f7f4',
  surface: '#ffffff',
  primary: '#226d3c',
  primaryHover: '#1a5530',
  secondary: '#38708f',
  tertiary: '#9a6b0f',
  accent: '#b3402e',
  textMain: '#1b241e',
  textMuted: '#5d6a61',
  border: '#dce1da',
  onPrimary: '#ffffff',
  // Semantic aliases kept for existing screens: the notebook palette carries
  // status in its accent inks rather than a separate traffic-light set.
  danger: '#b3402e',
  warning: '#9a6b0f',
  success: '#226d3c',
}

export const dark: Palette = {
  background: '#0b0e0c',
  surface: '#141815',
  primary: '#46a96c',
  primaryHover: '#5fbf80',
  secondary: '#6fa7c7',
  tertiary: '#c99a3c',
  accent: '#d96c57',
  textMain: '#ecf0ec',
  textMuted: '#8b968d',
  border: '#242a25',
  onPrimary: '#0b0e0c',
  danger: '#d96c57',
  warning: '#c99a3c',
  success: '#46a96c',
}

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light
}

/** Spacing scale, matching the web's xs/sm/md/lg/xl steps. */
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const

/**
 * System monospace for ledger metrics — the RN stand-in for the web's
 * font-mono. Deliberately not a bundled font package.
 */
export const monoFont: string = Platform.select({
  ios: 'Menlo',
  default: 'monospace',
})
