/**
 * Base UI primitives — the web side of docs/design/02-component-inventory.md.
 * Deliberately dependency-free (no component library) so the design tokens stay
 * the single source of styling truth.
 *
 * Field-notebook rules: sharp corners (rounded-sm/md only), hairline borders
 * instead of shadows, uppercase letterspaced eyebrows for labels, and every
 * metric in font-mono so numbers line up like ledger entries.
 */
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-hover focus-visible:ring-primary',
  secondary:
    'bg-surface text-text-main border border-border hover:border-text-muted focus-visible:ring-primary',
  ghost:
    'bg-transparent text-text-muted hover:text-text-main hover:bg-surface focus-visible:ring-primary',
  danger:
    'bg-transparent text-accent border border-accent/40 hover:bg-accent/10 focus-visible:ring-accent',
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
      className={`inline-flex items-center justify-center gap-sm rounded-sm px-md py-sm text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 ${buttonVariants[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {/* The label stays mounted while loading so the button never changes width. */}
      {loading ? (
        <span
          aria-hidden
          className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
        />
      ) : null}
      {children}
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
      <label htmlFor={inputId} className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`rounded-sm border bg-surface px-md py-sm text-base text-text-main placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${error ? 'border-accent' : 'border-border'} ${className}`}
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

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string | undefined
  hint?: string | undefined
}

/** A labelled native select, styled to match Input. Native = keyboard + SR free. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, id, className = '', children, ...rest },
  ref,
) {
  const selectId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-')
  const describedBy = error
    ? `${selectId}-error`
    : hint
      ? `${selectId}-hint`
      : undefined
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={selectId} className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full appearance-none rounded-sm border bg-surface px-md py-sm pr-xl text-base text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${error ? 'border-accent' : 'border-border'} ${className}`}
          {...rest}
        >
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="pointer-events-none absolute right-sm top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="square" />
        </svg>
      </div>
      {error ? (
        <p id={`${selectId}-error`} className="text-sm text-accent">
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

export interface ComboOption {
  id: string
  label: string
  /** A quiet mono second line — species latin name, food macros, MET value. */
  sub?: string
}

/**
 * An accessible autocomplete. The parent owns the query text and the option
 * list (so debounced fetching stays where the data lives); this component owns
 * open state, keyboard navigation and ARIA wiring.
 *
 * Selection contract: onSelect fires with the picked option; the parent should
 * then set `query` to the option's label. Editing the text afterwards calls
 * onSelect(null) so a stale id can never ride along under newer text.
 */
export function Combobox({
  label,
  query,
  onQueryChange,
  options,
  onSelect,
  placeholder,
  loading = false,
  error,
  hint,
  emptyText = 'No matches',
}: {
  label: string
  query: string
  onQueryChange: (q: string) => void
  options: ComboOption[]
  onSelect: (option: ComboOption | null) => void
  placeholder?: string
  loading?: boolean
  error?: string | undefined
  hint?: string | undefined
  emptyText?: string
}) {
  const baseId = useId()
  const inputId = `${baseId}-input`
  const listId = `${baseId}-list`
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    setActiveIndex(options.length > 0 ? 0 : -1)
  }, [options])

  const pick = useCallback(
    (option: ComboOption) => {
      onSelect(option)
      setOpen(false)
    },
    [onSelect],
  )

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActiveIndex((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && options[activeIndex]) {
        e.preventDefault()
        pick(options[activeIndex])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.stopPropagation()
        setOpen(false)
      }
    }
  }

  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
  const showList = open && (options.length > 0 || (!loading && query.trim().length > 0))

  return (
    <div
      className="flex flex-col gap-xs"
      ref={rootRef}
      onBlur={(e) => {
        // Close when focus leaves the whole widget (Tab to the next field),
        // so the listbox never covers the control the user just moved to.
        if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <label htmlFor={inputId} className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && activeIndex >= 0 && options[activeIndex]
              ? `${listId}-${activeIndex}`
              : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value)
            onSelect(null)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={`w-full rounded-sm border bg-surface px-md py-sm text-base text-text-main placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${error ? 'border-accent' : 'border-border'}`}
        />
        {loading ? (
          <span className="absolute right-sm top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </span>
        ) : null}
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute z-30 mt-xs max-h-56 w-full overflow-y-auto rounded-sm border border-border bg-surface py-xs"
          >
            {options.length === 0 ? (
              <li className="px-md py-sm text-sm text-text-muted" aria-disabled>
                {emptyText}
              </li>
            ) : (
              options.map((option, i) => (
                <li
                  key={option.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(option)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`cursor-pointer px-md py-sm text-sm ${
                    i === activeIndex
                      ? 'bg-primary/10 text-text-main'
                      : 'text-text-main hover:bg-background'
                  }`}
                >
                  <span className="block">{option.label}</span>
                  {option.sub ? (
                    <span className="block font-mono text-xs text-text-muted">{option.sub}</span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
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
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-md border border-border bg-surface p-lg ${className}`}>
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
    <div role="alert" className={`rounded-sm border px-md py-sm text-sm ${tones[tone]}`}>
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

/** A small tag for statuses, tiers and counts — squared, ledger-stamp style. */
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
      className={`inline-flex items-center gap-xs rounded-sm border px-sm py-xs text-[11px] font-medium uppercase tracking-[0.06em] ${tones[tone]}`}
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
  srLabel,
  tone = 'primary',
}: {
  value: number
  max: number
  label?: string
  /** Accessible name when the visible label is rendered elsewhere. */
  srLabel?: string
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
          <span className="font-mono text-xs">
            {value} / {max}
          </span>
        </div>
      ) : null}
      <div className="h-1.5 w-full overflow-hidden bg-border/60">
        <div
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label ?? srLabel}
          className={`h-full transition-all ${fills[tone]}`}
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
      <h3 className="font-heading text-base font-semibold text-text-main">{title}</h3>
      {body ? <p className="max-w-sm text-sm text-text-muted">{body}</p> : null}
      {action ? <div className="mt-sm">{action}</div> : null}
    </div>
  )
}

/**
 * A load-failure panel. Distinct from EmptyState on purpose: an empty garden
 * invites planting; a failed request explains itself and offers a retry.
 */
export function ErrorState({
  title = "Couldn't load this",
  body = 'The server could not be reached. Your data is safe — try again.',
  onRetry,
  retryLabel = 'Try again',
}: {
  title?: string
  body?: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-sm rounded-md border border-accent/30 bg-accent/5 px-lg py-lg text-center"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
        Connection trouble
      </p>
      <h3 className="font-heading text-base font-semibold text-text-main">{title}</h3>
      <p className="max-w-sm text-sm text-text-muted">{body}</p>
      {onRetry ? (
        <div className="mt-sm">
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * An accessible dialog: focus is trapped inside, moved in on open, restored on
 * close; body scroll locks; Escape and backdrop close — unless `busy`, so an
 * in-flight save can't be discarded by a stray click.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  busy = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  busy?: boolean
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => el.offsetParent !== null)
        if (focusable.length === 0) {
          e.preventDefault()
          return
        }
        const first = focusable[0]!
        const last = focusable[focusable.length - 1]!
        const active = document.activeElement
        // Focus can escape the panel (e.g. a button disables itself and the
        // browser drops focus to body) — recapture instead of walking the page.
        if (!panelRef.current.contains(active)) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && (active === first || active === panelRef.current)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, busy])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-md"
      onClick={() => {
        if (!busy) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-md border border-border bg-surface p-lg focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="mb-md font-heading text-lg font-bold text-text-main">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}

/** A dashboard stat tile: eyebrow label, mono ledger value, quiet context line. */
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
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className={`mt-xs font-mono text-3xl font-semibold tracking-tight ${accent}`}>{value}</p>
      <p className="mt-xs font-mono text-xs text-text-muted">{sub}</p>
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
        <h1 className="font-heading text-[26px] font-bold tracking-tight text-text-main">{title}</h1>
        {subtitle ? <p className="mt-xs text-sm text-text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ toasts */

type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/**
 * Ephemeral feedback, stamped like a ledger entry: hairline border, tone-coloured
 * edge, quiet auto-dismiss. Success confirms the action verb that caused it
 * ("Watered Monstera"); errors say what failed and that retrying is safe.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, number>())

  const dismissById = useCallback((id: number) => {
    const t = timers.current.get(id)
    if (t) window.clearTimeout(t)
    timers.current.delete(id)
    setToasts((list) => list.filter((item) => item.id !== id))
  }, [])

  const schedule = useCallback(
    (id: number, ms: number) => {
      const existing = timers.current.get(id)
      if (existing) window.clearTimeout(existing)
      timers.current.set(id, window.setTimeout(() => dismissById(id), ms))
    },
    [dismissById],
  )

  // Hovering or focusing a toast pauses its timer so it can be read or
  // dismissed deliberately; leaving restarts a short grace period.
  const pause = useCallback((id: number) => {
    const t = timers.current.get(id)
    if (t) {
      window.clearTimeout(t)
      timers.current.delete(id)
    }
  }, [])
  const resume = useCallback((id: number) => schedule(id, 2000), [schedule])

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-3), { id, tone, message }])
      schedule(id, tone === 'error' ? 6500 : 4000)
    },
    [schedule],
  )

  const apiRef = useRef<ToastApi>({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  })

  const edges: Record<ToastTone, string> = {
    success: 'border-l-primary',
    error: 'border-l-accent',
    info: 'border-l-secondary',
  }
  const eyebrows: Record<ToastTone, string> = {
    success: 'Logged',
    error: 'Not saved',
    info: 'Note',
  }
  const eyebrowColor: Record<ToastTone, string> = {
    success: 'text-primary-hover',
    error: 'text-accent',
    info: 'text-secondary',
  }

  return (
    <ToastContext.Provider value={apiRef.current}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-sm px-md md:inset-x-auto md:right-lg md:bottom-lg md:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => resume(t.id)}
            onFocus={() => pause(t.id)}
            onBlur={(e) => {
              if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) resume(t.id)
            }}
            className={`toast-enter pointer-events-auto flex w-full max-w-sm items-start gap-sm rounded-sm border border-border border-l-2 bg-surface px-md py-sm ${edges[t.tone]}`}
          >
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] font-medium uppercase tracking-[0.08em] ${eyebrowColor[t.tone]}`}>
                {eyebrows[t.tone]}
              </p>
              <p className="mt-[2px] text-sm text-text-main">{t.message}</p>
            </div>
            <button
              onClick={() => dismissById(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-sm p-xs text-text-muted hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="square" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Access the toast API. Safe no-op outside a provider so tests stay simple. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (ctx) return ctx
  return { success: () => {}, error: () => {}, info: () => {} }
}
