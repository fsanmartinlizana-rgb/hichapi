import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['app/api/**', 'lib/**'],
      exclude: [
        '**/*.test.ts',
        '**/*.config.ts',
        '**/types.ts',
        'lib/supabase/client.ts', // browser-only
        'node_modules/**',
      ],
      // Coverage thresholds:
      // - Target: 60% for API routes (app/api/**)
      // - Target: 80% for library code (lib/**)
      // Setting global threshold to 60% as baseline
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
