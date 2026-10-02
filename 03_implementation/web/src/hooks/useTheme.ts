/**
 * Theme (light/dark) with system-preference default and localStorage persistence.
 * Writes data-theme onto <html>, which is what index.css keys its token set on.
 *
 * Multiple components mount this hook (the shell and the settings page), so a
 * toggle broadcasts a custom event and every instance follows it — otherwise
 * each copy holds its own useState and they drift out of step.
 *
 * Server sync (settings.theme: LIGHT | DARK | SYSTEM). Precedence, simplest
 * rule that stays predictable:
 *  1. A toggle made in this browser session wins — the server value never
 *     overrides an explicit local choice mid-session.
 *  2. Otherwise the server theme applies whenever settings load; SYSTEM
 *     resolves against the OS preference at load time.
 *  3. toggle() persists LIGHT/DARK to PUT /v1/settings best-effort. The local
 *     theme is already applied, so a failed write costs nothing visible and
 *     reconciles on the next settings load.
 */
import { useCallback, useEffect, useState } from 'react'

import { getAccessToken } from '../lib/apiClient'
import { updateSettings } from '../lib/settingsApi'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'plantpal-theme'
const CHANGE_EVENT = 'plantpal-theme-change'

// Flips true on the first explicit toggle in this tab; from then on the
// server-stored theme stops overriding until the next full page load.
let sessionOverride = false

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return systemTheme()
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(STORAGE_KEY, theme)
}

function broadcast(next: Theme) {
  window.dispatchEvent(new CustomEvent<Theme>(CHANGE_EVENT, { detail: next }))
}

/**
 * Apply the server-stored theme after settings load — unless the user has
 * already toggled this session, in which case local intent wins. App.tsx keeps
 * one hook instance (ThemeBoot) mounted at the root, so the broadcast always
 * has a listener whose effect applies and persists the change.
 */
export function applyServerTheme(server: string): void {
  if (sessionOverride) return
  const next: Theme | null =
    server === 'DARK'
      ? 'dark'
      : server === 'LIGHT'
        ? 'light'
        : server === 'SYSTEM'
          ? systemTheme()
          : null
  if (!next) return
  broadcast(next)
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Follow toggles made by other instances of this hook.
  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<Theme>).detail
      if (next === 'light' || next === 'dark') setTheme(next)
    }
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    sessionOverride = true
    // Every instance (including this one) follows the broadcast.
    broadcast(next)
    // Persist the explicit choice server-side. Guarded on an access token so
    // an unauthenticated mount can never fire a doomed request.
    if (getAccessToken()) {
      void updateSettings({ theme: next === 'dark' ? 'DARK' : 'LIGHT' }).catch(() => {})
    }
  }, [theme])

  return { theme, toggle }
}
