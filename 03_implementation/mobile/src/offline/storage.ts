/**
 * The outbox's persistence seam — deliberately two functions wide.
 *
 * WHICH DRIVER IS ACTIVE, AND WHY
 * AsyncStorage. An outbox exists precisely for the case where the app is used
 * without connectivity, and that is also when a user is most likely to force
 * quit or be killed by the OS — so a queue that only survives while the JS
 * context lives would drop writes in its own headline scenario.
 *
 * expo-secure-store is also a dependency and is durable, but it is a keystore
 * for secrets with a documented ~2048-byte ceiling per value — a queue of meal
 * payloads would silently hit that ceiling, so it is not used here.
 *
 * Every failure path below degrades to an empty or unchanged queue rather than
 * throwing: a corrupt or unavailable store must never turn into a crash loop on
 * boot, and the in-flight copy held by outbox.ts stays authoritative for the
 * session either way.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

import type { OutboxItem } from './types'

export const STORAGE_KEY = 'plantpal.outbox.v1'

/** Which driver is compiled in. Surfaced for diagnostics and tests. */
export const storageKind: 'memory' | 'async-storage' | 'file-system' = 'async-storage'

/**
 * Returns null when the store could not be READ — distinct from [], which
 * means "read fine, nothing queued". The caller must not overwrite storage
 * after a null, or a transient read failure would erase a real queue.
 */
export async function loadItems(): Promise<OutboxItem[] | null> {
  let raw: string | null
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY)
  } catch {
    // Store unavailable (rare, but possible during early boot on Android).
    return null
  }
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as OutboxItem[]) : []
  } catch {
    // Unreadable queue: drop it so the app boots, and do not leave the bad
    // value behind to fail again on the next launch. This is a genuine empty,
    // not a read failure — the contents were seen and were garbage.
    void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {})
    return []
  }
}

export async function saveItems(items: readonly OutboxItem[]): Promise<void> {
  let serialized: string
  try {
    serialized = JSON.stringify(items)
  } catch {
    // A payload that cannot be serialized must not take the queue down with
    // it; the in-flight copy in outbox.ts stays authoritative for this session.
    return
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, serialized)
  } catch {
    // Disk full or store unavailable — the queue stays in memory and the next
    // save attempt (after the next write or drain) tries again.
  }
}
