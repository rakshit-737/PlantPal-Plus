/**
 * Authentication state — the mobile mirror of apps/web/src/auth/AuthContext.tsx.
 * Bootstraps from the keystore-held refresh token so a reopened app signs in
 * silently; the user object is only populated after an explicit login (the
 * refresh endpoint returns tokens, not a profile).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { trySilentSignIn } from '../api/client'
import { login as loginApi, logout as logoutApi, type AuthUser, type LoginResponse } from '../api/endpoints'
import { registerForPushReminders } from '../notifications'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  /** True until the initial keystore bootstrap resolves. */
  isLoading: boolean
  login: (email: string, password: string) => Promise<LoginResponse>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ok = await trySilentSignIn()
      if (cancelled) return
      setIsAuthenticated(ok)
      setIsLoading(false)
      // FR-NOT-14: re-register the push token on every authenticated cold start.
      if (ok) void registerForPushReminders()
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginApi(email, password)
    setUser(res.user)
    setIsAuthenticated(true)
    void registerForPushReminders()
    return res
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutApi()
    } finally {
      setUser(null)
      setIsAuthenticated(false)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated, isLoading, login, logout }),
    [user, isAuthenticated, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
