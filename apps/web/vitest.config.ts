import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Test config kept separate from vite.config.ts: the app config reads env for
 * base paths and dev proxying, none of which applies under jsdom.
 *
 * jsdom + testing-library lets the component tests assert what a user
 * experiences — focus order, announced roles, keyboard navigation — rather
 * than implementation details.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
