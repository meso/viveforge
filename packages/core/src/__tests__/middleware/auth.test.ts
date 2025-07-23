import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminAuthManager } from '../../lib/admin-auth-manager'
import { getCurrentUser, multiAuth } from '../../middleware/auth'
import type { Env, Variables } from '../../types'
import type { D1Database, KVNamespace, R2Bucket } from '../../types/cloudflare'

// Mock AdminAuthManager
vi.mock('../../lib/admin-auth-manager')

describe('Auth Middleware', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let env: Env
  let mockAuthClient: AdminAuthManager

  beforeEach(() => {
    vi.clearAllMocks()

    env = {
      VIBEBASE_AUTH_URL: 'https://auth.vibebase.workers.dev',
      WORKER_DOMAIN: 'test.example.com',
      ENVIRONMENT: 'development',
      DB: {} as unknown as D1Database,
      SESSIONS: {} as unknown as KVNamespace,
      SYSTEM_STORAGE: {} as unknown as R2Bucket,
      USER_STORAGE: {} as unknown as R2Bucket,
      ASSETS: {
        fetch: vi.fn(() => Promise.resolve(new Response('mock asset'))),
      },
    }

    mockAuthClient = {
      verifyRequest: vi.fn(),
      getLoginUrl: vi
        .fn()
        .mockReturnValue(
          'https://auth.vibebase.workers.dev/auth/login?origin=https%3A%2F%2Ftest.example.com&redirect_to=%2F'
        ),
    } as unknown as AdminAuthManager

    app = new Hono<{ Bindings: Env; Variables: Variables }>()

    // Setup middleware to inject mock auth client
    app.use('*', async (c, next) => {
      c.set('authClient', mockAuthClient)
      await next()
    })
  })

  describe('multiAuth', () => {
    it('should allow authenticated requests', async () => {
      const mockUser = {
        id: '12345',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin'],
        provider: 'github',
        provider_id: '12345',
        role: 'admin',
        is_active: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      }

      vi.mocked(mockAuthClient.verifyRequest).mockResolvedValue(mockUser)

      app.get('/protected', multiAuth, (c) => {
        const user = getCurrentUser(c)
        return c.json({ message: 'success', user })
      })

      const res = await app.request('/protected', {}, { env })

      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        error?: string
        message?: string
        [key: string]: unknown
      }
      expect(body.message).toBe('success')
      expect(body.user).toEqual(mockUser)
    })

    it('should redirect unauthenticated browser requests to login', async () => {
      vi.mocked(mockAuthClient.verifyRequest).mockResolvedValue(null)

      app.get('/protected', multiAuth, (c) => {
        return c.json({ message: 'should not reach here' })
      })

      const res = await app.request(
        '/protected',
        {
          headers: {
            Accept: 'text/html',
          },
        },
        { env }
      )

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/auth/login')
    })

    it('should return JSON error for unauthenticated API requests', async () => {
      vi.mocked(mockAuthClient.verifyRequest).mockResolvedValue(null)

      app.get('/api/protected', multiAuth, (c) => {
        return c.json({ message: 'should not reach here' })
      })

      const res = await app.request(
        '/api/protected',
        {
          headers: {
            Accept: 'application/json',
          },
        },
        { env }
      )

      expect(res.status).toBe(401)
      const body = (await res.json()) as {
        error?: string
        message?: string
        [key: string]: unknown
      }
      expect(body.error).toBe('Authentication required')
      expect(body.login_url).toBe(
        'https://auth.vibebase.workers.dev/auth/login?origin=https%3A%2F%2Ftest.example.com&redirect_to=%2F'
      )
    })

    it('should handle auth service unavailable', async () => {
      app.use('*', async (c, next) => {
        c.set('authClient', undefined)
        await next()
      })

      app.get('/protected', multiAuth, (c) => {
        return c.json({ message: 'should not reach here' })
      })

      const res = await app.request('/protected', {}, { env })

      expect(res.status).toBe(503)
      const body = (await res.json()) as {
        error?: string
        message?: string
        [key: string]: unknown
      }
      expect(body.error).toBe('Authentication service unavailable')
    })

    it('should handle auth service errors', async () => {
      vi.mocked(mockAuthClient.verifyRequest).mockRejectedValue(new Error('Service error'))

      app.get('/protected', multiAuth, (c) => {
        return c.json({ message: 'should not reach here' })
      })

      const res = await app.request('/protected', {}, { env })

      expect(res.status).toBe(503)
      const body = (await res.json()) as {
        error?: string
        message?: string
        [key: string]: unknown
      }
      expect(body.error).toBe('Authentication service error')
    })
  })

  describe('getCurrentUser', () => {
    it('should return user when set in context', async () => {
      const mockUser = {
        id: '12345',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin'],
        provider: 'github',
        provider_id: '12345',
        role: 'admin',
        is_active: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      }

      app.get('/user', (c) => {
        c.set('user', mockUser)
        const user = getCurrentUser(c)
        return c.json({ user })
      })

      const res = await app.request('/user', {}, { env })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { user: typeof mockUser }
      expect(body.user).toEqual(mockUser)
    })

    it('should return null when no user in context', async () => {
      app.get('/user', (c) => {
        const user = getCurrentUser(c)
        return c.json({ user })
      })

      const res = await app.request('/user', {}, { env })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { user: null }
      expect(body.user).toBeNull()
    })
  })
})
