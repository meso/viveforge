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