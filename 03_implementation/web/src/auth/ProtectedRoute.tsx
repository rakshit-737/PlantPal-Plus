import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './AuthContext'

/** Gate for authenticated routes. Waits for the bootstrap refresh to resolve. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background">
        <p className="text-text-muted" role="status">
          Loading…
        </p>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Preserve where they were headed so we can return them after login.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
