import { useTheme } from '../hooks/useTheme'

/**
 * Light/dark switch as a single icon button. The accessible name says what a
 * press will do, not what the current state is — "Switch to dark mode" is an
 * instruction a screen reader user can act on; "Dark mode, off" is a puzzle.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const label = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`relative grid h-10 w-10 place-items-center rounded-full border border-glass-border bg-glass text-text-muted shadow-1 backdrop-blur-glass transition-[color,background-color,transform] duration-standard ease-state hover:-translate-y-px hover:bg-surface-raised hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      {theme === 'light' ? (
        // Moon: what you get.
        <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
        </svg>
      ) : (
        // Sun.
        <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.75v2M12 19.25v2M4.75 12h-2M21.25 12h-2M6.9 6.9L5.5 5.5M18.5 18.5l-1.4-1.4M6.9 17.1l-1.4 1.4M18.5 5.5l-1.4 1.4" />
        </svg>
      )}
    </button>
  )
}
