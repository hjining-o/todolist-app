/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// API는 프록시 없이 VITE_API_BASE_URL로 CORS 호출한다(G-14, BD-12)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    env: { VITE_API_BASE_URL: 'http://api.test' },
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/shared/components/ui/**', 'src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/shared/types/**'],
    },
  },
})
