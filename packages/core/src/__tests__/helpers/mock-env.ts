import { vi } from 'vitest'
import type { Env } from '../../types'
import type { D1Database, KVNamespace, R2Bucket } from '../../types/cloudflare'

// Create empty mock objects for services we don't need in tests
export const createMockEnv = (overrides: Partial<Env> = {}): Env => ({
  DB: {} as D1Database,
  SESSIONS: {} as KVNamespace,
  SYSTEM_STORAGE: {} as R2Bucket,
  ASSETS: { fetch: vi.fn(() => Promise.resolve(new Response('mock asset'))) },
  VIBEBASE_AUTH_URL: 'https://auth.vibebase.workers.dev',
  WORKER_DOMAIN: 'test.example.com',
  ENVIRONMENT: 'development',
  ...overrides,
})
