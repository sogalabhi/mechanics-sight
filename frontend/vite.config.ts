import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    fs: { allow: ['..'] },
    proxy: { '/api': process.env.BEAM_API_URL ?? 'http://localhost:8000' } },
  test: { environment: 'node', css: true, include: ['src/**/*.test.{ts,tsx}'] },
})
