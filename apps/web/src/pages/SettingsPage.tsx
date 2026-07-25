import { useState } from 'react'
import { Card, PageHeader, Button, Badge } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../hooks/useTheme'

const STATUS_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  ACTIVE: 'success',
  PENDING_VERIFICATION: 'info',
  LOCKED: 'danger',
  PENDING_DELETION: 'warning',
}

export function SettingsPage() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
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
          <div className="flex items-center justify-between">
            <p className="text-text-main">{user?.email ?? '—'}</p>
            {user && (
              <Badge tone={STATUS_TONE[user.status] ?? 'default'}>
                {user.status.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        </Card>

        <Card>
          <p className="mb-sm text-sm font-medium text-text-muted">Appearance</p>
          <div className="flex items-center justify-between">
            <p className="text-text-main">Theme: {theme === 'dark' ? 'Dark' : 'Light'}</p>
            <Button variant="secondary" onClick={toggle}>
              Switch to {theme === 'dark' ? 'light' : 'dark'}
            </Button>
          </div>
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
