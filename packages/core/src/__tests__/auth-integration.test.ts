import { describe, it, expect, vi, beforeEach } from 'vitest'
import { unstable_dev } from 'wrangler'
import type { UnstableDevWorker } from 'wrangler'

// Integration tests for the full authentication flow
describe.skip('Authentication Integration', () => {
  let worker: UnstableDevWorker

  beforeEach(async () => {
    // Mock fetch for external calls to vibebase-auth
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    // Setup default responses for vibebase-auth
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/.well-known/jwks.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            keys: [{
              x5c: ['mock-public-key'],
              n: 'mock-modulus'
            }]
          })
        })
      }
      
      if (url.includes('/auth/refresh')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            token_type: 'Bearer',
            expires_in: 900
          })
        })
      }

      return Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found')
      })
    })

    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      env: {
        VIBEBASE_AUTH_URL: 'https://auth.vibebase.workers.dev',
        DEPLOYMENT_DOMAIN: 'test.example.com',
        WORKER_NAME: 'test-worker',
        ENVIRONMENT: 'test'
      }
    })
  })

  afterEach(async () => {
    await worker.stop()
    vi.restoreAllMocks()
  })

  describe('Unauthenticated access', () => {
    it('should redirect to login for protected routes', async () => {
      const resp = await worker.fetch('/', {
        redirect: 'manual'
      })

      expect(resp.status).toBe(200)
      const body = await resp.text()
      expect(body).toContain('GitHubでログイン')
      expect(body).toContain('ログインが必要です')
    })

    it('should allow access to auth routes', async () => {
      const resp = await worker.fetch('/auth/status')

      expect(resp.status).toBe(200)
      const body = await resp.json()
      expect(body.authenticated).toBe(false)
      expect(body.user).toBeNull()
    })

    it('should allow access to static assets', async () => {
      const resp = await worker.fetch('/assets/test.js')

      // Should not be redirected to login
      expect(resp.status).not.toBe(302)
    })

    it('should return JSON error for API requests', async () => {
      const resp = await worker.fetch('/api/tables')

      expect(resp.status).toBe(401)
      const body = await resp.json()
      expect(body.error).toBe('Authentication required')
      expect(body.login_url).toContain('auth.vibebase.workers.dev')
    })
  })

  describe('Authentication flow', () => {
    it('should redirect to vibebase-auth on login', async () => {
      const resp = await worker.fetch('/auth/login', {
        redirect: 'manual'
      })

      expect(resp.status).toBe(302)
      const location = resp.headers.get('Location')
      expect(location).toContain('auth.vibebase.workers.dev/auth/login')
      expect(location).toContain('origin=https%3A%2F%2Ftest.example.com')
    })

    it('should handle successful authentication callback', async () => {
      // Create a valid JWT token for testing
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

      const mockToken = 'header.' + btoa(JSON.stringify(mockPayload)) + '.signature'
      const mockRefreshToken = 'refresh.' + btoa(JSON.stringify(mockPayload)) + '.signature'

      const resp = await worker.fetch(`/auth/callback?token=${mockToken}&refresh_token=${mockRefreshToken}`, {
        redirect: 'manual'
      })

      expect(resp.status).toBe(302)
      expect(resp.headers.get('Location')).toBe('/')

      // Check that cookies are set
      const setCookieHeaders = resp.headers.getSetCookie?.() || []
      expect(setCookieHeaders.some(cookie => cookie.includes('access_token='))).toBe(true)
      expect(setCookieHeaders.some(cookie => cookie.includes('refresh_token='))).toBe(true)
    })

    it('should handle authentication callback with invalid token', async () => {
      const resp = await worker.fetch('/auth/callback?token=invalid&refresh_token=invalid')

      expect(resp.status).toBe(200)
      const body = await resp.text()
      expect(body).toContain('認証エラー')
    })

    it('should handle logout', async () => {
      const resp = await worker.fetch('/auth/logout', {
        method: 'POST'
      })

      expect(resp.status).toBe(200)
      const body = await resp.json()
      expect(body.success).toBe(true)

      // Check that cookies are cleared
      const setCookieHeaders = resp.headers.getSetCookie?.() || []
      expect(setCookieHeaders.some(cookie => cookie.includes('Max-Age=0'))).toBe(true)
    })
  })

  describe('Authenticated access', () => {
    let authCookies: string

    beforeEach(() => {
      // Create valid authentication cookies for testing
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

      const mockToken = 'header.' + btoa(JSON.stringify(mockPayload)) + '.signature'
      const mockRefreshToken = 'refresh.' + btoa(JSON.stringify(mockPayload)) + '.signature'
      
      authCookies = `access_token=${mockToken}; refresh_token=${mockRefreshToken}`
    })

    it('should allow access to protected routes with valid token', async () => {
      const resp = await worker.fetch('/', {
        headers: {
          'Cookie': authCookies
        }
      })

      expect(resp.status).toBe(200)
      const body = await resp.text()
      expect(body).toContain('<div id="app"></div>')
      expect(body).toContain('VIBEBASE_AUTH')
    })

    it('should return user info for authenticated requests', async () => {
      const resp = await worker.fetch('/auth/me', {
        headers: {
          'Cookie': authCookies
        }
      })

      expect(resp.status).toBe(200)
      const body = await resp.json()
      expect(body.user).toEqual({
        id: 12345,
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin']
      })
    })

    it('should allow access to API endpoints', async () => {
      const resp = await worker.fetch('/api/tables', {
        headers: {
          'Cookie': authCookies
        }
      })

      // Should not return authentication error
      expect(resp.status).not.toBe(401)
      expect(resp.status).not.toBe(403)
    })

    it('should handle token refresh automatically', async () => {
      // Test with only refresh token (simulating expired access token)
      const refreshOnlyCookie = authCookies.replace(/access_token=[^;]+;?\s*/, '')

      const resp = await worker.fetch('/auth/status', {
        headers: {
          'Cookie': refreshOnlyCookie
        }
      })

      expect(resp.status).toBe(200)
      
      // Should have set new cookies
      const setCookieHeaders = resp.headers.getSetCookie?.() || []
      expect(setCookieHeaders.some(cookie => cookie.includes('access_token=new-access-token'))).toBe(true)
    })
  })

  describe('Security', () => {
    it('should reject tokens with wrong audience', async () => {
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

      const mockToken = 'header.' + btoa(JSON.stringify(mockPayload)) + '.signature'
      const authCookies = `access_token=${mockToken}`

      const resp = await worker.fetch('/auth/me', {
        headers: {
          'Cookie': authCookies
        }
      })

      expect(resp.status).toBe(401)
    })

    it('should reject expired tokens', async () => {
      const mockPayload = {
        iss: 'https://auth.vibebase.workers.dev',
        aud: 'test.example.com',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired
        iat: Math.floor(Date.now() / 1000) - 7200,
        token_type: 'access',
        github_id: 12345,
        github_login: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        scope: ['admin']
      }

      const mockToken = 'header.' + btoa(JSON.stringify(mockPayload)) + '.signature'
      const authCookies = `access_token=${mockToken}`

      const resp = await worker.fetch('/auth/me', {
        headers: {
          'Cookie': authCookies
        }
      })

      expect(resp.status).toBe(401)
    })

    it('should set secure cookie attributes in production', async () => {
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

      const mockToken = 'header.' + btoa(JSON.stringify(mockPayload)) + '.signature'
      const mockRefreshToken = 'refresh.' + btoa(JSON.stringify(mockPayload)) + '.signature'

      const resp = await worker.fetch(`/auth/callback?token=${mockToken}&refresh_token=${mockRefreshToken}`, {
        redirect: 'manual'
      })

      const setCookieHeaders = resp.headers.getSetCookie?.() || []
      
      // Should have secure attributes
      expect(setCookieHeaders.some(cookie => 
        cookie.includes('HttpOnly') && 
        cookie.includes('Secure') && 
        cookie.includes('SameSite=Strict')
      )).toBe(true)
    })
  })
})