import type { Context, Next } from 'hono'
import type { Env, Variables } from '../types'

/**
 * Security Headers Configuration
 */
export interface SecurityHeadersConfig {
  // Content Security Policy
  contentSecurityPolicy?: {
    directives: Record<string, string | string[]>
    reportOnly?: boolean
  }
  
  // Strict Transport Security
  strictTransportSecurity?: {
    maxAge: number
    includeSubDomains?: boolean
    preload?: boolean
  }
  
  // Frame Options
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string // allow-from uri
  
  // Content Type Options
  contentTypeOptions?: boolean
  
  // XSS Protection
  xssProtection?: {
    enabled: boolean
    mode?: 'block' | 'report'
    reportUri?: string
  }
  
  // Referrer Policy
  referrerPolicy?: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url'
  
  // Permissions Policy (formerly Feature Policy)
  permissionsPolicy?: Record<string, string | string[]>
  
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy?: 'unsafe-none' | 'require-corp' | 'credentialless'
  
  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy?: 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin'
  
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy?: 'same-site' | 'same-origin' | 'cross-origin'
}

/**
 * Default security headers configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityHeadersConfig = {
  // Content Security Policy - restrictive but functional for our dashboard
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'], // Allow inline scripts for Vite dev
      'style-src': ["'self'", "'unsafe-inline'", 'https:'], // Allow inline styles for Tailwind
      'img-src': ["'self'", 'data:', 'https:', 'blob:'], // Allow data URLs and external images
      'font-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https:', 'wss:', 'ws:'], // Allow API calls and WebSocket
      'media-src': ["'self'", 'blob:', 'data:'],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"], // Prevent embedding in frames
      'upgrade-insecure-requests': []
    }
  },
  
  // HSTS for 1 year with subdomain inclusion
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // Prevent framing completely
  frameOptions: 'DENY',
  
  // Prevent MIME type sniffing
  contentTypeOptions: true,
  
  // XSS Protection (legacy but still useful)
  xssProtection: {
    enabled: true,
    mode: 'block'
  },
  
  // Strict referrer policy
  referrerPolicy: 'strict-origin-when-cross-origin',
  
  // Disable dangerous browser features
  permissionsPolicy: {
    'camera': [],
    'microphone': [],
    'geolocation': [],
    'payment': [],
    'usb': [],
    'vr': [],
    'accelerometer': [],
    'gyroscope': [],
    'magnetometer': [],
    'clipboard-read': [],
    'clipboard-write': ['"self"'],
    'fullscreen': ['"self"']
  },
  
  // Cross-origin policies
  crossOriginEmbedderPolicy: 'unsafe-none', // Allow external resources for now
  crossOriginOpenerPolicy: 'same-origin-allow-popups', // Allow OAuth popups
  crossOriginResourcePolicy: 'cross-origin' // Allow mobile/desktop app access
}

/**
 * Development environment overrides for CSP
 */
export const DEVELOPMENT_CSP_OVERRIDES: NonNullable<SecurityHeadersConfig['contentSecurityPolicy']> = {
  directives: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'localhost:*', 'ws:', 'wss:'], // Allow localhost for dev
    'style-src': ["'self'", "'unsafe-inline'", 'localhost:*'],
    'img-src': ["'self'", 'data:', 'https:', 'http:', 'blob:'], // Allow HTTP in dev
    'font-src': ["'self'", 'data:', 'https:', 'http:'],
    'connect-src': ["'self'", 'https:', 'http:', 'ws:', 'wss:', 'localhost:*'], // Allow localhost connections
    'media-src': ["'self'", 'blob:', 'data:'],
    'object-src': ["'none'"],
    'frame-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"]
    // Remove upgrade-insecure-requests in development
  }
}

/**
 * Build CSP directive string from object
 */
function buildCSPDirective(directives: Record<string, string | string[]>): string {
  return Object.entries(directives)
    .map(([directive, sources]) => {
      if (Array.isArray(sources)) {
        return sources.length > 0 ? `${directive} ${sources.join(' ')}` : directive
      }
      return `${directive} ${sources}`
    })
    .join('; ')
}

/**
 * Build Permissions Policy string from object
 */
function buildPermissionsPolicy(permissions: Record<string, string | string[]>): string {
  return Object.entries(permissions)
    .map(([feature, allowlist]) => {
      if (Array.isArray(allowlist)) {
        const origins = allowlist.length > 0 ? `(${allowlist.join(' ')})` : '()'
        return `${feature}=${origins}`
      }
      return `${feature}=(${allowlist})`
    })
    .join(', ')
}

/**
 * Security headers middleware
 */
