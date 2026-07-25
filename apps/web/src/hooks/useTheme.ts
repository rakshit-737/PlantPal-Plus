/**
 * Theme (light/dark) with system-preference default and localStorage persistence.
 * Writes data-theme onto <html>, which is what index.css keys its token set on.
 *
 * Multiple components mount this hook (the shell and the settings page), so a
 * toggle broadcasts a custom event and every instance follows it — otherwise
 * each copy holds its own useState and they drift out of step.
 */
import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'plantpal-theme'
const CHANGE_EVENT = 'plantpal-theme-change'

function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(STORAGE_KEY, theme)
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
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light'
      window.dispatchEvent(new CustomEvent<Theme>(CHANGE_EVENT, { detail: next }))
      return next
    })
  }, [])

  return { theme, toggle }
}
