import { describe, expect, it } from 'vitest'

// Imported through the alias on purpose. The `@/*` path is declared in three
// places — tsconfig.json, vite.config.ts and vitest.config.ts — and only the
// last one fails silently: dev and build stay green while every test that
// renders an adapted vendor component dies on an unresolved import. This line
// is the guard for that.
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('resolves conditional classes', () => {
    // Written through a parameter rather than a literal `false &&` so the
    // condition is actually evaluated at runtime, which is how callers use it.
    const withState = (active: boolean) => cn('a', active && 'b', 'c')
    expect(withState(false)).toBe('a c')
    expect(withState(true)).toBe('a b c')

    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c')
  })

  it('lets a later Tailwind class override an earlier one in the same group', () => {
    // Without tailwind-merge both land in the attribute and CSS source order
    // decides, so a caller's className loses to a component's own default at
    // random. This is the whole reason the helper exists.
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    expect(cn('bg-surface', 'bg-background')).toBe('bg-background')
  })

  it('ignores nullish input rather than emitting "undefined"', () => {
    expect(cn(undefined, null, 'a')).toBe('a')
  })
})
