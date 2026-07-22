import { type ReactNode } from 'react'

/** Centered, single-column shell for the unauthenticated auth screens. */
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
    <div className="flex min-h-full items-center justify-center bg-background px-md py-2xl">
      <div className="w-full max-w-md">
        <div className="mb-xl text-center">
          <div className="mb-sm text-4xl" aria-hidden>
            🌱
          </div>
          <h1 className="font-heading text-3xl font-bold text-text-main">{title}</h1>
          <p className="mt-xs text-base text-text-muted">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
