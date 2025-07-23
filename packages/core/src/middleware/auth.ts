import type { Context, Next } from 'hono'
import type { AdminAuthManager, User as AdminUser } from '../lib/admin-auth-manager'
import { APIKeyManager } from '../lib/api-key-manager'
import { UserAuthManager } from '../lib/user-auth-manager'
import type { Env, Variables } from '../types'
import type { AuthContext, User } from '../types/auth'

export interface AuthError extends Error {
  code: string
  status: number
}

declare module 'hono' {
  interface ContextVariableMap {
    authContext: AuthContext
    user: AdminUser | undefined // Legacy support for admin users
  }
}

/**
 * Multi-authentication middleware (Admin + API Key + User)
 */
export async function multiAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization')

  // For SSE endpoints, also check URL token parameter (EventSource can't set headers)
  const urlToken = c.req.query('token')

  let token: string | undefined

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  } else if (urlToken && c.req.path.startsWith('/api/realtime/sse')) {
    // Only allow URL token for SSE endpoints for security reasons
    token = urlToken
  }

  // Try API Key authentication first if token is present
  if (token) {
    // Check if it's an API key (starts with vb_)
    if (token.startsWith('vb_')) {
      return await handleAPIKeyAuth(c, next, token)
    }

    // Try user JWT authentication first
    const userResult = await handleUserJWTAuth(c, next, token)
    if (userResult !== null) {
      return userResult
    }

    // If not a user token, try admin JWT
    return await handleAdminJWTAuth(c, next, token)
  }

  // If no Authorization header, try admin authentication (cookie-based)
  return await handleAdminAuth(c, next)
}

async function handleUserJWTAuth(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
  token: string
): Promise<Response | null> {
  try {
    if (!c.env.DB || !c.env.JWT_SECRET) {
      return null // Let other auth methods handle this
    }

    const userAuthManager = new UserAuthManager(
      c.env.DB,
      c.env.JWT_SECRET,
      c.env.WORKER_DOMAIN || 'localhost'
    )
    const authResult = await userAuthManager.verifyUserToken(token)

    if (!authResult) {
      return null // Not a user token, try other methods
    }

    // Set auth context for user
    c.set('authContext', {
      type: 'user',
      user: authResult.user,
      session: authResult.session,
    })
    c.set('user', undefined) // Clear admin user for consistency

    await next()
    return c.res // Return the response to indicate successful handling
  } catch (_error) {
    // If verification fails, it might not be a user token
    // Return null to let other auth methods try
    return null
  }
}

async function handleAPIKeyAuth(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
  token: string
) {
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

async function handleAdminJWTAuth(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
  token: string
) {
  try {
    const authClient = c.get('authClient') as AdminAuthManager

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
    const authClient = c.get('authClient') as AdminAuthManager

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
        return c.json(
          {
            error: 'Authentication required',
            login_url: loginUrl,
          },
          401
        )
      }

      // For browser requests, redirect to login page
      return c.redirect('/auth/login')
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
 * Get current authentication context
 */
export function getAuthContext(
  c: Context<{ Bindings: Env; Variables: Variables }>
): AuthContext | null {
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
export function hasScope(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  scope: string
): boolean {
  const authContext = getAuthContext(c)

  if (!authContext) return false

  if (authContext.type === 'admin') {
    // Admin has all scopes
    return true
  }

  if (authContext.type === 'api_key' && authContext.apiKey) {
    return authContext.apiKey.scopes.includes(scope)
  }

  if (authContext.type === 'user') {
    // User has basic user scopes
    return scope === 'user' || scope.startsWith('data:')
  }

  return false
}

/**
 * Require specific scope
 */
export function requireScope(scope: string) {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    if (!hasScope(c, scope)) {
      return c.json(
        {
          error: 'Insufficient permissions',
          required_scope: scope,
        },
        403
      )
    }

    await next()
  }
}

/**
 * 管理者権限チェック
 */
export async function requireAdmin(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const authContext = getAuthContext(c)

  if (!authContext) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  if (authContext.type !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  await next()
}

/**
 * Require user authentication (not admin or API key)
 */
export function requireUserAuth() {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const authContext = getAuthContext(c)

    if (!authContext) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    if (authContext.type !== 'user') {
      return c.json({ error: 'User authentication required' }, 403)
    }

    await next()
  }
}

/**
 * Get current user (for user authentication)
 */
export function getCurrentEndUser(
  c: Context<{ Bindings: Env; Variables: Variables }>
): User | null {
  const authContext = getAuthContext(c)
  return authContext?.type === 'user' ? authContext.user : null
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
