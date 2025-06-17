import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { requireAuth, optionalAuth, getCurrentUser } from '../../middleware/auth'
import { VibebaseAuthClient } from '../../lib/auth-client'
import type { Env, Variables } from '../../types'

// Mock VibebaseAuthClient
vi.mock('../../lib/auth-client')

describe('Auth Middleware', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let env: Env
  let mockAuthClient: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    env = {
      VIBEBASE_AUTH_URL: 'https://auth.vibebase.workers.dev',
      DEPLOYMENT_DOMAIN: 'test.example.com',
      WORKER_NAME: 'test-worker',
      ENVIRONMENT: 'development',
      DB: {} as any,
      SESSIONS: {} as any,
      SYSTEM_STORAGE: {} as any,
      USER_STORAGE: {} as any,
      ASSETS: {
        fetch: vi.fn(() => Promise.resolve(new Response('mock asset')))
      }
    }

    mockAuthClient = {
      verifyRequest: vi.fn(),
      getLoginUrl: vi.fn().mockReturnValue('https://auth.vibebase.workers.dev/auth/login?origin=https%3A%2F%2Ftest.example.com&redirect_to=%2F')
    }

    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    
    // Setup middleware to inject mock auth client
    app.use('*', async (c, next) => {
      c.set('authClient', mockAuthClient)
      await next()
    })
  })

  describe('requireAuth', () => {
    it('should allow authenticated requests', async () => {
      const mockUser = {
        id: 12345,
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin']
      }

      mockAuthClient.verifyRequest.mockResolvedValue(mockUser)

      app.get('/protected', requireAuth, (c) => {
        const user = getCurrentUser(c)
        return c.json({ message: 'success', user })
      })

      const res = await app.request('/protected', {}, { env })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.message).toBe('success')
      expect(body.user).toEqual(mockUser)
    })

    it('should redirect unauthenticated browser requests to login', async () => {
      mockAuthClient.verifyRequest.mockResolvedValue(null)

      app.get('/protected', requireAuth, (c) => {
        return c.json({ message: 'should not reach here' })
      })

      const res = await app.request('/protected', {
        headers: {
          'Accept': 'text/html'
        }
      }, { env })

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('https://auth.vibebase.workers.dev/auth/login?origin=https%3A%2F%2Ftest.example.com&redirect_to=%2F')
    })

    it('should return JSON error for unauthenticated API requests', async () => {
      mockAuthClient.verifyRequest.mockResolvedValue(null)

      app.get('/api/protected', requireAuth, (c) => {
        return c.json({ message: 'should not reach here' })
      })

      const res = await app.request('/api/protected', {
        headers: {
          'Accept': 'application/json'
        }
      }, { env })

      expect(res.status).toBe(401)
      const body = await res.json() as any
      expect(body.error).toBe('Authentication required')
      expect(body.login_url).toBe('https://auth.vibebase.workers.dev/auth/login?origin=https%3A%2F%2Ftest.example.com&redirect_to=%2F')
    })

    it('should handle auth service unavailable', async () => {
      app.use('*', async (c, next) => {
        c.set('authClient', undefined)
        await next()
      })

      app.get('/protected', requireAuth, (c) => {
        return c.json({ message: 'should not reach here' })
      })

      const res = await app.request('/protected', {}, { env })

      expect(res.status).toBe(503)
      const body = await res.json() as any
      expect(body.error).toBe('Authentication service unavailable')
    })

    it('should handle auth service errors', async () => {
      mockAuthClient.verifyRequest.mockRejectedValue(new Error('Service error'))

      app.get('/protected', requireAuth, (c) => {
        return c.json({ message: 'should not reach here' })
      })

      const res = await app.request('/protected', {}, { env })

      expect(res.status).toBe(503)
      const body = await res.json() as any
      expect(body.error).toBe('Authentication service error')
    })
  })

  describe('optionalAuth', () => {
    it('should set user for authenticated requests', async () => {
      const mockUser = {
        id: 12345,
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin']
      }

      mockAuthClient.verifyRequest.mockResolvedValue(mockUser)

      app.get('/optional', optionalAuth, (c) => {
        const user = getCurrentUser(c)
        return c.json({ user })
      })

      const res = await app.request('/optional', {}, { env })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.user).toEqual(mockUser)
    })

    it('should continue without user for unauthenticated requests', async () => {
      mockAuthClient.verifyRequest.mockResolvedValue(null)

      app.get('/optional', optionalAuth, (c) => {
        const user = getCurrentUser(c)
        return c.json({ user })
      })

      const res = await app.request('/optional', {}, { env })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.user).toBeNull()
    })

    it('should continue when auth client is unavailable', async () => {
      app.use('*', async (c, next) => {
        c.set('authClient', undefined)
        await next()
      })

      app.get('/optional', optionalAuth, (c) => {
        const user = getCurrentUser(c)
        return c.json({ user })
      })

      const res = await app.request('/optional', {}, { env })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.user).toBeNull()
    })

    it('should continue when auth service throws error', async () => {
      mockAuthClient.verifyRequest.mockRejectedValue(new Error('Service error'))

      app.get('/optional', optionalAuth, (c) => {
        const user = getCurrentUser(c)
        return c.json({ user })
      })

      const res = await app.request('/optional', {}, { env })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.user).toBeNull()
    })
  })

  describe('getCurrentUser', () => {
    it('should return user when set in context', async () => {
      const mockUser = {
        id: 12345,
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin']
      }

      app.get('/user', (c) => {
        c.set('user', mockUser)
        const user = getCurrentUser(c)
        return c.json({ user })
      })

      const res = await app.request('/user', {}, { env })
      expect(res.status).toBe(200)
      const body = await res.json() as { user: typeof mockUser }
      expect(body.user).toEqual(mockUser)
    })

    it('should return null when no user in context', async () => {
      app.get('/user', (c) => {
        const user = getCurrentUser(c)
        return c.json({ user })
      })

      const res = await app.request('/user', {}, { env })
      expect(res.status).toBe(200)
      const body = await res.json() as { user: null }
      expect(body.user).toBeNull()
    })
  })
})