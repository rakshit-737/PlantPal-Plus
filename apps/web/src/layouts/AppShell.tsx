import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui'
import { useTheme } from '../hooks/useTheme'
import { NAV_ITEMS } from '../navigation/navItems'

/**
 * The authenticated shell: persistent left sidebar on desktop, per
 * docs/design/04-navigation-flow.md §3. A responsive bottom bar for narrow
 * viewports can be layered on later; the same NAV_ITEMS drive both.
 */
export function AppShell() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  // Module gating: fitness/nutrition tabs are hidden if the user disabled them.
  // Until we load real settings, all modules are considered enabled.
  const enabledModules = { fitness: true, nutrition: true }
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.module || enabledModules[item.module],
  )

  return (
    <div className="flex min-h-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface p-md md:flex">
        <div className="mb-xl flex items-center gap-sm px-sm">
          <span className="text-2xl" aria-hidden>
            🌱
          </span>
          <span className="font-heading text-xl font-bold text-text-main">PlantPal+</span>
        </div>
        <nav className="flex flex-1 flex-col gap-xs" aria-label="Primary">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-sm rounded-md px-md py-sm text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary-hover'
                    : 'text-text-muted hover:bg-background hover:text-text-main'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-lg flex flex-col gap-sm border-t border-border pt-md">
          <Button variant="ghost" onClick={toggle} className="justify-start">
            {theme === 'light' ? '🌙 Dark mode' : '☀️ Light mode'}
          </Button>
          {user ? (
            <p className="truncate px-md text-xs text-text-muted" title={user.email}>
              {user.email}
            </p>
          ) : null}
          <Button variant="secondary" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-lg md:p-xl">
        <Outlet />
      </main>
    </div>
  )
}
