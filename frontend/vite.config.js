import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward all API routes to the FastAPI backend so the browser
      // only ever talks to a single origin (localhost:5173).
      // This keeps the alarmops_session cookie on one origin and
      // satisfies SameSite=Lax without any CORS/cookie-origin split.
      '/auth': 'http://localhost:8001',
      '/tickets': 'http://localhost:8001',
      '/notifications': 'http://localhost:8001',
      '/troubleshoot': 'http://localhost:8001'
    }
  }
})