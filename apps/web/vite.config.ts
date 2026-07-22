import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The web app talks to the API at /api/*. In dev we proxy that to the local
// Express server (default port 4000) so the browser makes same-origin requests
// and the httpOnly refresh_token cookie (SameSite behaviour, path /api/auth)
// works without cross-site cookie quirks. In production the web host rewrites
// /api to the deployed API origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
