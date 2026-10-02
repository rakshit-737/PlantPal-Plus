/**
 * Whether motion should be suppressed right now, from either source that can
 * ask for it:
 *
 *  1. the OS preference, `prefers-reduced-motion: reduce`, and
 *  2. the in-app setting, which SettingsContext stamps on <html> as
 *     `data-reduce-motion`.
 *
 * The in-app control has to work on its own — a user on a shared or managed
 * machine can't always change the OS setting — so the two are OR'd rather than
 * the app deferring to the system.
 *
 * The attribute is written by SettingsProvider, which mounts *below* the
 * consumer of this hook (App wires MotionConfig at the root, the provider lives
 * inside the authenticated shell). A MutationObserver is therefore the only
 * way to see it: there is no shared React state to subscribe to, and polling
 * would either lag the toggle or burn frames.
 *
 * Read this instead of calling `window.matchMedia` directly anywhere in the
 * app; a component that checks only the media query silently ignores the
 * in-app toggle.
 */
import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'
const ATTRIBUTE = 'data-reduce-motion'

function currentlyReduced(): boolean {
  return (
    document.documentElement.hasAttribute(ATTRIBUTE) || window.matchMedia(QUERY).matches
  )
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(currentlyReduced)

  useEffect(() => {
    const sync = () => setReduced(currentlyReduced())

    const query = window.matchMedia(QUERY)
    query.addEventListener('change', sync)

    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [ATTRIBUTE],
    })

    // Settings may have loaded and stamped the attribute between the first
    // render and this effect, which the observer would not report.
    sync()

    return () => {
      query.removeEventListener('change', sync)
      observer.disconnect()
    }
  }, [])

  return reduced
}
