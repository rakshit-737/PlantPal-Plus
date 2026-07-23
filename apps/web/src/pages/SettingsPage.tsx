import { useEffect, useState } from 'react'
import { Card, Spinner, EmptyState, PageHeader, Button, Input, Alert } from '../components/ui'
import { useAuth } from '../auth/AuthContext'

export function SettingsPage() {
  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-xl">
        <PageHeader title="Settings" subtitle="Account and preferences." />
      </div>

      <div className="flex flex-col gap-md">
        <Card>
          <p className="mb-sm text-sm font-medium text-text-muted">Account</p>
          <p className="text-text-main">{user?.email ?? '—'}</p>
        </Card>

        <Card>
          <p className="mb-md text-sm font-medium text-text-muted">Session</p>
          <Button variant="secondary" loading={loggingOut} onClick={handleLogout}>
            Sign out
          </Button>
        </Card>
      </div>
    </div>
  )
}
