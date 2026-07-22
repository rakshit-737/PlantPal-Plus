/**
 * Authentication state for the web app.
 *
 * The access token is memory-only (see apiClient), so on a hard reload we have
 * no token but may still hold a valid httpOnly refresh cookie. `bootstrap` runs
 * once on mount and exchanges that cookie for a fresh access token if possible,
 * which is why the app shows a loading state before deciding logged-in vs -out.
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

import { setAccessToken } from '../lib/apiClient'
import {
  login as loginApi,
  logout as logoutApi,
  refreshSession,
  type AuthUser,
  type LoginResponse,
} from '../lib/authApi'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  /** True until the initial refresh-cookie bootstrap resolves. */
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
      const session = await refreshSession()
      if (cancelled) return
      if (session) {
        setAccessToken(session.access_token)
        setIsAuthenticated(true)
      }
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginApi(email, password)
    setAccessToken(res.access_token)
    setUser(res.user)
    setIsAuthenticated(true)
    return res
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutApi()
    } finally {
      setAccessToken(null)
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
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
