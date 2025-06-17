import type { Context, Next } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { VibebaseAuthClient, type User } from '../lib/auth-client'
import { APIKeyManager, type APIKey } from '../lib/api-key-manager'
import type { Env, Variables } from '../types'

export interface AuthError extends Error {
  code: string
  status: number
}

export interface AuthContext {
  type: 'admin' | 'api_key'
  user?: User
  apiKey?: APIKey
}

declare module 'hono' {
  interface ContextVariableMap {
    authContext: AuthContext
  }
}

/**
 * Multi-authentication middleware (Admin + API Key)
 */
export async function multiAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization')
  
  // Try API Key authentication first if Bearer token is present
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    // Check if it's an API key (starts with vb_)
    if (token.startsWith('vb_')) {
      return await handleAPIKeyAuth(c, next, token)
    }
    
    // If it's not an API key format, try admin JWT
    return await handleAdminJWTAuth(c, next, token)
  }
  
  // If no Authorization header, try admin authentication (cookie-based)
  return await handleAdminAuth(c, next)
}

async function handleAPIKeyAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next, token: string) {
  try {
    if (!c.env.DB) {
      return c.json({ error: 'Database not available' }, 503)
    }
    
    const apiKeyManager = new APIKeyManager(c.env.DB)
    const apiKey = await apiKeyManager.verifyAPIKey(token)
    
    if (!apiKey) {
      return c.json({ error: 'Invalid API key' }, 401)
    }
    
    // Set auth context
    c.set('authContext', { type: 'api_key', apiKey })
    c.set('user', undefined) // For backward compatibility
    
    await next()
  } catch (error) {
    console.error('API Key auth error:', error)
    return c.json({ error: 'API key authentication failed' }, 401)
  }
}

async function handleAdminJWTAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next, token: string) {
  try {
    const authClient = c.get('authClient') as VibebaseAuthClient
    
    if (!authClient) {
      return c.json({ error: 'Authentication service unavailable' }, 503)
    }

    // Try to verify JWT token directly
    const user = await authClient.verifyJWT(token)
    
    if (!user) {
      return c.json({ error: 'Invalid JWT token' }, 401)
    }
    
    // Set auth context
    c.set('authContext', { type: 'admin', user })
    c.set('user', user) // For backward compatibility
    
    await next()
  } catch (error) {
    console.error('JWT auth error:', error)
    return c.json({ error: 'JWT authentication failed' }, 401)
  }
}

async function handleAdminAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  try {
    const authClient = c.get('authClient') as VibebaseAuthClient
    
    if (!authClient) {
      console.error('AuthClient not initialized')
      return c.json({ error: 'Authentication service unavailable' }, 503)
    }

    const user = await authClient.verifyRequest(c)
    
    if (!user) {
      // Authentication required
      const currentUrl = c.req.url
      const loginUrl = authClient.getLoginUrl(currentUrl)
      
      // For API requests, return JSON
      if (c.req.path.startsWith('/api/')) {
        return c.json({ 
          error: 'Authentication required',
          login_url: loginUrl
        }, 401)
      }
      
      // For browser requests, redirect to login
      return c.redirect(loginUrl)
    }
    
    // Set auth context
    c.set('authContext', { type: 'admin', user })
    c.set('user', user) // For backward compatibility
    
    await next()
    
  } catch (error) {
    console.error('Admin auth error:', error)
    return c.json({ error: 'Authentication service error' }, 503)
  }
}

/**
 * Legacy requireAuth function for backward compatibility
 */
export async function requireAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  return await multiAuth(c, next)
}

/**
 * 認証情報を取得するミドルウェア（オプショナル）
 */
export async function optionalAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const authClient = c.get('authClient') as VibebaseAuthClient
  
  if (authClient) {
    try {
      const user = await authClient.verifyRequest(c)
      if (user) {
        c.set('user', user)
      }
    } catch (error) {
      // オプショナル認証なので、エラーは無視
      console.warn('Optional auth failed:', error)
    }
  }
  
  await next()
}

/**
 * Get current authentication context
 */
export function getAuthContext(c: Context<{ Bindings: Env; Variables: Variables }>): AuthContext | null {
  return c.get('authContext') || null
}

/**
 * 現在のユーザー情報を取得
 */
export function getCurrentUser(c: Context<{ Bindings: Env; Variables: Variables }>): User | null {
  return c.get('user') || null
}

/**
 * Check if current request has specific scope
 */
export function hasScope(c: Context<{ Bindings: Env; Variables: Variables }>, scope: string): boolean {
  const authContext = getAuthContext(c)
  
  if (!authContext) return false
  
  if (authContext.type === 'admin') {
    // Admin has all scopes
    return true
  }
  
  if (authContext.type === 'api_key' && authContext.apiKey) {
    return authContext.apiKey.scopes.includes(scope)
  }
  
  return false
}

/**
 * Require specific scope
 */
export function requireScope(scope: string) {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    if (!hasScope(c, scope)) {
      return c.json({ 
        error: 'Insufficient permissions',
        required_scope: scope
      }, 403)
    }
    
    await next()
  }
}

/**
 * 管理者権限チェック
 */
export function requireAdmin(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  return async () => {
    const user = getCurrentUser(c)
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    if (!user.scope.includes('admin')) {
      return c.json({ error: 'Admin access required' }, 403)
    }
    
    await next()
  }
}


/**
 * 認証エラーハンドラー
 */
export function createAuthError(message: string, code: string, status: number = 401): AuthError {
  const error = new Error(message) as AuthError
  error.code = code
  error.status = status
  return error
}