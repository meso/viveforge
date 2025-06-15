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
app.route('/api/storage', storage)
app.route('/auth', auth)

// Catch-all route for SPA fallback - serve index.html for non-API routes
app.get('*', async (c) => {
  // Don't handle API routes
  if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/auth/')) {
    return c.json({ error: 'Not Found' }, 404)
  }
  
  // For SPA routes, return index.html with current asset references
  return c.html(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
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