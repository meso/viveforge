import { Hono } from 'hono'
import type { VibebaseAuthClient } from '../lib/auth-client'
import { getCurrentDateTimeISO } from '../lib/datetime-utils'
import { generateId } from '../lib/utils'
import { getCurrentUser } from '../middleware/auth'
import {
  getAccessDeniedHTML,
  getAuthErrorHTML,
  getLoginHTML,
  getLogoutHTML,
} from '../templates/html'
import type { Env, Variables } from '../types'
import { errorResponse, serviceUnavailableResponse } from '../utils/responses'

const auth = new Hono<{ Bindings: Env; Variables: Variables }>()

/**
 * ログイン画面表示
 */
auth.get('/login', async (c) => {
  try {
    const authClient = c.get('authClient') as VibebaseAuthClient
    if (!authClient) {
      return serviceUnavailableResponse(c, 'Authentication service')
    }

    const redirectTo = c.req.query('redirect') || '/'
    const loginUrl = authClient.getLoginUrl(redirectTo)

    return c.html(getLoginHTML(loginUrl))
  } catch (error) {
    console.error('Login page failed:', error)
    return errorResponse(c, 'Login page failed')
  }
})

/**
 * 認証成功時のコールバック
 */
auth.get('/callback', async (c) => {
  const { token, refresh_token } = c.req.query()

  if (!token || !refresh_token) {
    return c.html(getAuthErrorHTML('認証エラー', '認証に失敗しました。トークンが見つかりません。'))
  }

  try {
    const authClient = c.get('authClient') as VibebaseAuthClient
    if (!authClient) {
      throw new Error('Authentication service unavailable')
    }

    // JWTトークンを検証
    const user = await authClient.verifyToken(token)

    // adminsテーブルでGitHubユーザー名をチェック
    const db = c.env.DB
    if (!db) {
      return c.html(getAuthErrorHTML('認証エラー', 'データベースが利用できません'))
    }
    const githubUsername = (user as Record<string, unknown>).username as string
    const githubId = (user as Record<string, unknown>).id as string

    // First check by github_id (for existing authenticated admins)
    let existingAdmin = await db
      .prepare('SELECT id, is_root, github_username FROM admins WHERE github_id = ?')
      .bind(githubId)
      .first()

    // If not found by github_id, check by github_username (for initial registration)
    if (!existingAdmin) {
      existingAdmin = await db
        .prepare(
          'SELECT id, is_root, github_username FROM admins WHERE github_username = ? AND github_id IS NULL'
        )
        .bind(githubUsername)
        .first()
    }

    // 管理者チェック
    if (!existingAdmin) {
      // adminsテーブルが空かチェック（初回ログイン判定）
      const adminCount = await db.prepare('SELECT COUNT(*) as count FROM admins').first()

      if (!adminCount) {
        return c.html(getAuthErrorHTML('認証エラー', '管理者テーブルの確認に失敗しました'))
      }

      if (adminCount.count === 0) {
        // 初回ログイン者をroot adminとして登録
        await db
          .prepare(
            'INSERT INTO admins (id, github_username, github_id, is_root) VALUES (?, ?, ?, ?)'
          )
          .bind(generateId(), githubUsername, githubId, true)
          .run()

        console.log(`First admin registered: GitHub username ${githubUsername}`)
      } else {
        // 管理者として登録されていない
        return c.html(getAccessDeniedHTML(githubUsername))
      }
    } else if (existingAdmin && !existingAdmin.github_id) {
      // github_usernameでマッチしたが、github_idが未設定の場合は更新
      await db
        .prepare('UPDATE admins SET github_id = ?, updated_at = ? WHERE id = ?')
        .bind(githubId, getCurrentDateTimeISO(), existingAdmin.id)
        .run()

      console.log(`Updated github_id for admin: ${githubUsername}`)
    }

    // Cookieでセッション管理
    const expires = 24 * 60 * 60 // 24時間
    const refreshExpires = 30 * 24 * 60 * 60 // 30日

    // 複数のSet-Cookieヘッダーを正しく設定するため、個別に追加
    c.res.headers.append(
      'Set-Cookie',
      `access_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${expires}; Path=/`
    )
    c.res.headers.append(
      'Set-Cookie',
      `refresh_token=${refresh_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${refreshExpires}; Path=/`
    )

    // リダイレクト先を取得
    const redirectTo = c.req.query('redirect_to') || '/'

    // 直接リダイレクトに変更（JavaScriptではなくHTTPリダイレクト）
    return c.redirect(redirectTo)
  } catch (error) {
    console.error('Auth callback error:', error)
    const err = error as Error
    return c.html(getAuthErrorHTML('認証エラー', '認証処理中にエラーが発生しました', err.message))
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

    return c.html(getLogoutHTML())
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
      return errorResponse(c, 'No refresh token', 401)
    }

    if (!authClient) {
      return serviceUnavailableResponse(c, 'Authentication service')
    }

    const tokens = await authClient.refreshToken(refreshToken)

    // 新しいCookie設定
    c.header(
      'Set-Cookie',
      `access_token=${tokens.access_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${tokens.expires_in}; Path=/`
    )
    c.header(
      'Set-Cookie',
      `refresh_token=${tokens.refresh_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}; Path=/`
    )

    return c.json({
      success: true,
      expires_in: tokens.expires_in,
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    return errorResponse(c, 'Token refresh failed', 401)
  }
})

/**
 * 現在のユーザー情報を取得
 */
auth.get('/me', async (c) => {
  const user = getCurrentUser(c)

  if (!user) {
    return errorResponse(c, 'Not authenticated', 401)
  }

  return c.json({
    user: {
      id: user.id,
      username: ((user as Record<string, unknown>).username as string) || user.email,
      email: user.email,
      name: user.name,
      scope: ((user as Record<string, unknown>).scope as string[]) || ['user'],
    },
  })
})

/**
 * 認証状態をチェック
 */
auth.get('/status', async (c) => {
  const user = getCurrentUser(c)

  return c.json({
    authenticated: !!user,
    user: user
      ? {
          id: user.id,
          username: ((user as Record<string, unknown>).username as string) || user.email,
          email: user.email,
          name: user.name,
          scope: ((user as Record<string, unknown>).scope as string[]) || ['user'],
        }
      : null,
  })
})

export { auth }
