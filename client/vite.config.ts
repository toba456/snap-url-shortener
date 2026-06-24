import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/urls':  'http://localhost:3000',
      // /dashboard lo comparte la SPA (página) y el backend (API).
      // Si el browser navega a /dashboard (Accept: text/html), servimos la SPA.
      // Si es un fetch de la API (Accept: application/json o */*), lo proxeamos.
      '/dashboard': {
        target: 'http://localhost:3000',
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
    },
  },
})
