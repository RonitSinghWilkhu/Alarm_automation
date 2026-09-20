import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward these API routes to your backend
      '/tickets': 'http://127.0.0.1:8001',
      '/notifications': 'http://127.0.0.1:8001',
      '/troubleshoot': 'http://127.0.0.1:8001'
    }
  }
})