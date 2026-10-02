/**
 * In-memory AsyncStorage stub. `__reset` and `__fail` let a test start from a
 * clean store or simulate an unavailable one.
 */
const store = new Map<string, string>()
let failMode: 'none' | 'read' | 'write' = 'none'

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    if (failMode === 'read') throw new Error('store unavailable')
    return store.get(key) ?? null
  },
  async setItem(key: string, value: string): Promise<void> {
    if (failMode === 'write') throw new Error('disk full')
    store.set(key, value)
  },
  async removeItem(key: string): Promise<void> {
    store.delete(key)
  },
  __reset() {
    store.clear()
    failMode = 'none'
  },
  __fail(mode: 'none' | 'read' | 'write') {
    failMode = mode
  },
  __raw: store,
}

export default AsyncStorage
