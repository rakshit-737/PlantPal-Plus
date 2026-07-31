import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { applyServerTheme } from '../hooks/useTheme'
import { getSettings, updateSettings, type UserSettings } from '../lib/settingsApi'

interface SettingsContextValue {
  settings: UserSettings | null
  /** True while the initial load (or a retry) is in flight. */
  loading: boolean
  /** True when the last load failed — pair with `reload` for an ErrorState. */
  loadError: boolean
  reload: () => void
  /** Optimistically applies the patch, rolls back if the server rejects it. */
  update: (patch: Partial<UserSettings>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  loading: true,
  loadError: false,
  reload: () => {},
  update: async () => {},
})

/**
 * Loads the user's settings once inside the authenticated shell and shares
 * them app-wide — AppShell reads module toggles for nav gating, SettingsPage
 * writes them. Until the fetch resolves, `settings` is null and consumers
 * treat every module as enabled (fail-open keeps navigation usable offline).
 * A failed load is surfaced via `loadError` + `reload` so pages can show a
 * retryable error state instead of silently rendering defaults.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    getSettings()
      .then((s) => {
        setSettings(s)
        // Server-stored theme applies on load unless the user toggled locally
        // this session — useTheme documents the precedence.
        applyServerTheme(s.theme)
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // The in-app accessibility settings act through root attributes, mirroring
  // the data-theme mechanism — index.css keys rules on these.
  useEffect(() => {
    const root = document.documentElement
    root.toggleAttribute('data-reduce-motion', !!settings?.reduce_motion)
    root.toggleAttribute('data-larger-text', !!settings?.larger_text)
    root.toggleAttribute('data-high-contrast', !!settings?.high_contrast)
  }, [settings])

  const update = useCallback(async (patch: Partial<UserSettings>) => {
    let snapshot: UserSettings | null = null
    setSettings((current) => {
      snapshot = current
      return current ? { ...current, ...patch } : current
    })
    const keys = Object.keys(patch) as (keyof UserSettings)[]
    try {
      const saved = await updateSettings(patch)
      // Merge only the fields this call touched: two overlapping saves must
      // not overwrite each other's optimistic state with a stale full row.
      setSettings((current) => {
        if (!current) return saved
        const merged = { ...current }
        for (const k of keys) (merged as Record<string, unknown>)[k] = saved[k]
        return merged
      })
    } catch (err) {
      // Roll back only the fields this call touched, for the same reason.
      setSettings((current) => {
        if (!current || !snapshot) return snapshot
        const reverted = { ...current }
        for (const k of keys) (reverted as Record<string, unknown>)[k] = (snapshot as UserSettings)[k]
        return reverted
      })
      throw err
    }
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, loading, loadError, reload, update }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
