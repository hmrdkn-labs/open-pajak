import { URL, fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// The app's vite.config.ts loads router/devtools plugins that the pure engine tests do not need.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    testTimeout: 60_000,
    include: ['src/**/*.test.ts'],
  },
})
