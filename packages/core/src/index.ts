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

// Global error handler
app.onError((err, c) => {
  console.error('Global error handler:', err)
  return c.json({ 
    error: 'Internal Server Error',
    message: err.message,
    stack: err.stack
  }, 500)
})

app.use('*', logger())
app.use('/api/*', cors())

// 認証クライアントを初期化してコンテキストに設定
app.use('*', async (c, next) => {
  try {
    const authClient = new VibebaseAuthClient(c.env)
    await authClient.initialize()
    c.set('authClient', authClient)
    await next()
  } catch (error) {
    console.error('Failed to initialize auth client:', error)
    // 認証クライアントの初期化に失敗した場合
    c.set('authClient', null)
    
    // 認証ルート以外では初期化失敗をエラーとして返す
    if (!c.req.path.startsWith('/auth/')) {
      return c.json({ 
        error: 'Authentication service initialization failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 503)
    }
    
    await next()
  }
})

// Apply authentication middleware to all routes except auth routes and static assets
app.use('*', async (c, next) => {
  // Skip auth check for auth routes and static assets
  if (c.req.path.startsWith('/auth/') || 
      c.req.path.startsWith('/assets/') ||
      c.req.path.startsWith('/favicon.')) {
    await next()
    return
  }
  
  try {
    const authClient = c.get('authClient') as VibebaseAuthClient
    
    if (!authClient) {
      console.error('AuthClient not initialized')
      return c.json({ error: 'Authentication service unavailable' }, 503)
    }

    const user = await authClient.verifyRequest(c)
    
    if (!user) {
      // APIリクエストの場合はJSONで返す
      if (c.req.path.startsWith('/api/')) {
        const currentUrl = c.req.url
        const loginUrl = authClient.getLoginUrl(currentUrl)
        return c.json({ 
          error: 'Authentication required',
          login_url: loginUrl
        }, 401)
      }
      
      // ブラウザリクエストの場合はログインページを表示
      const currentUrl = c.req.url
      const loginUrl = authClient.getLoginUrl(currentUrl)
      
      return c.html(`<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ログイン - Vibebase</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-gray-50 min-h-screen flex items-center justify-center">
    <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
      <div class="text-center">
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-gray-900 mb-2">Vibebase</h1>
          <p class="text-gray-600">Personal BaaS for Vibe Coders</p>
        </div>
        
        <div class="mb-6">
          <div class="text-6xl mb-4">🔐</div>
          <h2 class="text-xl font-semibold text-gray-900 mb-2">ログインが必要です</h2>
          <p class="text-gray-600 text-sm mb-4">
            Vibebaseを使用するにはGitHubアカウントでのログインが必要です。<br>
            データベース、ストレージ、認証機能をご利用いただけます。
          </p>
        </div>
        
        <button 
          onclick="window.location.href='${loginUrl}'"
          class="w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors duration-200 font-medium flex items-center justify-center gap-3"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHubでログイン
        </button>
        
        <p class="mt-4 text-xs text-gray-500">
          認証は <a href="https://github.com/vibebase/vibebase-auth" target="_blank" class="text-blue-600 hover:text-blue-500">vibebase-auth</a> を使用します
        </p>
      </div>
    </div>
  </body>
</html>`)
    }
    
    // ユーザー情報をコンテキストに設定
    c.set('user', user)
    await next()
    
  } catch (error) {
    console.error('Authentication middleware error:', error)
    return c.json({ 
      error: 'Authentication failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      path: c.req.path
    }, 500)
  }
})

// Root route - Dashboard
app.get('/', async (c) => {
  const user = c.get('user')
  
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
        isAuthenticated: true,
        user: ${JSON.stringify({
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name
        })}
      };
    </script>
  </head>
  <body>
    <div id="app"></div>
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

// Catch-all route for SPA fallback
app.get('*', async (c) => {
  // Don't handle API routes or auth routes
  if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/auth/')) {
    return c.json({ error: 'Not Found' }, 404)
  }
  
  // For SPA routes, user is already authenticated via middleware
  const user = c.get('user')
  
  // Return the SPA HTML with auth state
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
        isAuthenticated: true,
        user: ${JSON.stringify({
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name
        })}
      };
    </script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`)
})

export default app