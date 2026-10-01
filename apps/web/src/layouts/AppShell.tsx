import { motion } from 'motion/react'
import { Suspense, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Wordmark } from '../components/Brand'
import { ThemeToggle } from '../components/ThemeToggle'
import { Spinner } from '../components/ui'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { NAV_GROUPS, NAV_ITEMS } from '../navigation/navItems'
import { useSettings } from '../settings/SettingsContext'

/** The signed-in person's monogram: the first letter of their address. */
function Avatar({ email }: { email: string }) {
  const initial = (email.trim()[0] ?? '?').toUpperCase()
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary font-display text-[15px] font-semibold text-on-primary shadow-glow-primary"
    >
      {initial}
    </span>
  )
}

/**
 * The authenticated shell: a persistent glass sidebar on desktop, a top bar
 * and a floating tab dock on narrow viewports, per
 * docs/design/04-navigation-flow.md §3. Both navigations are driven by the
 * same NAV_ITEMS, so gating a module hides it everywhere at once.
 */
export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const reduced = useReducedMotion()
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
    // preventScroll: the sticky mobile top bar sits above <main>, so letting
    // focus scroll it into view would tuck the page's first line under the bar.
    mainRef.current?.focus({ preventScroll: true })
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
    <div className="relative flex min-h-full bg-background">
      {/* Decorative, and behind everything: the shell's own layers are given an
          explicit z-index rather than relying on paint order. */}
      <div aria-hidden className="app-aurora pointer-events-none fixed inset-0 z-0" />
      <div aria-hidden className="app-grain pointer-events-none fixed inset-0 z-0" />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-md focus:top-md focus:z-[70] focus:rounded-md focus:border focus:border-border-control focus:bg-surface-raised focus:px-md focus:py-sm focus:text-sm focus:font-medium focus:text-text-main focus:shadow-3"
      >
        Skip to content
      </a>

      {/* ------------------------------------------------ desktop sidebar */}
      <aside className="sticky top-0 z-20 hidden h-screen w-[268px] shrink-0 flex-col border-r border-glass-border bg-glass px-md pb-md pt-lg backdrop-blur-glass md:flex">
        <NavLink to="/dashboard" className="mb-xl flex w-fit items-center rounded-md px-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Wordmark size="sm" />
        </NavLink>

        <nav className="flex flex-1 flex-col gap-lg overflow-y-auto" aria-label="Primary">
          {NAV_GROUPS.map((group) => {
            const items = visibleItems.filter((item) => item.group === group.key)
            if (items.length === 0) return null
            return (
              <div key={group.key} className="flex flex-col gap-[2px]">
                <p aria-hidden className="eyebrow mb-xs px-sm !text-[10px]">
                  {group.label}
                </p>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `group relative flex h-10 items-center gap-[12px] rounded-md px-sm text-[14px] font-medium transition-colors duration-standard ease-state focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive ? 'text-text-main' : 'text-text-muted hover:text-text-main'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive ? (
                          // One lit pill that glides between items, rather than
                          // each item fading its own background in and out.
                          <motion.span
                            layoutId="sidebar-active"
                            aria-hidden
                            className="absolute inset-0 rounded-md border border-glass-border bg-surface-raised/80 shadow-2"
                            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }}
                          />
                        ) : (
                          <span aria-hidden className="absolute inset-0 rounded-md bg-text-main/0 transition-colors duration-standard group-hover:bg-text-main/[0.04]" />
                        )}
                        <span className={`relative ${isActive ? 'text-primary' : ''}`}>{item.icon}</span>
                        <span className="relative">{item.label}</span>
                        {isActive ? (
                          <span aria-hidden className="relative ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-glow-primary" />
                        ) : null}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="mt-md rounded-lg border border-glass-border bg-surface/50 p-sm">
          <div className="flex items-center gap-sm">
            {user ? <Avatar email={user.email} /> : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-text-main" title={user?.email}>
                {user?.email.split('@')[0] ?? 'Signed in'}
              </p>
              {user ? (
                <p className="truncate text-xs text-text-muted" title={user.email}>
                  {user.email}
                </p>
              ) : null}
            </div>
            <ThemeToggle className="h-9 w-9" />
          </div>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="mt-sm flex h-9 w-full items-center justify-center gap-sm rounded-md border border-border-control/70 text-[13px] font-medium text-text-muted transition-colors duration-standard ease-state hover:border-text-muted hover:bg-text-main/[0.04] hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4.5h3.5a2 2 0 012 2v11a2 2 0 01-2 2H14M10 16l4-4-4-4M14 12H4.5" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* -------------------------------------------- mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-glass-border bg-glass-strong px-md py-sm backdrop-blur-glass md:hidden">
          <NavLink to="/dashboard" className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Wordmark size="sm" />
          </NavLink>
          <div className="flex items-center gap-sm">
            <ThemeToggle className="h-9 w-9" />
            <button
              type="button"
              onClick={() => void onLogout()}
              aria-label="Sign out"
              className="grid h-9 w-9 place-items-center rounded-full border border-glass-border bg-glass text-text-muted shadow-1 transition-colors duration-standard hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4.5h3.5a2 2 0 012 2v11a2 2 0 01-2 2H14M10 16l4-4-4-4M14 12H4.5" />
              </svg>
            </button>
          </div>
        </header>

        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className="relative flex-1 px-md pb-[calc(112px+env(safe-area-inset-bottom))] pt-lg outline-none sm:px-lg md:px-xl md:pb-2xl md:pt-xl lg:px-2xl"
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
            {/* Each route grows in on arrival — opacity and a few pixels of
                rise, never a sideways slide. */}
            <motion.div
              key={location.pathname}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </Suspense>
        </main>
      </div>

      {/*
        Mobile: a floating dock mirrors the sidebar (same NAV_ITEMS). Full-width
        thumb targets, inset from the screen edge so it reads as an object
        rather than a toolbar welded to the bottom.
      */}
      <nav
        className="fixed inset-x-sm bottom-[calc(10px+env(safe-area-inset-bottom))] z-40 flex overflow-x-auto rounded-xl border border-glass-border bg-glass-strong p-[6px] shadow-4 backdrop-blur-glass [scrollbar-width:none] md:hidden"
        aria-label="Primary"
      >
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `relative flex min-w-0 flex-auto flex-col items-center gap-[3px] rounded-lg px-[6px] py-[7px] text-[10px] font-medium transition-colors duration-standard ease-state focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                isActive ? 'text-primary' : 'text-text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <motion.span
                    layoutId="dock-active"
                    aria-hidden
                    className="absolute inset-0 rounded-lg bg-primary/10"
                    transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }}
                  />
                ) : null}
                <span className="relative">{item.icon}</span>
                <span className="relative whitespace-nowrap">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
