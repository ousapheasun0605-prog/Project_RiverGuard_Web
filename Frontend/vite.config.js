import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev server: forward API and live WebSocket to the backend on :5000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/ws': { target: 'ws://localhost:5000', ws: true },
    },
  },
})
