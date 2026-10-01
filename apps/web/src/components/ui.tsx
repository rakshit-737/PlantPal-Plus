/**
 * Base UI primitives — the web side of docs/design/02-component-inventory.md.
 * Written in-repo rather than adopted from a component library, so the design
 * tokens stay the single source of styling truth and nothing here carries a
 * third-party licence (see THIRD_PARTY_LICENSES.md).
 *
 * Glasshouse rules (v3.0): panes are translucent — `--glass-bg` with a 1px
 * `--glass-highlight` top edge and one of four elevation steps. Glow marks
 * state, never cursor position. Radii open up (6px for anything holding a
 * metric, 10px for controls, 16px for panels, 22px for modals) but numbers
 * still sit in square-ish cells. Carried over from v2.0 unchanged: uppercase
 * letterspaced eyebrows for labels, and every metric in font-mono so numbers
 * line up like ledger entries.
 *
 * Two contrast rules this file has to respect:
 *  - anything a user operates draws its boundary with `--color-border-control`,
 *    which clears the 3:1 WCAG 1.4.11 minimum. `--color-border` is a decorative
 *    hairline at ~1.3:1 and must never outline a control.
 *  - focus is a ring *and* a glow, never a glow alone. High contrast switches
 *    glow off, and a focus indicator that disappears there is worse than none.
 */
