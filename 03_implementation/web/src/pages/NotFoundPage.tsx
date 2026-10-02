import { Link } from 'react-router-dom'

import { usePageTitle } from '../hooks/usePageTitle'

/** Standalone 404 — reachable both signed in and out, so it carries no shell. */
export function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <main className="relative flex min-h-full flex-col items-center justify-center gap-sm px-lg py-2xl text-center">
      <div aria-hidden className="app-aurora pointer-events-none fixed inset-0 z-0" />
      <div className="relative z-10 flex flex-col items-center gap-sm">
        {/* The status code as a ledger figure. A 404 is a number, and this app
            renders numbers in mono. */}
        <p aria-hidden className="font-mono text-6xl font-semibold tracking-tight text-primary">
          404
        </p>
        <h1 className="font-heading text-[32px] font-bold tracking-tight text-text-main">
          Not in the ledger.
        </h1>
        <p className="max-w-sm text-sm text-text-muted">
          This page doesn't exist — the address may be mistyped or the entry moved.
        </p>
        {/*
          "/" resolves correctly for either visitor: signed in it forwards to
          the dashboard, signed out it lands on the public page. So the label
          stays neutral rather than promising a dashboard a stranger cannot see.
        */}
        <Link
          to="/"
          className="mt-md inline-flex items-center rounded-md bg-primary px-md py-sm text-sm font-semibold text-on-primary shadow-glow-primary transition-colors duration-standard ease-state hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Back to PlantPal+
        </Link>
      </div>
    </main>
  )
}
