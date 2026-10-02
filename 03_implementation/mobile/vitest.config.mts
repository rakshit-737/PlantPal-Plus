import { defineConfig } from 'vitest/config'

/**
 * The mobile app is Expo/React Native, so there is no DOM and no Metro bundler
 * under vitest. Tests here target the platform-independent logic — the offline
 * outbox above all, where a classification mistake silently loses or duplicates
 * a user's logged event.
 *
 * React Native and native modules are aliased to stubs in src/test/, so a test
 * can import the outbox without dragging in the Expo runtime.
 */
export default defineConfig({
  resolve: {
    alias: {
      'react-native': new URL('./src/test/stubs/react-native.ts', import.meta.url).pathname,
      'expo-secure-store': new URL('./src/test/stubs/expo-secure-store.ts', import.meta.url).pathname,
      '@react-native-async-storage/async-storage': new URL(
        './src/test/stubs/async-storage.ts',
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
