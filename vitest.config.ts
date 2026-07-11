import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // hichapi-mobile-app usa Jest (su propio framework/config) — vitest no
    // debe recogerlo (revientan los 21 archivos por APIs de Jest). .claude/
    // worktrees duplica la suite completa; hichapi-dev-kit es config vieja.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'hichapi-mobile-app/**',
      '.claude/**',
      'hichapi-dev-kit/**',
    ],
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
