import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
// Removed serveStatic import since we're using Workers Assets
import { api } from './routes/api'
import { auth } from './routes/auth'
import { tables } from './routes/tables'
import { data } from './routes/data'
import { docs } from './routes/docs'
import { snapshots } from './routes/snapshots'
import { timeTravel } from './routes/time-travel'
import type { Env, Variables } from './types'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', logger())
app.use('/api/*', cors())

// API routes
app.route('/api', api)
app.route('/api/tables', tables)
app.route('/api/data', data)
app.route('/api/docs', docs)
app.route('/api/snapshots', snapshots)
app.route('/api/time-travel', timeTravel)
app.route('/auth', auth)

// Catch-all route for SPA fallback - serve index.html for non-API routes  
app.get('*', async (c) => {
  // Don't handle API routes
  if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/auth/')) {
    return c.json({ error: 'Not Found' }, 404)
  }
  
  // For SPA routes, Workers Assets will handle static files automatically
  // We just need to serve index.html for non-asset paths
  const url = new URL(c.req.url)
  
  // If requesting assets or specific files, let Workers Assets handle it
  if (url.pathname.startsWith('/assets/') || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') || 
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.ico') ||
      url.pathname === '/index.html') {
    // Let Workers Assets handle these - return undefined to continue to next handler
    return undefined
  }
  
  // For SPA routes, serve index.html
  // Workers Assets will automatically serve the correct index.html with proper asset paths
  const indexRequest = new Request(new URL('/index.html', c.req.url).toString(), {
    method: 'GET',
    headers: c.req.raw.headers
  })
  
  // @ts-ignore - ASSETS is available in Workers environment
  return c.env.ASSETS.fetch(indexRequest)
})

export default app