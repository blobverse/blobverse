import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts', 'packages/**/src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/shared/src/**/*.ts'],
      exclude: [
        'packages/shared/src/**/*.test.ts',
        'packages/shared/src/**/*.spec.ts',
        'packages/shared/src/index.ts',
        'packages/shared/src/types.ts',
        'packages/shared/src/protocol.ts'
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  }
})
