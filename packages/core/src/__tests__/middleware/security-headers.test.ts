import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SECURITY_CONFIG,
  DEVELOPMENT_CSP_OVERRIDES,
  getAPISecurityConfig,
  securityHeaders,
} from '../../middleware/security-headers'
import type { Env, Variables } from '../../types'

// Mock environment
const mockEnv: Env = {
  ENVIRONMENT: 'production',
  DB: {} as any,
  SESSIONS: {} as any,
  ASSETS: {} as any,
  SYSTEM_STORAGE: {} as any,
  USER_STORAGE: {} as any,
  JWT_SECRET: 'test-secret',
  VIBEBASE_AUTH_URL: 'https://auth.example.com',
  DEPLOYMENT_DOMAIN: 'example.com',
  WORKER_NAME: 'test-worker',
  DOMAIN: 'example.com',
}

// Test app setup
function createTestApp() {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>()
  return app
}

describe('Security Headers Middleware', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>

  beforeEach(() => {
    app = createTestApp()
  })

  describe('Production Environment', () => {
    it('should set all security headers in production', async () => {
      app.use('*', securityHeaders())
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, { ...mockEnv, ENVIRONMENT: 'production' })

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Security-Policy')).toBeDefined()
      expect(res.headers.get('Strict-Transport-Security')).toBe(
        'max-age=31536000; includeSubDomains; preload'
      )
      expect(res.headers.get('X-Frame-Options')).toBe('DENY')
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block')
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
      expect(res.headers.get('Permissions-Policy')).toBeDefined()
      expect(res.headers.get('Cross-Origin-Embedder-Policy')).toBe('unsafe-none')
      expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups')
      expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin')
    })

    it('should set CSP with production directives', async () => {
      app.use('*', securityHeaders())
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, { ...mockEnv, ENVIRONMENT: 'production' })
      const csp = res.headers.get('Content-Security-Policy')

      expect(csp).toBeDefined()
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("frame-ancestors 'none'")
      expect(csp).toContain('upgrade-insecure-requests')
    })

    it('should include HSTS header in production', async () => {
      app.use('*', securityHeaders())
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, { ...mockEnv, ENVIRONMENT: 'production' })
      const hsts = res.headers.get('Strict-Transport-Security')

      expect(hsts).toBe('max-age=31536000; includeSubDomains; preload')
    })
  })

  describe('Development Environment', () => {
    it('should set security headers but exclude HSTS in development', async () => {
      app.use('*', securityHeaders())
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, { ...mockEnv, ENVIRONMENT: 'development' })

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Security-Policy')).toBeDefined()
      expect(res.headers.get('Strict-Transport-Security')).toBeNull() // Should not be set in dev
      expect(res.headers.get('X-Frame-Options')).toBe('DENY')
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    })

    it('should use development CSP overrides', async () => {
      app.use('*', securityHeaders())
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, { ...mockEnv, ENVIRONMENT: 'development' })
      const csp = res.headers.get('Content-Security-Policy')

      expect(csp).toBeDefined()
      expect(csp).toContain('localhost:*')
      expect(csp).toContain('ws:')
      expect(csp).toContain('http:') // Allow HTTP in development
      // Note: upgrade-insecure-requests is still present in development CSP but without value
    })
  })

  describe('Custom Configuration', () => {
    it('should allow custom security headers configuration', async () => {
      const customConfig = {
        frameOptions: 'SAMEORIGIN' as const,
        contentTypeOptions: false,
        xssProtection: {
          enabled: false,
        },
      }

      app.use('*', securityHeaders(customConfig))
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, mockEnv)

      expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
      expect(res.headers.get('X-Content-Type-Options')).toBeNull()
      expect(res.headers.get('X-XSS-Protection')).toBe('0')
    })

    it('should allow disabling specific headers', async () => {
      const customConfig = {
        frameOptions: undefined,
        referrerPolicy: undefined,
        permissionsPolicy: undefined,
      }

      app.use('*', securityHeaders(customConfig))
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, mockEnv)

      expect(res.headers.get('X-Frame-Options')).toBeNull()
      expect(res.headers.get('Referrer-Policy')).toBeNull()
      expect(res.headers.get('Permissions-Policy')).toBeNull()
    })
  })

  describe('Request Filtering', () => {
    it('should skip security headers for OPTIONS requests', async () => {
      app.use('*', securityHeaders())
      app.options('/test', (c) => c.text('OK'))

      const res = await app.request('/test', { method: 'OPTIONS' }, mockEnv)

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Security-Policy')).toBeNull()
      expect(res.headers.get('X-Frame-Options')).toBeNull()
    })

    it('should skip security headers for static assets', async () => {
      app.use('*', securityHeaders())
      app.get('/assets/test.js', (c) => c.text('console.log("test")'))
      app.get('/favicon.ico', (c) => c.text('favicon'))

      const jsRes = await app.request('/assets/test.js', {}, mockEnv)
      const faviconRes = await app.request('/favicon.ico', {}, mockEnv)

      expect(jsRes.status).toBe(200)
      expect(jsRes.headers.get('Content-Security-Policy')).toBeNull()
      expect(jsRes.headers.get('X-Frame-Options')).toBeNull()

      expect(faviconRes.status).toBe(200)
      expect(faviconRes.headers.get('Content-Security-Policy')).toBeNull()
      expect(faviconRes.headers.get('X-Frame-Options')).toBeNull()
    })
  })

  describe('CSP Report-Only Mode', () => {
    it('should use CSP-Report-Only header when reportOnly is true', async () => {
      const customConfig = {
        contentSecurityPolicy: {
          directives: { 'default-src': ["'self'"] },
          reportOnly: true,
        },
      }

      app.use('*', securityHeaders(customConfig))
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, mockEnv)

      expect(res.headers.get('Content-Security-Policy')).toBeNull()
      expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeDefined()
      expect(res.headers.get('Content-Security-Policy-Report-Only')).toContain("default-src 'self'")
    })
  })

  describe('XSS Protection Variations', () => {
    it('should handle XSS protection with report URI', async () => {
      const customConfig = {
        xssProtection: {
          enabled: true,
          mode: 'block' as const,
          reportUri: '/xss-report',
        },
      }

      app.use('*', securityHeaders(customConfig))
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, mockEnv)

      expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block; report=/xss-report')
    })

    it('should handle disabled XSS protection', async () => {
      const customConfig = {
        xssProtection: {
          enabled: false,
        },
      }

      app.use('*', securityHeaders(customConfig))
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, mockEnv)

      expect(res.headers.get('X-XSS-Protection')).toBe('0')
    })
  })

  describe('Permissions Policy', () => {
    it('should correctly format permissions policy', async () => {
      const customConfig = {
        permissionsPolicy: {
          camera: [],
          microphone: ['self'],
          geolocation: ['self', 'https://example.com'],
        },
      }

      app.use('*', securityHeaders(customConfig))
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, mockEnv)
      const permissionsPolicy = res.headers.get('Permissions-Policy')

      expect(permissionsPolicy).toContain('camera=()')
      expect(permissionsPolicy).toContain('microphone=(self)')
      expect(permissionsPolicy).toContain('geolocation=(self https://example.com)')
    })
  })

  describe('HSTS Configuration', () => {
    it('should format HSTS with all options', async () => {
      const customConfig = {
        strictTransportSecurity: {
          maxAge: 86400,
          includeSubDomains: true,
          preload: true,
        },
      }

      app.use('*', securityHeaders(customConfig))
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, { ...mockEnv, ENVIRONMENT: 'production' })
      const hsts = res.headers.get('Strict-Transport-Security')

      expect(hsts).toBe('max-age=86400; includeSubDomains; preload')
    })

    it('should format HSTS with minimal options', async () => {
      const customConfig = {
        strictTransportSecurity: {
          maxAge: 3600,
        },
      }

      app.use('*', securityHeaders(customConfig))
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, { ...mockEnv, ENVIRONMENT: 'production' })
      const hsts = res.headers.get('Strict-Transport-Security')

      expect(hsts).toBe('max-age=3600')
    })
  })

  describe('API Route Handling', () => {
    it('should use API-specific configuration for API routes', async () => {
      app.use('*', securityHeaders())
      app.get('/api/test', (c) => c.json({ message: 'OK' }))

      const res = await app.request('/api/test', {}, mockEnv)

      expect(res.status).toBe(200)
      // API routes should not have CSP (they return JSON)
      expect(res.headers.get('Content-Security-Policy')).toBeNull()
      // API routes should not have frame options
      expect(res.headers.get('X-Frame-Options')).toBeNull()
      // API routes should not have XSS protection
      expect(res.headers.get('X-XSS-Protection')).toBeNull()
      // Should have permissive CORP for mobile/desktop app access
      expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin')
      // Should still have essential security headers
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    })

    it('should use normal configuration for non-API routes', async () => {
      app.use('*', securityHeaders())
      app.get('/dashboard', (c) => c.html('<html><body>Dashboard</body></html>'))

      const res = await app.request('/dashboard', {}, mockEnv)

      expect(res.status).toBe(200)
      // Non-API routes should have all security headers
      expect(res.headers.get('Content-Security-Policy')).toBeDefined()
      expect(res.headers.get('X-Frame-Options')).toBe('DENY')
      expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block')
      expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin')
    })
  })

  describe('Error Handling', () => {
    it('should continue processing normally', async () => {
      // Test that the middleware works without throwing errors
      app.use('*', securityHeaders())
      app.get('/test', (c) => c.text('OK'))

      const res = await app.request('/test', {}, mockEnv)
      expect(res.status).toBe(200)
      expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    })
  })
})

