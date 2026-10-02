/** Minimal react-native surface used by the modules under test. */
export const Platform = {
  OS: 'android' as const,
  select: <T,>(spec: { ios?: T; android?: T; default?: T }): T =>
    (spec.android ?? spec.default) as T,
}

type AppStateListener = (state: string) => void
const listeners = new Set<AppStateListener>()

export const AppState = {
  currentState: 'active',
  addEventListener(_type: string, handler: AppStateListener) {
    listeners.add(handler)
    return { remove: () => listeners.delete(handler) }
  },
}

/** Test helper: drive a foreground transition. */
export function emitAppState(state: string) {
  for (const l of listeners) l(state)
}
