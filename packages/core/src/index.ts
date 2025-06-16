import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { api } from './routes/api'
import { auth } from './routes/auth'
import { tables } from './routes/tables'
import { data } from './routes/data'
import { docs } from './routes/docs'
import { snapshots } from './routes/snapshots'
import { storage } from './routes/storage'
import { VibebaseAuthClient } from './lib/auth-client'
import { requireAuth, optionalAuth } from './middleware/auth'
import type { Env, Variables } from './types'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', logger())
app.use('/api/*', cors())

// 認証クライアントを初期化してコンテキストに設定
app.use('*', async (c, next) => {
  try {
    const authClient = new VibebaseAuthClient(c.env)
    await authClient.initialize()
    c.set('authClient', authClient)
  } catch (error) {
    console.error('Failed to initialize auth client:', error)
    // 認証クライアントの初期化に失敗してもサービスを継続
  }
  await next()
})

// Root route - Dashboard with optional auth
app.get('/', optionalAuth, async (c) => {
  const user = c.get('user')
  const isAuthenticated = !!user
  
  return c.html(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vibebase Dashboard</title>
    <script type="module" crossorigin src="/assets/index-EHqLc-mI.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-CdATilmN.css">
    <script>
      // 認証状態をグローバル変数として設定
      window.VIBEBASE_AUTH = {
        isAuthenticated: ${isAuthenticated},
        user: ${user ? JSON.stringify({
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name
        }) : 'null'}
      };
      
      // 認証状況をチェックして動的にUIを更新
      function checkAuthStatus() {
        if (window.VIBEBASE_AUTH.isAuthenticated) {
          const overlay = document.getElementById('auth-overlay');
          if (overlay) {
            overlay.style.display = 'none';
          }
        }
      }
      
      // ページロード後に認証状況をチェック
      document.addEventListener('DOMContentLoaded', checkAuthStatus);
      
      // 認証後にページがリロードされた場合のために、定期的に認証状況をチェック
      if (!window.VIBEBASE_AUTH.isAuthenticated) {
        const checkInterval = setInterval(async () => {
          try {
            const response = await fetch('/auth/status');
            const status = await response.json();
            if (status.authenticated) {
              window.VIBEBASE_AUTH = status;
              checkAuthStatus();
              clearInterval(checkInterval);
              // ページをリロードして最新の認証状態を反映
              window.location.reload();
            }
          } catch (error) {
            // エラーは無視（認証サーバーが利用できない場合など）
          }
        }, 2000);
        
        // 30秒後にチェックを停止
        setTimeout(() => clearInterval(checkInterval), 30000);
      }
    </script>
  </head>
  <body>
    <div id="app"></div>
    ${!isAuthenticated ? `
    <!-- 認証オーバーレイ -->
    <div id="auth-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center;">
      <div style="background: white; padding: 2rem; border-radius: 8px; max-width: 400px; width: 90%; text-align: center;">
        <h2 style="margin: 0 0 1rem 0; color: #333;">🔐 ログインが必要です</h2>
        <p style="margin: 0 0 1.5rem 0; color: #666;">Vibebaseを使用するにはGitHubアカウントでのログインが必要です。</p>
        <button onclick="window.location.href='/auth/login'" style="background: #24292e; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-size: 1rem; display: inline-flex; align-items: center; gap: 0.5rem;">
          <svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHubでログイン
        </button>
        <p style="margin: 1rem 0 0 0; font-size: 0.875rem; color: #888;">
          認証には<a href="https://github.com/meso/vibebase" target="_blank" style="color: #0366d6;">vibebase-auth</a>を使用します
        </p>
      </div>
    </div>
    ` : ''}
  </body>
</html>`)
})

// Auth routes (public)
app.route('/auth', auth)

// API routes (protected by authentication)
app.route('/api', api)
app.route('/api/tables', tables)
app.route('/api/data', data)
app.route('/api/docs', docs)
app.route('/api/snapshots', snapshots)
app.route('/api/storage', storage)

// Apply authentication middleware to protected routes
app.use('/api/tables/*', requireAuth)
app.use('/api/data/*', requireAuth)
app.use('/api/docs/*', requireAuth)
app.use('/api/snapshots/*', requireAuth)
app.use('/api/storage/*', requireAuth)

// Catch-all route for SPA fallback - serve index.html for non-API routes
app.get('*', optionalAuth, async (c) => {
  // Don't handle API routes or auth routes
  if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/auth/')) {
    return c.json({ error: 'Not Found' }, 404)
  }
  
  // For SPA routes, return index.html with current asset references
  return c.html(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vibebase Dashboard</title>
    <script type="module" crossorigin src="/assets/index-EHqLc-mI.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-CdATilmN.css">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`)
})

export default app