import type {
  ButtonHTMLAttributes,
  CSSProperties,
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

import { useReducedMotion } from '../hooks/useReducedMotion'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const buttonVariants: Record<ButtonVariant, string> = {
  // Light behind the glass: the primary action is the only thing in the app
  // that glows at rest.
  primary:
    'bg-primary text-on-primary shadow-glow-primary hover:bg-primary-hover focus-visible:ring-primary',
  secondary:
    'border border-border-control bg-glass text-text-main backdrop-blur-glass hover:border-text-muted hover:bg-surface focus-visible:ring-primary',
  ghost:
    'bg-transparent text-text-muted hover:bg-glass hover:text-text-main focus-visible:ring-primary',
  // Full-strength accent border, not a tint: this is a control boundary and
  // has to clear 3:1 like every other one.
  danger:
    'border border-accent bg-transparent text-accent hover:bg-accent/10 hover:shadow-glow-accent focus-visible:ring-accent',
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
      className={`inline-flex items-center justify-center gap-sm rounded-md px-md py-sm text-sm font-semibold transition-[background-color,border-color,box-shadow,color] duration-standard ease-state focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 ${buttonVariants[variant]} ${className}`}
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

/** The eyebrow that names a field. Identical across all three text controls. */
const FIELD_LABEL = 'text-xs font-medium uppercase tracking-[0.08em] text-text-muted'

/**
 * Shared field styling. A glass pane with a control-strength boundary, and on
 * focus a ring *plus* a glow — the ring is what survives high-contrast mode,
 * where the glow token resolves to nothing.
 *
 * Width is left to the caller: Input sits in a flex column, Select and Combobox
 * fill their wrapper.
 */
function fieldClass(error?: string | undefined): string {
  return `rounded-sm border bg-glass px-md py-sm text-base text-text-main backdrop-blur-glass transition-[border-color,box-shadow] duration-standard ease-state placeholder:text-text-muted focus:outline-none focus-visible:shadow-glow-primary focus-visible:ring-2 focus-visible:ring-primary ${
    error ? 'border-accent' : 'border-border-control'
  }`
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
      <label htmlFor={inputId} className={FIELD_LABEL}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${fieldClass(error)} ${className}`}
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
      <label htmlFor={selectId} className={FIELD_LABEL}>
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full appearance-none pr-xl ${fieldClass(error)} ${className}`}
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

  // Reset the highlight when the result set actually changes — not on every
  // parent re-render, which would drop the user mid-navigation. Nothing is
  // highlighted until an arrow key asks for it (ARIA combobox convention), so
  // Enter on typed text never picks a row the user did not aim at.
  const optionKey = options.map((o) => o.id).join('\0')
  useEffect(() => {
    setActiveIndex(-1)
  }, [optionKey])

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
      setOpen(true)
      // From "nothing highlighted", the first press lands on the first option.
      setActiveIndex((i) => Math.min(i + 1, options.length - 1))
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
      <label htmlFor={inputId} className={FIELD_LABEL}>
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
          className={`w-full ${fieldClass(error)}`}
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
            // The popup sits above other content, so it takes the stronger
            // pane: at resting opacity the list would read through to whatever
            // it covers.
            className="absolute z-30 mt-xs max-h-56 w-full overflow-y-auto rounded-md border border-glass-border bg-glass-strong py-xs shadow-glass-raised backdrop-blur-glass"
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
                  className={`cursor-pointer px-md py-sm text-sm transition-colors duration-micro ease-state ${
                    i === activeIndex
                      ? 'bg-primary/15 text-text-main'
                      : 'text-text-main hover:bg-primary/10'
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
  style,
}: {
  children: ReactNode
  className?: string
  /**
   * Escape hatch for values a class cannot carry. It exists for one thing —
   * the per-row `animationDelay` a staggered list entrance needs, which is a
   * different number on every row and so cannot be a Tailwind utility.
   */
  style?: CSSProperties | undefined
}) {
  return (
    <div
      style={style}
      className={`rounded-lg border border-glass-border bg-glass p-lg shadow-glass backdrop-blur-glass ${className}`}
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
  // Tinted glass rather than a flat fill, plus a heavier edge on the leading
  // side so the tone is legible before the text is read.
  const tones = {
    error: 'border-accent/40 border-l-accent bg-accent/10 text-accent',
    success: 'border-primary/40 border-l-primary bg-primary/10 text-primary-hover',
    info: 'border-secondary/40 border-l-secondary bg-secondary/10 text-secondary',
  }
  return (
    <div
      role="alert"
      className={`rounded-md border border-l-2 px-md py-sm text-sm backdrop-blur-glass ${tones[tone]}`}
    >
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
      // Control-strength track: at the decorative border's ~1.3:1 the ring
      // would be invisible and only the moving head would read.
      className={`inline-block animate-spin rounded-full border-2 border-border-control border-t-primary ${sizes[size]}`}
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
    default: 'border-border-control bg-glass text-text-muted',
    success: 'border-primary/40 bg-primary/10 text-primary-hover',
    warning: 'border-tertiary/40 bg-tertiary/10 text-tertiary',
    danger: 'border-accent/40 bg-accent/10 text-accent',
    info: 'border-secondary/40 bg-secondary/10 text-secondary',
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
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-control/40">
        <div
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label ?? srLabel}
          // The fill grows into place on the entrance curve rather than
          // snapping. Only width transitions — `transition-all` would also
          // animate the colour on a tone change, which reads as a glitch.
          className={`h-full rounded-full transition-[width] duration-entrance ease-entrance ${fills[tone]}`}
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
      className="flex flex-col items-center justify-center gap-sm rounded-lg border border-accent/40 bg-accent/5 px-lg py-lg text-center shadow-glass backdrop-blur-glass"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
        Connection trouble
      </p>
      <h3 className="font-heading text-base font-semibold text-text-main">{title}</h3>
      <p className="max-w-sm text-sm text-text-muted">{body}</p>
      {onRetry ? (
        <div className="mt-sm">
          {/* Primary, not secondary: retrying is the whole point of this panel
              and it should not sit quieter than the text explaining it. */}
          <Button onClick={onRetry}>{retryLabel}</Button>
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
        // No offsetParent/layout filter here: the panel sits inside a
        // fixed-position backdrop, where offsetParent is null in some engines
        // (and always null under jsdom) — that would empty the list and make
        // the trap swallow Tab entirely. The selector already skips disabled
        // controls, and hidden fields in this app are unmounted, not display:none.
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true')
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-md backdrop-blur-sm"
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
        // The panel is the app's most-raised surface: strong glass, the top
        // elevation step, and the widest radius. It grows in rather than
        // sliding; [data-reduce-motion] zeroes the duration, which leaves it
        // simply present instead of jump-cutting mid-transform.
        className="animate-grow-in relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-glass-border bg-glass-strong p-lg shadow-4 backdrop-blur-glass focus:outline-none"
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

/**
 * The whole-number value of a stat string, or null when it is not one.
 *
 * Deliberately strict: only digits, optionally grouped with commas. Anything
 * else — a decimal, a unit, a range — renders verbatim rather than being
 * animated, because rounding a displayed metric would change the data the user
 * is reading.
 */
function metricValue(text: string): number | null {
  const stripped = text.replace(/,/g, '')
  if (!/^\d+$/.test(stripped)) return null
  const n = Number(stripped)
  return Number.isSafeInteger(n) ? n : null
}

/**
 * Counts a stat up to its value on mount, and again whenever it changes.
 *
 * The numbers are the point of a habit tracker, so they arrive rather than
 * simply appear. Non-numeric values pass straight through, and reduced motion
 * skips to the answer — a counter that must be waited out is exactly the kind
 * of animation someone turns that setting on to avoid.
 */
function useCountUp(text: string): string {
  const reduced = useReducedMotion()
  const target = metricValue(text)
  const [shown, setShown] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    if (target === null) return
    if (reduced) {
      fromRef.current = target
      setShown(target)
      return
    }
    const from = fromRef.current
    if (from === target) return

    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      // 400ms is the entrance step of the motion contract; the cubic ease-out
      // matches --ease-entrance closely enough for a number.
      const t = Math.min(1, (now - started) / 400)
      const eased = 1 - (1 - t) ** 3
      setShown(from + (target - from) * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, reduced])

  if (target === null) return text
  const rounded = Math.round(shown)
  // Keep whatever grouping the caller chose, so 1,240 does not become 1240
  // for 400ms and then jump back.
  return text.includes(',') ? rounded.toLocaleString() : String(rounded)
}

/** A dashboard stat tile: eyebrow label, mono ledger value, quiet context line. */
export function StatCard({
  label,
  value,
  sub,
  accent,
  subTone = 'text-text-muted',
  meter,
}: {
  label: string
  value: string
  sub: string
  accent: string
  /**
   * Tone for the context line. Optional and muted by default — it exists so a
   * tile can raise its own alarm without a second component: an overdue count
   * is the one thing on this grid that should not read as quiet context.
   */
  subTone?: string
  /**
   * Progress towards this tile's goal, 0–100, drawn as a hairline under the
   * number in the tile's own accent.
   *
   * Only pass it where a denominator actually exists. "1,180 of 2,000" is a
   * fraction a bar can draw honestly; a streak of 12 days is not — inventing a
   * target so every tile could have a bar would make the grid look consistent
   * by making one of the bars a lie.
   */
  meter?: number
}) {
  const shown = useCountUp(value)
  return (
    <Card className="transition-shadow duration-standard ease-state hover:shadow-glass-raised">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className={`mt-xs font-mono text-3xl font-semibold tracking-tight ${accent}`}>
        {/* Counting is decorative. Assistive technology gets the settled
            number outright rather than whatever frame it happens to land on —
            aria-label would not do this reliably, since a <p> has no implicit
            role to carry one. */}
        <span className="sr-only">{value}</span>
        <span aria-hidden>{shown}</span>
      </p>
      <p className={`mt-xs font-mono text-xs ${subTone}`}>{sub}</p>
      {meter !== undefined && (
        <div
          aria-hidden
          className="mt-sm h-1 overflow-hidden rounded-full bg-background-alt"
        >
          <div
            className={`h-full rounded-full bg-current opacity-70 transition-[width] duration-entrance ease-entrance ${accent}`}
            style={{ width: `${Math.max(0, Math.min(100, meter))}%` }}
          />
        </div>
      )}
    </Card>
  )
}

/**
 * A placeholder for content that has not arrived yet.
 *
 * Deliberately static. The motion contract permits exactly two looping
 * animations app-wide — the spinner and the ambient mesh — so a shimmer would
 * be a third; it would also collapse to a single frame under reduced motion,
 * where every animation is forced to one iteration. The shape carries the
 * meaning instead of the movement.
 *
 * Size it to match what it replaces. A skeleton that is not dimensionally
 * honest just trades a spinner for a layout shift, which is the thing it
 * exists to prevent.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  // The test id is the only handle a test has on these: they are aria-hidden by
  // design, so every accessible query is blind to them, and a placeholder that
  // silently stops rendering is invisible in review too.
  return (
    <div aria-hidden data-testid="skeleton" className={`rounded-sm bg-border-control/30 ${className}`} />
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
        {/* Larger and tighter than v2.0's 26px, but well short of the landing
            page's display step: this heads a working screen, and scanning it
            beats admiring it. */}
        <h1 className="font-heading text-[30px] font-bold leading-tight tracking-[-0.02em] text-text-main">
          {title}
        </h1>
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
            className={`toast-enter pointer-events-auto flex w-full max-w-sm items-start gap-sm rounded-md border border-glass-border border-l-2 bg-glass-strong px-md py-sm shadow-glass-raised backdrop-blur-glass ${edges[t.tone]}`}
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
              className="shrink-0 rounded-sm p-xs text-text-muted transition-colors duration-micro ease-state hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
