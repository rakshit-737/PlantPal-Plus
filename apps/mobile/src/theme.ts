/**
 * Design tokens — the React Native mirror of apps/web/src/index.css, per
 * docs/design/01-design-language.md. Values must stay in lock-step with the
 * web token set so the two clients read as one product.
 */

import { useColorScheme } from 'react-native'

export interface Palette {
  background: string
  surface: string
  primary: string
  primaryHover: string
  secondary: string
  textMain: string
  textMuted: string
  border: string
  danger: string
  warning: string
  success: string
}

export const light: Palette = {
  background: '#f9fafb',
  surface: '#ffffff',
  primary: '#10b981',
  primaryHover: '#059669',
  secondary: '#3b82f6',
  textMain: '#1f2937',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
}

export const dark: Palette = {
  background: '#111827',
  surface: '#1f2937',
  primary: '#34d399',
  primaryHover: '#10b981',
  secondary: '#60a5fa',
  textMain: '#f9fafb',
  textMuted: '#9ca3af',
  border: '#374151',
  danger: '#f87171',
  warning: '#fbbf24',
  success: '#34d399',
}

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light
}

/** Spacing scale, matching the web's xs/sm/md/lg/xl steps. */
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const
