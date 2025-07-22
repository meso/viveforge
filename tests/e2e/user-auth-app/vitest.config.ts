import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'user-auth-e2e',
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 10000,
    setupFiles: [],
    sequence: {
      shuffle: false,
      concurrent: false, // アクセスコントロールテストは順次実行
    },
    maxConcurrency: 1,
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1,
      },
    },
  },
})