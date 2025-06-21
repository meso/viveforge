import type { ExecutionContext } from '@cloudflare/workers-types'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { VibebaseAuthClient } from './lib/auth-client'
import { getOrGenerateJWTSecret, logSecurityWarnings } from './lib/security-utils'
import { multiAuth, optionalAuth, requireAuth } from './middleware/auth'
import { securityHeaders } from './middleware/security-headers'
import { admin } from './routes/admin'
import adminOAuth from './routes/admin-oauth'
import { api } from './routes/api'
import { apiKeys } from './routes/api-keys'
import appSettings from './routes/app-settings'
import { auth } from './routes/auth'
import { custom } from './routes/custom'
import { customQueries } from './routes/custom-queries'
import { data } from './routes/data'
import { docs } from './routes/docs'
import { hooks } from './routes/hooks'
import { realtime } from './routes/realtime'
import { snapshots } from './routes/snapshots'
import { storage } from './routes/storage'
import { tables } from './routes/tables'
import userAuth from './routes/user-auth'
import { CURRENT_ASSETS } from './templates/assets'
import { getDashboardHTML, getLoginHTML } from './templates/html'
import type { Env, Variables } from './types'

// Export Durable Object class
export { RealtimeConnectionManager } from './durable-objects/realtime-connection'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// Global error handler
app.onError((err, c) => {
  console.error('Global error handler:', err)
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
      stack: err.stack,
    },
    500
  )
})

app.use('*', logger())

// Apply security headers to all responses
app.use('*', securityHeaders())

app.use('/api/*', cors())

// Initialize JWT_SECRET with security validation
app.use('*', async (c, next) => {
  // Initialize and validate JWT_SECRET
  const jwtSecretResult = getOrGenerateJWTSecret(c.env.JWT_SECRET, c.env.ENVIRONMENT)

  // Log security warnings if any
  if (jwtSecretResult.warnings.length > 0) {
    logSecurityWarnings(jwtSecretResult.warnings, 'JWT Secret')
  }

  // Update environment with the validated/generated secret
  c.env.JWT_SECRET = jwtSecretResult.secret

  await next()
})

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
      return c.json(
        {
          error: 'Authentication service initialization failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        503
      )
    }

    await next()
  }
})

// Apply authentication middleware to all routes except auth routes and static assets
app.use('*', async (c, next) => {
  // Skip auth check for auth routes and static assets
  if (
    c.req.path.startsWith('/auth/') ||
    c.req.path.startsWith('/api/auth/') ||
    c.req.path.startsWith('/assets/') ||
    c.req.path.startsWith('/favicon.')
  ) {
    await next()
    return
  }

  // Use multi-auth middleware for API routes and dashboard
  return await multiAuth(c, next)
})

// Root route - Dashboard
app.get('/', async (c) => {
  const user = c.get('user')
  return c.html(getDashboardHTML(user, CURRENT_ASSETS.js, CURRENT_ASSETS.css))
})

// Static assets handled by Workers Assets below

// Auth routes (public)
app.route('/auth', auth)
app.route('/api/auth', userAuth)

// API routes (protected by authentication)
app.route('/api', api)
app.route('/api/tables', tables)
app.route('/api/data', data)
app.route('/api/docs', docs)
app.route('/api/snapshots', snapshots)
app.route('/api/storage', storage)
app.route('/api/admin', admin)
app.route('/api/admin/oauth', adminOAuth)
app.route('/api/api-keys', apiKeys)
app.route('/api/app-settings', appSettings)
app.route('/api/hooks', hooks)
app.route('/api/realtime', realtime)
app.route('/api/custom-queries', customQueries)
app.route('/api/custom', custom)

// Handle static assets
app.get('/assets/*', async (c) => {
  // Let Workers Assets handle this through env.ASSETS
  return c.env.ASSETS.fetch(c.req.raw)
})

app.get('/favicon.svg', async (c) => {
  // Let Workers Assets handle this through env.ASSETS
  return c.env.ASSETS.fetch(c.req.raw)
})

app.get('/favicon.ico', async (c) => {
  // Redirect to SVG favicon
  return c.redirect('/favicon.svg', 301)
})

// Catch-all route for SPA fallback
app.get('*', async (c) => {
  // Don't handle API routes, auth routes, or static assets
  if (
    c.req.path.startsWith('/api/') ||
    c.req.path.startsWith('/auth/') ||
    c.req.path.startsWith('/assets/') ||
    c.req.path.startsWith('/favicon.')
  ) {
    return c.json({ error: 'Not Found' }, 404)
  }

  // For SPA routes, user is already authenticated via middleware
  const user = c.get('user')

  // Return the SPA HTML with auth state
  return c.html(getDashboardHTML(user, CURRENT_ASSETS.js, CURRENT_ASSETS.css))
})

// Export default handler with both fetch and scheduled handlers
export default {
  async scheduled(event: any, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Cron trigger executed:', event.cron)

    try {
      // Call the process-events endpoint internally
      const url = `https://${env.DOMAIN}/api/realtime/process-events`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.JWT_SECRET}`, // Use internal auth
        },
      })

      if (!response.ok) {
        console.error('Failed to process events via cron:', response.status, await response.text())
      } else {
        console.log('Cron event processing completed successfully')
      }
    } catch (error) {
      console.error('Error in cron handler:', error)
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx)
  },
}
