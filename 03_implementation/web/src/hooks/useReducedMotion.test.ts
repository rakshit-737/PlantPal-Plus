import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useReducedMotion } from './useReducedMotion'

const ATTRIBUTE = 'data-reduce-motion'

/** Point matchMedia at a fixed answer for the reduced-motion query. */
function osPrefersReduced(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion') ? matches : false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
}

afterEach(() => {
  // The root element outlives each test; a leaked attribute would silently
  // pass the next one.
  document.documentElement.removeAttribute(ATTRIBUTE)
  vi.restoreAllMocks()
})

describe('useReducedMotion', () => {
  it('is false when neither the OS nor the app asks for reduced motion', () => {
    osPrefersReduced(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('follows the OS preference', () => {
    osPrefersReduced(true)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('follows the in-app setting independently of the OS', () => {
    // The whole point of the in-app toggle: a user who cannot change the OS
    // setting still gets a still interface.
    osPrefersReduced(false)
    document.documentElement.setAttribute(ATTRIBUTE, '')
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('reacts when the attribute is stamped after mount', async () => {
    // SettingsProvider mounts below the consumer of this hook and writes the
    // attribute once settings load, so the value always arrives late. Without
    // the MutationObserver the app would keep animating until the next render
    // happened to occur.
    osPrefersReduced(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)

    document.documentElement.setAttribute(ATTRIBUTE, '')
    await waitFor(() => expect(result.current).toBe(true))

    document.documentElement.removeAttribute(ATTRIBUTE)
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('stops observing once unmounted', async () => {
    osPrefersReduced(false)
    const { result, unmount } = renderHook(() => useReducedMotion())
    unmount()

    // A surviving observer would call setState on an unmounted hook.
    document.documentElement.setAttribute(ATTRIBUTE, '')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(result.current).toBe(false)
  })
})