describe('Security Headers Configuration Constants', () => {
  describe('DEFAULT_SECURITY_CONFIG', () => {
    it('should have required CSP directives', () => {
      const csp = DEFAULT_SECURITY_CONFIG.contentSecurityPolicy
      expect(csp).toBeDefined()
      expect(csp!.directives['default-src']).toEqual(["'self'"])
      expect(csp!.directives['object-src']).toEqual(["'none'"])
      expect(csp!.directives['frame-ancestors']).toEqual(["'none'"])
    })

    it('should have secure HSTS configuration', () => {
      const hsts = DEFAULT_SECURITY_CONFIG.strictTransportSecurity
      expect(hsts).toBeDefined()
      expect(hsts!.maxAge).toBe(31536000) // 1 year
      expect(hsts!.includeSubDomains).toBe(true)
      expect(hsts!.preload).toBe(true)
    })

    it('should disable dangerous permissions', () => {
      const permissions = DEFAULT_SECURITY_CONFIG.permissionsPolicy
      expect(permissions).toBeDefined()
      expect(permissions!.camera).toEqual([])
      expect(permissions!.microphone).toEqual([])
      expect(permissions!.geolocation).toEqual([])
      expect(permissions!['clipboard-read']).toEqual([])
      expect(permissions!['clipboard-write']).toEqual(['self'])
      expect(permissions!.fullscreen).toEqual(['self'])
    })
  })

  describe('DEVELOPMENT_CSP_OVERRIDES', () => {
    it('should allow localhost connections', () => {
      const directives = DEVELOPMENT_CSP_OVERRIDES.directives
      expect(directives).toBeDefined()
      expect(directives!['connect-src']).toContain('localhost:*')
      expect(directives!['script-src']).toContain('localhost:*')
    })

    it('should allow HTTP protocol in development', () => {
      const directives = DEVELOPMENT_CSP_OVERRIDES.directives
      expect(directives!['img-src']).toContain('http:')
      expect(directives!['font-src']).toContain('http:')
      expect(directives!['connect-src']).toContain('http:')
    })

    it('should allow WebSocket connections', () => {
      const directives = DEVELOPMENT_CSP_OVERRIDES.directives
      expect(directives!['script-src']).toContain('ws:')
      expect(directives!['script-src']).toContain('wss:')
      expect(directives!['connect-src']).toContain('ws:')
      expect(directives!['connect-src']).toContain('wss:')
    })
  })

  describe('getAPISecurityConfig', () => {
    it('should disable CSP for API routes', () => {
      const config = getAPISecurityConfig()
      expect(config.contentSecurityPolicy).toBeUndefined()
    })

    it('should disable frame options for API routes', () => {
      const config = getAPISecurityConfig()
      expect(config.frameOptions).toBeUndefined()
    })

    it('should disable XSS protection for API routes', () => {
      const config = getAPISecurityConfig()
      expect(config.xssProtection).toBeUndefined()
    })

    it('should use cross-origin CORP for mobile/desktop app access', () => {
      const config = getAPISecurityConfig()
      expect(config.crossOriginResourcePolicy).toBe('cross-origin')
    })

    it('should maintain essential security headers', () => {
      const config = getAPISecurityConfig()
      expect(config.contentTypeOptions).toBe(true)
      expect(config.referrerPolicy).toBe('strict-origin-when-cross-origin')
      expect(config.strictTransportSecurity).toBeDefined()
    })
  })
})