export function securityHeaders(config: SecurityHeadersConfig = DEFAULT_SECURITY_CONFIG) {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    // Apply security headers after response is generated
    await next()
    
    // Skip security headers for CORS preflight requests
    if (c.req.method === 'OPTIONS') {
      return
    }
    
    // Skip security headers for static assets handled by Workers Assets
    // as their responses have immutable headers
    if (c.req.path.startsWith('/assets/') || c.req.path.startsWith('/favicon.')) {
      return
    }
    
    // Use more permissive settings for API routes to support mobile/desktop apps
    const isApiRoute = c.req.path.startsWith('/api/')
    const activeConfig = isApiRoute ? getAPISecurityConfig() : config
    
    // Determine if we're in development environment
    const isDevelopment = c.env.ENVIRONMENT === 'development'
    
    // Content Security Policy
    if (activeConfig.contentSecurityPolicy) {
      let cspConfig = activeConfig.contentSecurityPolicy
      
      // Override CSP for development environment
      if (isDevelopment && DEVELOPMENT_CSP_OVERRIDES.directives) {
        cspConfig = {
          ...cspConfig,
          directives: {
            ...cspConfig.directives,
            ...DEVELOPMENT_CSP_OVERRIDES.directives
          }
        }
      }
      
      const cspValue = buildCSPDirective(cspConfig.directives)
      const cspHeader = cspConfig.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'
      c.res.headers.set(cspHeader, cspValue)
    }
    
    // Strict Transport Security (only in production with HTTPS)
    if (activeConfig.strictTransportSecurity && !isDevelopment) {
      const { maxAge, includeSubDomains, preload } = activeConfig.strictTransportSecurity
      let hstsValue = `max-age=${maxAge}`
      if (includeSubDomains) hstsValue += '; includeSubDomains'
      if (preload) hstsValue += '; preload'
      c.res.headers.set('Strict-Transport-Security', hstsValue)
    }
    
    // X-Frame-Options
    if (activeConfig.frameOptions) {
      c.res.headers.set('X-Frame-Options', activeConfig.frameOptions)
    }
    
    // X-Content-Type-Options
    if (activeConfig.contentTypeOptions) {
      c.res.headers.set('X-Content-Type-Options', 'nosniff')
    }
    
    // X-XSS-Protection
    if (activeConfig.xssProtection) {
      const { enabled, mode, reportUri } = activeConfig.xssProtection
      let xssValue = enabled ? '1' : '0'
      if (enabled && mode) {
        xssValue += `; mode=${mode}`
      }
      if (enabled && reportUri) {
        xssValue += `; report=${reportUri}`
      }
      c.res.headers.set('X-XSS-Protection', xssValue)
    }
    
    // Referrer-Policy
    if (activeConfig.referrerPolicy) {
      c.res.headers.set('Referrer-Policy', activeConfig.referrerPolicy)
    }
    
    // Permissions-Policy
    if (activeConfig.permissionsPolicy) {
      const permissionsValue = buildPermissionsPolicy(activeConfig.permissionsPolicy)
      c.res.headers.set('Permissions-Policy', permissionsValue)
    }
    
    // Cross-Origin-Embedder-Policy
    if (activeConfig.crossOriginEmbedderPolicy) {
      c.res.headers.set('Cross-Origin-Embedder-Policy', activeConfig.crossOriginEmbedderPolicy)
    }
    
    // Cross-Origin-Opener-Policy
    if (activeConfig.crossOriginOpenerPolicy) {
      c.res.headers.set('Cross-Origin-Opener-Policy', activeConfig.crossOriginOpenerPolicy)
    }
    
    // Cross-Origin-Resource-Policy
    if (activeConfig.crossOriginResourcePolicy) {
      c.res.headers.set('Cross-Origin-Resource-Policy', activeConfig.crossOriginResourcePolicy)
    }
  }
}

/**
 * Get recommended security configuration for production
 */
export function getProductionSecurityConfig(): SecurityHeadersConfig {
  return DEFAULT_SECURITY_CONFIG
}

/**
 * Get recommended security configuration for development
 */
export function getDevelopmentSecurityConfig(): SecurityHeadersConfig {
  return {
    ...DEFAULT_SECURITY_CONFIG,
    // Disable HSTS in development
    strictTransportSecurity: undefined,
    // Use development CSP overrides
    contentSecurityPolicy: {
      ...DEFAULT_SECURITY_CONFIG.contentSecurityPolicy!,
      directives: {
        ...DEFAULT_SECURITY_CONFIG.contentSecurityPolicy!.directives,
        ...DEVELOPMENT_CSP_OVERRIDES.directives!
      }
    }
  }
}

/**
 * Get security configuration optimized for API routes
 * - More permissive for mobile/desktop app access
 * - Maintains essential security protections
 */
export function getAPISecurityConfig(): SecurityHeadersConfig {
  return {
    ...DEFAULT_SECURITY_CONFIG,
    // No CSP for API routes - they return JSON, not HTML
    contentSecurityPolicy: undefined,
    // Disable frame options for API routes
    frameOptions: undefined,
    // Keep XSS protection minimal for APIs
    xssProtection: undefined,
    // More permissive cross-origin policy for mobile/desktop apps
    crossOriginResourcePolicy: 'cross-origin'
  }
}