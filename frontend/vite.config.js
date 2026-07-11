import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'https://viralify-backend-li673hdf6q-uc.a.run.app')
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser'
  },
  server: {
    port: 5173,
    middlewareMode: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 4173,
    host: '0.0.0.0'
  }
})