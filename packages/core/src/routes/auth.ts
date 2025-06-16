import { Hono } from 'hono'
import { VibebaseAuthClient, type User } from '../lib/auth-client'
import { getCurrentUser } from '../middleware/auth'
import type { Env, Variables } from '../types'

const auth = new Hono<{ Bindings: Env; Variables: Variables }>()

/**
 * ログイン開始
 */
auth.get('/login', async (c) => {
  try {
    const authClient = c.get('authClient') as VibebaseAuthClient
    if (!authClient) {
      return c.json({ error: 'Authentication service unavailable' }, 503)
    }

    const redirectTo = c.req.query('redirect') || '/'
    const loginUrl = authClient.getLoginUrl(redirectTo)
    
    return c.redirect(loginUrl)
  } catch (error) {
    console.error('Login initiation failed:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

/**
 * 認証成功時のコールバック
 */
auth.get('/callback', async (c) => {
  const { token, refresh_token } = c.req.query()
  
  if (!token || !refresh_token) {
    return c.html(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>認証エラー - Vibebase</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 min-h-screen flex items-center justify-center">
        <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <div class="text-center">
            <div class="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">認証エラー</h1>
            <p class="text-gray-600 mb-4">認証に失敗しました。トークンが見つかりません。</p>
            <a href="/auth/login" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              再度ログイン
            </a>
          </div>
        </div>
      </body>
      </html>
    `)
  }
  
  try {
    const authClient = c.get('authClient') as VibebaseAuthClient
    if (!authClient) {
      throw new Error('Authentication service unavailable')
    }

    // JWTトークンを検証
    const user = await authClient.verifyToken(token)
    
    // Cookieでセッション管理
    const expires = 15 * 60 // 15分
    const refreshExpires = 30 * 24 * 60 * 60 // 30日
    
    c.header('Set-Cookie', `access_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${expires}; Path=/`)
    c.header('Set-Cookie', `refresh_token=${refresh_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${refreshExpires}; Path=/`)
    
    // 成功ページを表示
    return c.html(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ログイン成功 - Vibebase</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 min-h-screen flex items-center justify-center">
        <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <div class="text-center">
            <div class="text-green-500 text-6xl mb-4">✅</div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">ログイン成功</h1>
            <p class="text-gray-600 mb-2">ようこそ、<strong>${user.name || user.username}</strong>さん</p>
            <p class="text-sm text-gray-500 mb-4">${user.email}</p>
            <button onclick="redirectToDashboard()" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
              ダッシュボードへ
            </button>
          </div>
        </div>
        <script>
          function redirectToDashboard() {
            const params = new URLSearchParams(window.location.search);
            const redirectTo = params.get('redirect_to') || '/';
            window.location.href = redirectTo;
          }
          
          // 1秒後に自動リダイレクト（スムーズな体験のため短縮）
          setTimeout(redirectToDashboard, 1000);
        </script>
      </body>
      </html>
    `)
    
  } catch (error) {
    console.error('Auth callback error:', error)
    const err = error as Error
    return c.html(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>認証エラー - Vibebase</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 min-h-screen flex items-center justify-center">
        <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <div class="text-center">
            <div class="text-red-500 text-6xl mb-4">❌</div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">認証エラー</h1>
            <p class="text-gray-600 mb-2">認証処理中にエラーが発生しました</p>
            <p class="text-sm text-gray-500 mb-4">${err.message}</p>
            <a href="/auth/login" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              再度ログイン
            </a>
          </div>
        </div>
      </body>
      </html>
    `)
  }
})

/**
 * ログアウト
 */
auth.post('/logout', async (c) => {
  try {
    const authClient = c.get('authClient') as VibebaseAuthClient
    const refreshToken = c.req.raw.headers.get('Cookie')?.match(/refresh_token=([^;]+)/)?.[1]
    
    if (refreshToken && authClient) {
      await authClient.revokeToken(refreshToken)
    }
    
    // Cookieを削除
    c.header('Set-Cookie', 'access_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/')
    c.header('Set-Cookie', 'refresh_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/')
    
    return c.json({ success: true, message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    // ログアウトは常に成功として扱う
    return c.json({ success: true, message: 'Logged out' })
  }
})

/**
 * ログアウト（GET版 - ブラウザからの直接アクセス用）
 */
auth.get('/logout', async (c) => {
  try {
    const authClient = c.get('authClient') as VibebaseAuthClient
    const refreshToken = c.req.raw.headers.get('Cookie')?.match(/refresh_token=([^;]+)/)?.[1]
    
    if (refreshToken && authClient) {
      await authClient.revokeToken(refreshToken)
    }
    
    // Cookieを削除
    c.header('Set-Cookie', 'access_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/')
    c.header('Set-Cookie', 'refresh_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/')
    
    return c.html(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ログアウト - Vibebase</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 min-h-screen flex items-center justify-center">
        <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <div class="text-center">
            <div class="text-blue-500 text-6xl mb-4">👋</div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">ログアウト完了</h1>
            <p class="text-gray-600 mb-4">ログアウトしました。ご利用ありがとうございました。</p>
            <a href="/" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
              ホームに戻る
            </a>
          </div>
        </div>
        <script>
          // 3秒後にホームにリダイレクト
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
        </script>
      </body>
      </html>
    `)
  } catch (error) {
    console.error('Logout error:', error)
    return c.redirect('/')
  }
})

/**
 * トークンリフレッシュAPI
 */
auth.post('/refresh', async (c) => {
  try {
    const authClient = c.get('authClient') as VibebaseAuthClient
    const refreshToken = c.req.raw.headers.get('Cookie')?.match(/refresh_token=([^;]+)/)?.[1]
    
    if (!refreshToken) {
      return c.json({ error: 'No refresh token' }, 401)
    }
    
    if (!authClient) {
      return c.json({ error: 'Authentication service unavailable' }, 503)
    }
    
    const tokens = await authClient.refreshToken(refreshToken)
    
    // 新しいCookie設定
    c.header('Set-Cookie', `access_token=${tokens.access_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${tokens.expires_in}; Path=/`)
    c.header('Set-Cookie', `refresh_token=${tokens.refresh_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}; Path=/`)
    
    return c.json({ 
      success: true,
      expires_in: tokens.expires_in
    })
    
  } catch (error) {
    console.error('Token refresh error:', error)
    return c.json({ error: 'Token refresh failed' }, 401)
  }
})

/**
 * 現在のユーザー情報を取得
 */
auth.get('/me', async (c) => {
  const user = getCurrentUser(c)
  
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401)
  }
  
  return c.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      scope: user.scope
    }
  })
})

/**
 * 認証状態をチェック
 */
auth.get('/status', async (c) => {
  const user = getCurrentUser(c)
  
  return c.json({
    authenticated: !!user,
    user: user ? {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      scope: user.scope
    } : null
  })
})

export { auth }