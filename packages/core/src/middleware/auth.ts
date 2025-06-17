import type { Context, Next } from 'hono'
import { VibebaseAuthClient, type User } from '../lib/auth-client'
import type { Env, Variables } from '../types'

export interface AuthError extends Error {
  code: string
  status: number
}

/**
 * 認証が必要なルートで使用するミドルウェア
 */
export async function requireAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  try {
    const authClient = c.get('authClient') as VibebaseAuthClient
    
    if (!authClient) {
      console.error('AuthClient not initialized')
      return c.json({ error: 'Authentication service unavailable' }, 503)
    }

    const user = await authClient.verifyRequest(c)
    
    if (!user) {
      // 認証が必要 - ログインページにリダイレクト
      const currentUrl = c.req.url
      const loginUrl = authClient.getLoginUrl(currentUrl)
      
      // APIリクエストの場合はJSONで返す
      if (c.req.path.startsWith('/api/')) {
        return c.json({ 
          error: 'Authentication required',
          login_url: loginUrl
        }, 401)
      }
      
      // ブラウザリクエストの場合はリダイレクト
      return c.redirect(loginUrl)
    }
    
    // ユーザー情報をコンテキストに設定
    c.set('user', user)
    await next()
    
  } catch (error) {
    console.error('Auth middleware error:', error)
    
    // エラーハンドリング - 認証サービスの問題の場合はサービス不可
    return c.json({ error: 'Authentication service error' }, 503)
  }
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
 * 現在のユーザー情報を取得
 */
export function getCurrentUser(c: Context<{ Bindings: Env; Variables: Variables }>): User | null {
  return c.get('user') || null
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