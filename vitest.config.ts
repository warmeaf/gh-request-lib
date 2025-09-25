import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*'], // 配置为扫描所有子包
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/test/**',
        '**/__test__/**',
        'coverage/**',
        'docs/**',
        'tech-docs/**',
        '.cursor/**',
        '.git/**',
        '.kiro/**',
        '.vscode/**'
      ],
      include: ['packages/*/src/**/*.ts'],
      all: true,
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },
})
