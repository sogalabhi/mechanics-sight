import { resolve } from 'node:path'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5174', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  webServer: [
    { command: `${resolve('../backend/.venv/bin/python')} -m uvicorn beam_solver.api.app:app --host 127.0.0.1 --port 18000`, url: 'http://127.0.0.1:18000/api/v1/health', reuseExistingServer: !process.env.CI },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort', url: 'http://127.0.0.1:5174', env: { BEAM_API_URL: 'http://127.0.0.1:18000' }, reuseExistingServer: !process.env.CI },
  ],
})
