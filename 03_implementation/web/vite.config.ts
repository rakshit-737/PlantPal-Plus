import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// The web app talks to the API at /api/*. In dev we proxy that to the local
// Express server (default port 4000) so the browser makes same-origin requests
// and the httpOnly refresh_token cookie (SameSite behaviour, path /api/auth)
// works without cross-site cookie quirks. In production either the web host
// rewrites /api to the API origin (Vercel/Netlify), or a static host with no
// rewrites (GitHub Pages) sets VITE_API_URL and the client calls the API
// origin directly with CORS + credentialed cookies.
//
// VITE_BASE supports hosting under a subpath (GitHub Pages serves the site at
// /<repo>/); BrowserRouter picks it up via import.meta.env.BASE_URL.
export default defineConfig(({ mode }) => {
  // loadEnv merges .env / .env.local files with the shell environment —
  // process.env alone silently ignored the .env file README tells users to
  // create.
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  return {
    base: env.VITE_BASE ?? '/',
    plugins: [react()],
    // Mirrors the `@/*` path in tsconfig.json and vitest.config.ts. Vendor
    // components copied in from shadcn-convention registries import
    // `@/lib/utils`; all three configs have to agree or the same import
    // resolves in the editor and fails at build (or in tests).
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET ?? 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  }
})
