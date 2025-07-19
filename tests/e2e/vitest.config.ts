import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load environment variables from .env.test
  const env = loadEnv('test', process.cwd(), '');
  
  return {
    test: {
      env: {
        ...env,
        // Force load from .env.test
        VIBEBASE_API_URL: env.VIBEBASE_API_URL || 'http://localhost:8787',
        VIBEBASE_API_KEY: env.VIBEBASE_API_KEY || '',
        VIBEBASE_TEST_USER_TOKEN: env.VIBEBASE_TEST_USER_TOKEN || '',
        CLEANUP_BEFORE_TEST: env.CLEANUP_BEFORE_TEST || 'true',
      },
      environment: 'node',
      globals: true,
      testTimeout: 30000,
      hookTimeout: 30000,
      setupFiles: ['./setup.ts'],
      sequence: {
        shuffle: false, // E2Eテストは順序に依存する場合があるため
      },
    },
  };
});