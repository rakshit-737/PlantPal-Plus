import { Link } from 'react-router-dom'

import { usePageTitle } from '../hooks/usePageTitle'

/** Standalone 404 — reachable both signed in and out, so it carries no shell. */
export function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-sm bg-background px-lg py-2xl text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
        Page not found
      </p>
      <h1 className="font-heading text-[32px] font-bold tracking-tight text-text-main">
        Not in the ledger.
      </h1>
      <p className="max-w-sm text-sm text-text-muted">
        This page doesn't exist — the address may be mistyped or the entry moved.
      </p>
      <Link
        to="/"
        className="mt-md inline-flex items-center rounded-sm bg-primary px-md py-sm text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Back to the dashboard
      </Link>
    </main>
  )
}
