import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { multiAuth } from '../../middleware/auth'
import { APIKeyManager } from '../../lib/api-key-manager'
import { VibebaseAuthClient } from '../../lib/auth-client'
import type { Env, Variables } from '../../types'

// Mock APIKeyManager
vi.mock('../../lib/api-key-manager', () => ({
  APIKeyManager: vi.fn(),
  API_SCOPES: {}
}))

describe('Multi-Auth Middleware', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let mockEnv: Env
  let mockAPIKeyManager: any
  let mockAuthClient: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    app = new Hono()
    
    mockAPIKeyManager = {
      verifyAPIKey: vi.fn()
    }
    
    // Mock the APIKeyManager constructor to return our mock
    vi.mocked(APIKeyManager).mockImplementation(() => mockAPIKeyManager)
    
    mockAuthClient = {
      verifyRequest: vi.fn(),
      verifyJWT: vi.fn(),
      getLoginUrl: vi.fn().mockReturnValue('/auth/login')
    }
    
    mockEnv = {
      DB: {} as any,
      SESSIONS: {} as any,
      SYSTEM_STORAGE: {} as any,
      USER_STORAGE: {} as any,
      ASSETS: { fetch: vi.fn() } as any,
      VIBEBASE_AUTH_URL: 'https://auth.example.com',
      DEPLOYMENT_DOMAIN: 'example.com',
      WORKER_NAME: 'test-worker',
      ENVIRONMENT: 'development'
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
        scopes: ['data:read'],
        created_by: 'admin-123',
        is_active: true
      }

      mockAPIKeyManager.verifyAPIKey.mockResolvedValue(mockAPIKey)

      const response = await app.request('/test', {
        headers: {
          'Authorization': 'Bearer vb_live_test-key'
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.authContext).toEqual({ type: 'api_key', apiKey: mockAPIKey })
      expect(data.user).toBeUndefined()
      expect(mockAPIKeyManager.verifyAPIKey).toHaveBeenCalledWith('vb_live_test-key')
    })

    it('should reject invalid API key', async () => {
      mockAPIKeyManager.verifyAPIKey.mockResolvedValue(null)

      const response = await app.request('/test', {
        headers: {
          'Authorization': 'Bearer vb_live_invalid-key'
        }
      })

      expect(response.status).toBe(401)
      const data = await response.json() as any
      expect(data.error).toBe('Invalid API key')
    })

    it('should handle API key verification errors', async () => {
      mockAPIKeyManager.verifyAPIKey.mockRejectedValue(new Error('Database error'))

      const response = await app.request('/test', {
        headers: {
          'Authorization': 'Bearer vb_live_test-key'
        }
      })

      expect(response.status).toBe(401)
      const data = await response.json() as any
      expect(data.error).toBe('API key authentication failed')
    })
  })

  describe('Admin JWT Authentication', () => {
    it('should authenticate with valid JWT token', async () => {
      const mockUser = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        scope: ['admin']
      }

      mockAuthClient.verifyJWT.mockResolvedValue(mockUser)

      const response = await app.request('/test', {
        headers: {
          'Authorization': 'Bearer jwt-token-here'
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.user).toEqual(mockUser)
      expect(data.authContext).toEqual({ type: 'admin', user: mockUser })
      expect(data.apiKey).toBeUndefined()
    })

    it('should reject invalid JWT token', async () => {
      mockAuthClient.verifyJWT.mockResolvedValue(null)

      const response = await app.request('/test', {
        headers: {
          'Authorization': 'Bearer invalid-jwt-token'
        }
      })

      expect(response.status).toBe(401)
      const data = await response.json() as any
      expect(data.error).toBe('Invalid JWT token')
    })

    it('should handle JWT verification errors', async () => {
      mockAuthClient.verifyJWT.mockRejectedValue(new Error('Auth service error'))

      const response = await app.request('/test', {
        headers: {
          'Authorization': 'Bearer jwt-token-here'
        }
      })

      expect(response.status).toBe(401)
      const data = await response.json() as any
      expect(data.error).toBe('JWT authentication failed')
    })
  })

  describe('Cookie Authentication Fallback', () => {
    it('should authenticate with valid session cookie', async () => {
      const mockUser = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        scope: ['admin']
      }

      mockAuthClient.verifyRequest.mockResolvedValue(mockUser)

      const response = await app.request('/test', {
        headers: {
          'Cookie': 'session=valid-session-token'
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.user).toEqual(mockUser)
    })

    it('should redirect to login when no authentication provided', async () => {
      mockAuthClient.verifyRequest.mockResolvedValue(null)
      
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
        scopes: ['data:read'],
        created_by: 'admin-123',
        is_active: true
      }

      const mockUser = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        scope: ['admin']
      }

      mockAPIKeyManager.verifyAPIKey.mockResolvedValue(mockAPIKey)
      mockAuthClient.verifyJWT.mockResolvedValue(mockUser)

      const response = await app.request('/test', {
        headers: {
          'Authorization': 'Bearer vb_live_test-key',
          'Cookie': 'session=valid-session-token'
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
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
          'Authorization': 'Bearer vb_live_test-key'
        }
      })

      expect(response.status).toBe(401)
      const data = await response.json() as any
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
          'Authorization': 'Bearer jwt-token-here'
        }
      })

      expect(response.status).toBe(503)
      const data = await response.json() as any
      expect(data.error).toBe('Authentication service unavailable')
    })
  })
})