import type { D1Database } from '@cloudflare/workers-types'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APIKeyManager } from '../../lib/api-key-manager'
import type { User, VibebaseAuthClient } from '../../lib/auth-client'
import { multiAuth } from '../../middleware/auth'
import type { Env, Variables } from '../../types'
import type { R2Bucket as CustomR2Bucket, KVNamespace } from '../../types/cloudflare'

// Mock APIKeyManager
vi.mock('../../lib/api-key-manager', () => ({
  APIKeyManager: vi.fn(),
  API_SCOPES: {},
}))

describe('Multi-Auth Middleware', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let mockEnv: Env
  let mockAPIKeyManager: APIKeyManager
  let mockAuthClient: VibebaseAuthClient

  beforeEach(() => {
    vi.clearAllMocks()

    app = new Hono()

    mockAPIKeyManager = {
      verifyAPIKey: vi.fn(),
    } as unknown as APIKeyManager

    // Mock the APIKeyManager constructor to return our mock
    vi.mocked(APIKeyManager).mockImplementation(() => mockAPIKeyManager as APIKeyManager)

    mockAuthClient = {
      verifyRequest: vi.fn(),
      verifyJWT: vi.fn(),
      getLoginUrl: vi.fn().mockReturnValue('/auth/login'),
    } as unknown as VibebaseAuthClient

    mockEnv = {
      DB: {} as unknown as D1Database,
      SESSIONS: {} as unknown as KVNamespace,
      SYSTEM_STORAGE: {} as unknown as CustomR2Bucket,
      USER_STORAGE: {} as unknown as CustomR2Bucket,
      ASSETS: { fetch: vi.fn(() => Promise.resolve(new Response('mock asset'))) },
      VIBEBASE_AUTH_URL: 'https://auth.example.com',
      WORKER_DOMAIN: 'example.com',
      ENVIRONMENT: 'development',
    }

    // Setup middleware
    app.use('*', async (c, next) => {
      c.env = mockEnv
      c.set('apiKeyManager', mockAPIKeyManager)
      c.set('authClient', mockAuthClient)
      await next()
    })

    app.use('*', multiAuth)

    app.get('/test', (c) => {
      const user = c.get('user')
      const apiKey = c.get('apiKey')
      const authContext = c.get('authContext')
      return c.json({ user, apiKey, authContext, success: true })
    })
  })

  describe('API Key Authentication', () => {
    it('should authenticate with valid API key', async () => {
      const mockAPIKey = {
        id: 'key-123',
        name: 'Test Key',
        key_hash: 'hash123',
        key_prefix: 'vb_live_',
        scopes: ['data:read'],
        created_by: 'admin-123',
        created_at: '2023-01-01T00:00:00.000Z',
        last_used_at: null,
        expires_at: null,
        is_active: true,
      }

      vi.mocked(mockAPIKeyManager.verifyAPIKey).mockResolvedValue(mockAPIKey)

      const response = await app.request('/test', {
        headers: {
          Authorization: 'Bearer vb_live_test-key',
        },
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as {
        user?: unknown
        apiKey?: unknown
        authContext?: unknown
        success?: boolean
        error?: string
      }
      expect(data.authContext).toEqual({ type: 'api_key', apiKey: mockAPIKey })
      expect(data.user).toBeUndefined()
      expect(mockAPIKeyManager.verifyAPIKey).toHaveBeenCalledWith('vb_live_test-key')
    })

    it('should reject invalid API key', async () => {
      vi.mocked(mockAPIKeyManager.verifyAPIKey).mockResolvedValue(null)

      const response = await app.request('/test', {
        headers: {
          Authorization: 'Bearer vb_live_invalid-key',
        },
      })

      expect(response.status).toBe(401)
      const data = (await response.json()) as {
        user?: unknown
        apiKey?: unknown
        authContext?: unknown
        success?: boolean
        error?: string
      }
      expect(data.error).toBe('Invalid API key')
    })

    it('should handle API key verification errors', async () => {
      vi.mocked(mockAPIKeyManager.verifyAPIKey).mockRejectedValue(new Error('Database error'))

      const response = await app.request('/test', {
        headers: {
          Authorization: 'Bearer vb_live_test-key',
        },
      })

      expect(response.status).toBe(401)
      const data = (await response.json()) as {
        user?: unknown
        apiKey?: unknown
        authContext?: unknown
        success?: boolean
        error?: string
      }
      expect(data.error).toBe('API key authentication failed')
    })
  })

  describe('Admin JWT Authentication', () => {
    it('should authenticate with valid JWT token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        provider: 'github',
        provider_id: '123456',
        role: 'admin',
        metadata: undefined,
        last_login_at: '2023-01-01T00:00:00.000Z',
        is_active: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        username: 'testuser',
        scope: ['admin'],
      }

      vi.mocked(mockAuthClient.verifyJWT).mockResolvedValue(mockUser as User)

      const response = await app.request('/test', {
        headers: {
          Authorization: 'Bearer jwt-token-here',
        },
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as {
        user?: unknown
        apiKey?: unknown
        authContext?: unknown
        success?: boolean
        error?: string
      }
      expect(data.user).toEqual(mockUser)
      expect(data.authContext).toEqual({ type: 'admin', user: mockUser })
      expect(data.apiKey).toBeUndefined()
    })

    it('should reject invalid JWT token', async () => {
      vi.mocked(mockAuthClient.verifyJWT).mockResolvedValue(null)

      const response = await app.request('/test', {
        headers: {
          Authorization: 'Bearer invalid-jwt-token',
        },
      })

      expect(response.status).toBe(401)
      const data = (await response.json()) as {
        user?: unknown
        apiKey?: unknown
        authContext?: unknown
        success?: boolean
        error?: string
      }
      expect(data.error).toBe('Invalid JWT token')
    })

    it('should handle JWT verification errors', async () => {
      vi.mocked(mockAuthClient.verifyJWT).mockRejectedValue(new Error('Auth service error'))

      const response = await app.request('/test', {
        headers: {
          Authorization: 'Bearer jwt-token-here',
        },
      })

      expect(response.status).toBe(401)
      const data = (await response.json()) as {
        user?: unknown
        apiKey?: unknown
        authContext?: unknown
        success?: boolean
        error?: string
      }
      expect(data.error).toBe('JWT authentication failed')
    })
  })

  describe('Cookie Authentication Fallback', () => {
    it('should authenticate with valid session cookie', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        provider: 'github',
        provider_id: '123456',
        role: 'admin',
        metadata: undefined,
        last_login_at: '2023-01-01T00:00:00.000Z',
        is_active: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        username: 'testuser',
        scope: ['admin'],
      }

      vi.mocked(mockAuthClient.verifyRequest).mockResolvedValue(mockUser as User)

      const response = await app.request('/test', {
        headers: {
          Cookie: 'session=valid-session-token',
        },
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as {
        user?: unknown
        apiKey?: unknown
        authContext?: unknown
        success?: boolean
        error?: string
      }
      expect(data.user).toEqual(mockUser)
    })

    it('should redirect to login when no authentication provided', async () => {
      vi.mocked(mockAuthClient.verifyRequest).mockResolvedValue(null)

      const response = await app.request('/test')

      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toContain('/auth/login')
    })
  })

  describe('Authentication Priority', () => {
    it('should prioritize API key over JWT when both provided', async () => {
      const mockAPIKey = {
        id: 'key-123',
        name: 'Test Key',
        key_hash: 'hash123',
        key_prefix: 'vb_live_',
        scopes: ['data:read'],
        created_by: 'admin-123',
        created_at: '2023-01-01T00:00:00.000Z',
        last_used_at: null,
        expires_at: null,
        is_active: true,
      }

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        provider: 'github',
        provider_id: '123456',
        role: 'admin',
        metadata: undefined,
        last_login_at: '2023-01-01T00:00:00.000Z',
        is_active: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        username: 'testuser',
        scope: ['admin'],
      }

      vi.mocked(mockAPIKeyManager.verifyAPIKey).mockResolvedValue(mockAPIKey)
      vi.mocked(mockAuthClient.verifyJWT).mockResolvedValue(mockUser as User)

      const response = await app.request('/test', {
        headers: {
          Authorization: 'Bearer vb_live_test-key',
          Cookie: 'session=valid-session-token',
        },
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as {
        user?: unknown
        apiKey?: unknown
        authContext?: unknown
        success?: boolean
        error?: string
      }
      expect(data.authContext).toEqual({ type: 'api_key', apiKey: mockAPIKey })
      expect(data.user).toBeUndefined()
      expect(mockAPIKeyManager.verifyAPIKey).toHaveBeenCalled()
      expect(mockAuthClient.verifyJWT).not.toHaveBeenCalled()
    })
  })

  describe('Missing Dependencies', () => {
    it('should handle missing API key manager', async () => {
      app = new Hono()
      app.use('*', async (c, next) => {
        c.env = mockEnv
        // Don't set apiKeyManager
        c.set('authClient', mockAuthClient)
        await next()
      })
      app.use('*', multiAuth)
      app.get('/test', (c) => c.json({ success: true }))

      const response = await app.request('/test', {
        headers: {
          Authorization: 'Bearer vb_live_test-key',
        },
      })

      expect(response.status).toBe(401)
      const data = (await response.json()) as {
        user?: unknown
        apiKey?: unknown
        authContext?: unknown
        success?: boolean
        error?: string
      }
      expect(data.error).toBe('Invalid API key')
    })

    it('should handle missing auth client', async () => {
      app = new Hono()
      app.use('*', async (c, next) => {
        c.env = mockEnv
        c.set('apiKeyManager', mockAPIKeyManager)
        // Don't set authClient
        await next()
      })
      app.use('*', multiAuth)
      app.get('/test', (c) => c.json({ success: true }))

      const response = await app.request('/test', {
        headers: {
          Authorization: 'Bearer jwt-token-here',
        },
      })

      expect(response.status).toBe(503)
      const data = (await response.json()) as {
        user?: unknown
        apiKey?: unknown
        authContext?: unknown
        success?: boolean
        error?: string
      }
      expect(data.error).toBe('Authentication service unavailable')
    })
  })
})
