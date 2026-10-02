import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom implements neither matchMedia nor scrollTo; useTheme calls the first
// on mount and AppShell the second on every route change.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

// jsdom ships scrollTo as a stub that throws "Not implemented" — always
// replace it, don't just fill it in when missing.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo

/*
 * The rest of this file exists for the animated components. jsdom implements
 * none of the browser APIs they assume, and they throw on render rather than
 * degrading — so a page test fails for a reason that has nothing to do with
 * what it is asserting. Stub them here, once, rather than in each test file:
 * a stub that lives in a test file only protects that file, and the next
 * person to render the same page gets the same crash somewhere else.
 */

// Observers: scroll-reveal, sticky and measure-on-resize components construct
// these during render. One class satisfies both shapes.
class MockObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): [] {
    return []
  }
  root = null
  rootMargin = ''
  thresholds: number[] = []
}

globalThis.IntersectionObserver ??= MockObserver as unknown as typeof IntersectionObserver
globalThis.ResizeObserver ??= MockObserver as unknown as typeof ResizeObserver

// Canvas-backed effects (vanishing input, canvas reveal) call getContext and
// dereference the result. jsdom returns nothing useful, so return null and let
// the components take their own no-canvas path.
HTMLCanvasElement.prototype.getContext = vi.fn(
  () => null,
) as unknown as HTMLCanvasElement['getContext']

// Run animations to their final state immediately. Without this an assertion
// races the animation and passes or fails on timing, which is the classic
// flaky-test source once a UI has motion in it.
MotionGlobalConfig.skipAnimations = true
