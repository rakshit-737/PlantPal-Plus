import { Suspense, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Button, Spinner } from '../components/ui'
import { useTheme } from '../hooks/useTheme'
import { NAV_ITEMS } from '../navigation/navItems'
import { useSettings } from '../settings/SettingsContext'

/** The wordmark's sprout, drawn in the same stroke style as the nav icons. */
function SproutMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-6 w-6 text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
    >
      <path d="M12 21v-8" />
      <path d="M12 13c0-3.5-2.5-6-6-6 0 3.5 2.5 6 6 6Z" />
      <path d="M12 10c0-3 2-5.5 5.5-5.5 0 3-2 5.5-5.5 5.5" />
    </svg>
  )
}

/**
 * The authenticated shell: persistent left sidebar on desktop, bottom tab bar
 * on narrow viewports, per docs/design/04-navigation-flow.md §3. Both are
 * driven by the same NAV_ITEMS.
 */
export function AppShell() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // Route changes move focus to the content region so keyboard and screen-reader
  // users land on the new page, not wherever the old page left them — and reset
  // scroll, since the document (not <main>) is the scroll container here.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo(0, 0)
    mainRef.current?.focus()
  }, [location.pathname])

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  // Module gating: the plant care/fitness/nutrition tabs hide when the user
  // disables them in Settings. While settings load (null), everything stays
  // visible — fail-open. The server's Invariant 34 refuses a state with every
  // module off, so this can never empty the navigation.
  const { settings } = useSettings()
  const enabledModules = {
    plant_care: settings?.plant_care_enabled ?? true,
    fitness: settings?.fitness_enabled ?? true,
    nutrition: settings?.nutrition_enabled ?? true,
  }
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.module || enabledModules[item.module],
  )

  return (
    <div className="flex min-h-full bg-background">
      {/* Decorative, and behind everything: the shell's own layers are given an
          explicit z-index rather than relying on paint order. */}
      <div aria-hidden className="app-aurora pointer-events-none fixed inset-0 z-0" />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-md focus:top-md focus:z-[70] focus:rounded-md focus:border focus:border-border-control focus:bg-surface-raised focus:px-md focus:py-sm focus:text-sm focus:font-medium focus:text-text-main focus:shadow-3"
      >
        Skip to content
      </a>

      <aside className="relative z-10 hidden w-64 shrink-0 flex-col border-r border-glass-border bg-glass p-md backdrop-blur-glass md:flex">
        <div className="mb-sm flex items-center gap-sm px-sm">
          <SproutMark />
          <span className="font-heading text-xl font-extrabold tracking-tight text-text-main">
            PlantPal+
          </span>
        </div>
        <p className="mb-xl px-sm text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
          Daily care ledger
        </p>
        <nav className="flex flex-1 flex-col gap-xs" aria-label="Primary">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              // Active is lit rather than inverted: v2.0 stamped the current
              // item as a solid ink block, which in a glass world reads as a
              // hole punched through the pane. Light behind the glass instead.
              className={({ isActive }) =>
                `flex items-center gap-sm rounded-md px-md py-sm text-sm font-medium transition-[background-color,color,box-shadow] duration-standard ease-state focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? 'bg-primary/15 text-text-main shadow-glow-primary'
                    : 'text-text-muted hover:bg-primary/10 hover:text-text-main'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-lg flex flex-col gap-sm border-t border-glass-border pt-md">
          <Button variant="ghost" onClick={toggle} className="justify-start">
            {theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
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

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="relative z-10 flex-1 overflow-y-auto p-lg pb-[calc(84px+env(safe-area-inset-bottom))] outline-none md:p-xl md:pb-xl"
      >
        {/*
          The boundary sits inside <main>, not around the router, so a
          code-split route loads without the shell unmounting and reappearing.
          Focus has already moved here by then, so the spinner is what the user
          is pointed at.
        */}
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center">
              <Spinner size="lg" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      {/*
        Mobile: bottom tab bar mirrors the sidebar (same NAV_ITEMS). Kept as a
        tab bar rather than becoming a floating dock — the dock's whole idea is
        cursor-proximity magnification, which does not exist on touch, and it
        would trade a full-width thumb target for a smaller centred one.
      */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-glass-border bg-glass-strong pb-[env(safe-area-inset-bottom)] backdrop-blur-glass md:hidden"
        aria-label="Primary"
      >
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-[2px] py-sm text-[10px] font-medium transition-colors duration-standard ease-state focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                isActive ? 'text-primary' : 'text-text-muted'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
