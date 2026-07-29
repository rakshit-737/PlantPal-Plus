import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { getSettings, updateSettings, type UserSettings } from '../lib/settingsApi'

interface SettingsContextValue {
  settings: UserSettings | null
  /** Optimistically applies the patch, rolls back if the server rejects it. */
  update: (patch: Partial<UserSettings>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  update: async () => {},
})

/**
 * Loads the user's settings once inside the authenticated shell and shares
 * them app-wide — AppShell reads module toggles for nav gating, SettingsPage
 * writes them. Until the fetch resolves, `settings` is null and consumers
 * treat every module as enabled (fail-open keeps navigation usable offline).
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null)

  useEffect(() => {
    let cancelled = false
    getSettings()
      .then((s) => { if (!cancelled) setSettings(s) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const update = useCallback(async (patch: Partial<UserSettings>) => {
    let previous: UserSettings | null = null
    setSettings((current) => {
      previous = current
      return current ? { ...current, ...patch } : current
    })
    try {
      const saved = await updateSettings(patch)
      setSettings(saved)
    } catch (err) {
      setSettings(previous)
      throw err
    }
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
