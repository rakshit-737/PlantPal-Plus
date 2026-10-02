import type { ReactNode } from 'react'

/**
 * Top-level navigation, per 02_design/ui_design/04-navigation-flow.md.
 *
 * `module` ties an item to a preference toggle (plant care/fitness/nutrition
 * can each be disabled, hiding the tab — the server's Invariant 34 keeps at
 * least one enabled). Items without a module are always shown. `group` only
 * decides which caption an item sits under in the desktop sidebar.
 */
export interface NavItem {
  to: string
  label: string
  icon: ReactNode
  module?: 'plant_care' | 'fitness' | 'nutrition'
  group: 'today' | 'habits' | 'you'
}

/*
 * The icons are drawn here rather than imported, and that is a settled
 * decision rather than a stopgap: the icon set is part of the identity, and a
 * library face would make the navigation look like every other app built this
 * year. It also keeps the shell free of a dependency whose weight lands on the
 * most-visited route.
 *
 * House convention, matching every other glyph in the app: a 24-unit grid,
 * 1.6 stroke, round caps and joins.
 */
const glyph = (...paths: string[]): ReactNode => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[20px] w-[20px] shrink-0"
    aria-hidden
  >
    {paths.map((d) => (
      <path key={d} d={d} />
    ))}
  </svg>
)

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    group: 'today',
    icon: glyph(
      'M4.5 5.5A1 1 0 015.5 4.5h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1z',
      'M13.5 5.5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1z',
      'M13.5 12.5a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1z',
      'M4.5 15.5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1z',
    ),
  },
  {
    to: '/plants',
    label: 'Plants',
    module: 'plant_care',
    group: 'habits',
    icon: glyph(
      'M12 20v-8',
      'M12 13c0-4.2-2.9-7-7-7 0 4.2 2.9 7 7 7z',
      'M12 10.5c0-3.6 2.4-6.3 6.5-6.3 0 3.6-2.4 6.3-6.5 6.3z',
      'M7.5 20h9',
    ),
  },
  {
    to: '/fitness',
    label: 'Fitness',
    module: 'fitness',
    group: 'habits',
    icon: glyph('M3 12h3.5l2.5-6 4 12 2.5-6H21'),
  },
  {
    to: '/nutrition',
    label: 'Nutrition',
    module: 'nutrition',
    group: 'habits',
    icon: glyph(
      'M12 7.5c-1.5-1.6-4.2-1.9-6-.4-2.4 2-2 6.5.2 9.6 1.3 1.8 2.9 2.9 4.3 2.5.6-.2 1-.4 1.5-.4s.9.2 1.5.4c1.4.4 3-.7 4.3-2.5 2.2-3.1 2.6-7.6.2-9.6-1.8-1.5-4.5-1.2-6 .4z',
      'M12 7.5c0-1.8.8-3.3 2.5-4',
    ),
  },
  {
    to: '/achievements',
    label: 'Achievements',
    group: 'you',
    icon: glyph(
      'M8 4.5h8v4.5a4 4 0 01-8 0z',
      'M8 6.5H5.5a2.5 2.5 0 002.7 3',
      'M16 6.5h2.5a2.5 2.5 0 01-2.7 3',
      'M12 13v3.5M9 19.5h6M10 16.5h4',
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    group: 'you',
    icon: glyph(
      'M4.5 7h9M17.5 7h2M4.5 17h2M10.5 17h9',
      'M15.5 9a2 2 0 100-4 2 2 0 000 4zM8.5 19a2 2 0 100-4 2 2 0 000 4z',
    ),
  },
]

/** Sidebar captions, in display order. */
export const NAV_GROUPS: { key: NavItem['group']; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'habits', label: 'Habits' },
  { key: 'you', label: 'You' },
]
