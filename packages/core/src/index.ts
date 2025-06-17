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
import { admin } from './routes/admin'
import { VibebaseAuthClient } from './lib/auth-client'
import { getDashboardHTML, getLoginHTML } from './templates/html'
import { requireAuth, optionalAuth } from './middleware/auth'
import { CURRENT_ASSETS } from './templates/assets'
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
    c.set('authClient', undefined)
    
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
    console.log(`Skipping auth for: ${c.req.path}`)
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
      
      // ブラウザリクエストの場合はログイン画面を表示
      const currentPath = new URL(c.req.url).pathname
      const loginUrl = authClient.getLoginUrl(currentPath)
      
      return c.html(getLoginHTML(loginUrl))
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
  return c.html(getDashboardHTML(user, CURRENT_ASSETS.js, CURRENT_ASSETS.css))
})

// Static assets handled by Workers Assets below

// Auth routes (public)
app.route('/auth', auth)

// API routes (protected by authentication)
app.route('/api', api)
app.route('/api/tables', tables)
app.route('/api/data', data)
app.route('/api/docs', docs)
app.route('/api/snapshots', snapshots)
app.route('/api/storage', storage)
app.route('/api/admin', admin)

// Handle static assets
app.get('/assets/*', async (c) => {
  console.log(`Asset request for: ${c.req.path}`)
  // Let Workers Assets handle this through env.ASSETS
  return c.env.ASSETS.fetch(c.req.raw)
})

app.get('/favicon.svg', async (c) => {
  console.log(`Favicon request`)
  // Let Workers Assets handle this through env.ASSETS
  return c.env.ASSETS.fetch(c.req.raw)
})

app.get('/favicon.ico', async (c) => {
  console.log(`Favicon.ico request - redirecting to favicon.svg`)
  // Redirect to SVG favicon
  return c.redirect('/favicon.svg', 301)
})

// Catch-all route for SPA fallback
app.get('*', async (c) => {
  console.log(`Catch-all route hit for: ${c.req.path}`)
  
  // Don't handle API routes, auth routes, or static assets
  if (c.req.path.startsWith('/api/') || 
      c.req.path.startsWith('/auth/') ||
      c.req.path.startsWith('/assets/') ||
      c.req.path.startsWith('/favicon.')) {
    console.log(`Returning 404 for: ${c.req.path}`)
    return c.json({ error: 'Not Found' }, 404)
  }
  
  // For SPA routes, user is already authenticated via middleware
  const user = c.get('user')
  
  // Return the SPA HTML with auth state
  return c.html(getDashboardHTML(user, CURRENT_ASSETS.js, CURRENT_ASSETS.css))
})

export default app