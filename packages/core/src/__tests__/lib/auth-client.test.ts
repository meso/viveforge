import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VibebaseAuthClient } from '../../lib/auth-client'
import type { Env } from '../../types'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock hono/jwt verify function
const mockVerify = vi.fn()
vi.mock('hono/jwt', () => ({
  jwt: vi.fn(),
  verify: mockVerify
}))

describe('VibebaseAuthClient', () => {
  let authClient: VibebaseAuthClient
  let env: Env

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

    authClient = new VibebaseAuthClient(env)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getLoginUrl', () => {
    it('should generate correct login URL with default redirect', () => {
      const loginUrl = authClient.getLoginUrl()
      
      expect(loginUrl).toBe(
        'https://auth.vibebase.workers.dev/auth/login?origin=https%3A%2F%2Ftest.example.com&redirect_to=%2F'
      )
    })

    it('should generate correct login URL with custom redirect', () => {
      const loginUrl = authClient.getLoginUrl('/dashboard')
      
      expect(loginUrl).toBe(
        'https://auth.vibebase.workers.dev/auth/login?origin=https%3A%2F%2Ftest.example.com&redirect_to=%2Fdashboard'
      )
    })
  })

  describe('verifyToken', () => {
    beforeEach(() => {
      // Mock JWKS endpoint
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          keys: [{
            x5c: ['mock-public-key'],
            n: 'mock-modulus'
          }]
        })
      })
    })

    it('should verify valid token successfully', async () => {
      const mockPayload = {
        iss: 'https://auth.vibebase.workers.dev',
        aud: 'test.example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        token_type: 'access',
        github_id: 12345,
        github_login: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin']
      }

      // Mock hono/jwt verify to return the payload
      mockVerify.mockResolvedValue(mockPayload)

      const mockToken = 'valid.jwt.token'

      const user = await authClient.verifyToken(mockToken)

      expect(user).toMatchObject({
        id: '12345',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin'],
        provider: 'github',
        provider_id: '12345',
        role: 'user',
        is_active: true
      })
    })

    it('should reject token with wrong audience', async () => {
      const mockPayload = {
        iss: 'https://auth.vibebase.workers.dev',
        aud: 'wrong.example.com', // Wrong domain
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        token_type: 'access',
        github_id: 12345,
        github_login: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin']
      }

      // Mock hono/jwt verify to return the payload
      mockVerify.mockResolvedValue(mockPayload)

      const mockToken = 'valid.jwt.token'

      await expect(authClient.verifyToken(mockToken)).rejects.toThrow(
        'Invalid audience: expected test.example.com, got wrong.example.com'
      )
    })

    it('should reject expired token', async () => {
      const mockPayload = {
        iss: 'https://auth.vibebase.workers.dev',
        aud: 'test.example.com',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
        token_type: 'access',
        github_id: 12345,
        github_login: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin']
      }

      // Mock hono/jwt verify to return the payload
      mockVerify.mockResolvedValue(mockPayload)

      const mockToken = 'valid.jwt.token'

      await expect(authClient.verifyToken(mockToken)).rejects.toThrow('Token expired')
    })

    it('should reject token with wrong issuer', async () => {
      const mockPayload = {
        iss: 'https://malicious.example.com', // Wrong issuer
        aud: 'test.example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        token_type: 'access',
        github_id: 12345,
        github_login: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin']
      }

      // Mock hono/jwt verify to return the payload
      mockVerify.mockResolvedValue(mockPayload)

      const mockToken = 'valid.jwt.token'

      await expect(authClient.verifyToken(mockToken)).rejects.toThrow('Invalid issuer')
    })

    it('should reject malformed JWT', async () => {
      // Mock hono/jwt verify to throw an error for malformed JWT
      mockVerify.mockRejectedValue(new Error('Invalid JWT format'))

      const malformedToken = 'not.a.valid.jwt.token'

      await expect(authClient.verifyToken(malformedToken)).rejects.toThrow('JWT verification failed')
    })
  })

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_in: 900
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse)
      })

      const result = await authClient.refreshToken('old-refresh-token')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.vibebase.workers.dev/auth/refresh',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            refresh_token: 'old-refresh-token'
          })
        }
      )

      expect(result).toEqual(mockResponse)
    })

    it('should handle refresh token failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('{"error":"Token refresh failed"}')
      })

      await expect(authClient.refreshToken('invalid-token')).rejects.toThrow(
        'Token refresh failed: 401 - {"error":"Token refresh failed"}'
      )
    })
  })

  describe('verifyRequest', () => {
    let mockContext: any

    beforeEach(() => {
      mockContext = {
        req: {
          header: vi.fn(),
          raw: {
            headers: {
              get: vi.fn()
            }
          }
        },
        res: {
          headers: {
            append: vi.fn()
          }
        }
      }

      // Mock JWKS endpoint
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          keys: [{
            x5c: ['mock-public-key'],
            n: 'mock-modulus'
          }]
        })
      })
    })

    it('should verify request with Authorization header', async () => {
      const mockPayload = {
        iss: 'https://auth.vibebase.workers.dev',
        aud: 'test.example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        token_type: 'access',
        github_id: 12345,
        github_login: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin']
      }

      // Mock hono/jwt verify to return the payload
      mockVerify.mockResolvedValue(mockPayload)

      const mockToken = 'valid.jwt.token'
      
      mockContext.req.header.mockReturnValue(`Bearer ${mockToken}`)
      mockContext.req.raw.headers.get.mockReturnValue(null)

      const user = await authClient.verifyRequest(mockContext)

      expect(user).toMatchObject({
        id: '12345',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin'],
        provider: 'github',
        provider_id: '12345',
        role: 'user',
        is_active: true
      })
    })

    it('should verify request with Cookie header', async () => {
      const mockPayload = {
        iss: 'https://auth.vibebase.workers.dev',
        aud: 'test.example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        token_type: 'access',
        github_id: 12345,
        github_login: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin']
      }

      // Mock hono/jwt verify to return the payload
      mockVerify.mockResolvedValue(mockPayload)

      const mockToken = 'valid.jwt.token'
      
      mockContext.req.header.mockReturnValue(null)
      mockContext.req.raw.headers.get.mockReturnValue(`access_token=${mockToken}; other=value`)

      const user = await authClient.verifyRequest(mockContext)

      expect(user).toMatchObject({
        id: '12345',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin'],
        provider: 'github',
        provider_id: '12345',
        role: 'user',
        is_active: true
      })
    })

    it('should return null for request with no authentication', async () => {
      mockContext.req.header.mockReturnValue(null)
      mockContext.req.raw.headers.get.mockReturnValue(null)

      const user = await authClient.verifyRequest(mockContext)

      expect(user).toBeNull()
    })

    it('should handle token refresh when access_token is missing but refresh_token exists', async () => {
      const refreshToken = 'valid-refresh-token'
      const newTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_in: 900
      }
      
      // Create a spy for the refreshToken method
      const refreshTokenSpy = vi.spyOn(authClient, 'refreshToken').mockResolvedValue(newTokens)
      
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
        updated_at: '2023-01-01T00:00:00.000Z'
      }

      // Create a spy for the verifyToken method
      const verifyTokenSpy = vi.spyOn(authClient, 'verifyToken').mockResolvedValue(mockUser)

      mockContext.req.header.mockReturnValue(null)
      mockContext.req.raw.headers.get.mockReturnValue(`refresh_token=${refreshToken}`)

      const user = await authClient.verifyRequest(mockContext)

      expect(user).toEqual(mockUser)
      expect(refreshTokenSpy).toHaveBeenCalledWith(refreshToken)
      expect(verifyTokenSpy).toHaveBeenCalledWith(newTokens.access_token)

      // Verify that new cookies were set
      expect(mockContext.res.headers.append).toHaveBeenCalledWith(
        'Set-Cookie',
        `access_token=${newTokens.access_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${newTokens.expires_in}; Path=/`
      )
      expect(mockContext.res.headers.append).toHaveBeenCalledWith(
        'Set-Cookie',
        `refresh_token=${newTokens.refresh_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/`
      )
    })
  })
})