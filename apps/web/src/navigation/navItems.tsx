import type { ReactNode } from 'react'

/**
 * Top-level navigation, per docs/design/04-navigation-flow.md.
 *
 * `module` ties an item to a preference toggle (plant care/fitness/nutrition
 * can each be disabled, hiding the tab — the server's Invariant 34 keeps at
 * least one enabled). Items without a module are always shown.
 */
export interface NavItem {
  to: string
  label: string
  icon: ReactNode
  module?: 'plant_care' | 'fitness' | 'nutrition'
}

// Inline SVGs keep the shell dependency-free; swap for lucide-react later.
const icon = (path: string): ReactNode => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden
  >
    <path d={path} />
  </svg>
)

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: icon('M3 12l9-9 9 9M5 10v10h14V10') },
  {
    to: '/plants',
    label: 'Plants',
    module: 'plant_care',
    icon: icon('M12 22c4-4 8-7 8-12a8 8 0 10-16 0c0 5 4 8 8 12z'),
  },
  {
    to: '/fitness',
    label: 'Fitness',
    module: 'fitness',
    icon: icon('M6 6l12 12M4 8l2-2M20 16l-2 2M8 20l-2-2M18 4l2 2'),
  },
  {
    to: '/nutrition',
    label: 'Nutrition',
    module: 'nutrition',
    icon: icon('M12 3c3 0 5 2 5 6s-2 12-5 12-5-8-5-12 2-6 5-6z'),
  },
  { to: '/achievements', label: 'Achievements', icon: icon('M8 21h8M12 17v4M6 4h12v5a6 6 0 01-12 0V4z') },
  { to: '/settings', label: 'Settings', icon: icon('M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2 1-2 4-2-1M5 12l-2 1 2 4 2-1') },
]
