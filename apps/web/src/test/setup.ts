import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
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
