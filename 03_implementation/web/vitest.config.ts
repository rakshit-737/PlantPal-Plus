import { fileURLToPath } from 'node:url'

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
  // The `@/*` alias is declared three times — here, in vite.config.ts and in
  // tsconfig.json. Because this config is separate from the app's, omitting it
  // here breaks every test that renders a vendor component, while dev and
  // build stay green.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
