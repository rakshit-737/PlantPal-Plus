import { Card } from '../components/ui'

/**
 * Placeholder for a feature module not yet built. Keeps routing and navigation
 * fully functional so the shell can be developed and reviewed ahead of the
 * backend endpoints. Replace each with its real page as modules land.
 */
export function PlaceholderPage({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-xl">
        <h1 className="font-heading text-3xl font-bold text-text-main">{title}</h1>
        <p className="mt-xs text-text-muted">{blurb}</p>
      </header>
      <Card>
        <p className="text-text-muted">
          This section is coming soon. The screen is scaffolded so navigation and layout are
          testable before the backend module is connected.
        </p>
      </Card>
    </div>
  )
}
