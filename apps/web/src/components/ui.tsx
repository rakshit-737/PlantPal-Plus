/**
 * Base UI primitives — the web side of docs/design/02-component-inventory.md.
 * Deliberately dependency-free (no component library) so the design tokens stay
 * the single source of styling truth.
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { forwardRef, useEffect, useId } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary',
  secondary:
    'bg-surface text-text-main border border-border hover:bg-background focus-visible:ring-secondary',
  ghost: 'bg-transparent text-text-muted hover:text-text-main hover:bg-surface',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-sm rounded-md px-md py-sm text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 ${buttonVariants[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | undefined
  hint?: string | undefined
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className = '', ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-')
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={inputId} className="text-sm font-medium text-text-main">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`rounded-md border bg-surface px-md py-sm text-base text-text-main placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${error ? 'border-accent' : 'border-border'} ${className}`}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-accent">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface p-lg shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}

/** A dismissible inline notice used for form-level auth errors and successes. */
export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success' | 'info'
  children: ReactNode
}) {
  const tones = {
    error: 'border-accent/40 bg-accent/10 text-accent',
    success: 'border-primary/40 bg-primary/10 text-primary-hover',
    info: 'border-secondary/40 bg-secondary/10 text-secondary',
  }
  return (
    <div role="alert" className={`rounded-md border px-md py-sm text-sm ${tones[tone]}`}>
      {children}
    </div>
  )
}

/** A border-based CSS spinner for inline and full-panel loading states. */
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' }
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block rounded-full border-2 border-border border-t-primary animate-spin ${sizes[size]}`}
    />
  )
}

type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'info'

/** A small pill for statuses, tiers and counts. */
export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: BadgeTone
}) {
  const tones: Record<BadgeTone, string> = {
    default: 'bg-background text-text-muted border-border',
    success: 'bg-primary/10 text-primary-hover border-primary/40',
    warning: 'bg-tertiary/10 text-tertiary border-tertiary/40',
    danger: 'bg-accent/10 text-accent border-accent/40',
    info: 'bg-secondary/10 text-secondary border-secondary/40',
  }
  return (
    <span
      className={`inline-flex items-center gap-xs rounded-full border px-sm py-xs text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

type ProgressTone = 'primary' | 'secondary' | 'tertiary'

/** An accessible linear progress bar with an optional label + value read-out. */
export function Progress({
  value,
  max,
  label,
  tone = 'primary',
}: {
  value: number
  max: number
  label?: string
  tone?: ProgressTone
}) {
  const fills: Record<ProgressTone, string> = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    tertiary: 'bg-tertiary',
  }
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="flex flex-col gap-xs">
      {label ? (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>{label}</span>
          <span>
            {value} / {max}
          </span>
        </div>
      ) : null}
      <div className="h-2 w-full overflow-hidden rounded-full bg-background">
        <div
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
          className={`h-full rounded-full transition-all ${fills[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** A centered placeholder for empty lists and zero-state screens. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-sm px-lg py-lg text-center">
      {icon ? <div className="text-text-muted">{icon}</div> : null}
      <h3 className="text-base font-semibold text-text-main">{title}</h3>
      {body ? <p className="max-w-sm text-sm text-text-muted">{body}</p> : null}
      {action ? <div className="mt-sm">{action}</div> : null}
    </div>
  )
}

/** An accessible dialog with a backdrop and centered panel. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-lg border border-border bg-surface p-lg shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        <h2 id={titleId} className="mb-md text-lg font-semibold text-text-main">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}

/** A dashboard stat tile — matches the local StatCard in DashboardPage. */
export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub: string
  accent: string
}) {
  return (
    <Card>
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <p className={`mt-xs font-heading text-3xl font-bold ${accent}`}>{value}</p>
      <p className="mt-xs text-sm text-text-muted">{sub}</p>
    </Card>
  )
}

/** A consistent page header with an optional subtitle and right-side action slot. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-md">
      <div>
        <h1 className="text-2xl font-bold text-text-main">{title}</h1>
        {subtitle ? <p className="mt-xs text-sm text-text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
