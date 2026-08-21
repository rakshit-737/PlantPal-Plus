import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Shell for the unauthenticated auth screens.
 *
 * Split layout on desktop: a brand rail on the left states what the account is
 * for, the form sits in a glass panel on the right. Below `lg` the rail is
 * dropped rather than stacked — on a phone it would push the form under the
 * fold, and someone who came here to sign in has already decided.
 */
function SproutMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-7 w-7 text-primary"
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

/** The three module nouns, in their inks — the same lockups the landing uses. */
const MODULES = [
  { label: 'Plant care', ink: 'text-primary' },
  { label: 'Fitness', ink: 'text-secondary' },
  { label: 'Nutrition', ink: 'text-tertiary' },
]

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="relative flex min-h-full">
      <div aria-hidden className="app-aurora pointer-events-none fixed inset-0 z-0" />

      <aside className="relative z-10 hidden w-1/2 flex-col justify-between border-r border-glass-border p-2xl lg:flex">
        <Link to="/" className="flex w-fit items-center gap-sm">
          <SproutMark />
          <span className="font-heading text-xl font-extrabold tracking-tight text-text-main">
            PlantPal+
          </span>
        </Link>

        <div>
          <p className="max-w-md font-heading text-4xl font-bold leading-tight tracking-[-0.02em] text-text-main">
            One ledger for your plants, workouts and meals.
          </p>
          <ul className="mt-xl flex flex-col gap-sm">
            {MODULES.map((m) => (
              <li key={m.label} className="flex items-center gap-sm text-base text-text-muted">
                <span aria-hidden className={`font-mono text-sm ${m.ink}`}>
                  —
                </span>
                {m.label}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-text-muted">
          Turn any module off in Settings. The rest carry on.
        </p>
      </aside>

      <div className="relative z-10 flex w-full flex-col items-center justify-center px-md py-2xl lg:w-1/2">
        <div className="w-full max-w-md">
          {/* The wordmark rides above the form only where the rail is hidden,
              so it never appears twice on one screen. */}
          <Link to="/" className="mb-xl flex w-fit items-center gap-sm lg:hidden">
            <SproutMark />
            <span className="font-heading text-xl font-extrabold tracking-tight text-text-main">
              PlantPal+
            </span>
          </Link>

          <div className="mb-xl">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-text-main">
              {title}
            </h1>
            <p className="mt-xs text-base text-text-muted">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
