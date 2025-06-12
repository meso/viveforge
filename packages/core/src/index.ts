import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import { api } from './routes/api'
import { auth } from './routes/auth'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('/api/*', cors())

// API routes
app.route('/api', api)
app.route('/auth', auth)

// Serve dashboard assets
app.get('/*', serveStatic({ root: './' }))

// Fallback to index.html for client-side routing
app.get('/*', serveStatic({ path: './index.html' }))

export default app