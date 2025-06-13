import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
// Removed serveStatic import since we're using Workers Assets
import { api } from './routes/api'
import { auth } from './routes/auth'
import { tables } from './routes/tables'
import { data } from './routes/data'
import { docs } from './routes/docs'
import type { Env, Variables } from './types'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', logger())
app.use('/api/*', cors())

// API routes
app.route('/api', api)
app.route('/api/tables', tables)
app.route('/api/data', data)
app.route('/api/docs', docs)
app.route('/auth', auth)

// Since we're using Workers Assets, static files are served automatically
// We only need to handle SPA routing for non-existent routes

// SPA routes - serve the main page and let client-side routing handle it
app.get('/database', async (c) => {
  return c.html(await getIndexHtml())
})

app.get('/storage', async (c) => {
  return c.html(await getIndexHtml())
})

app.get('/auth-page', async (c) => {
  return c.html(await getIndexHtml())
})

app.get('/settings', async (c) => {
  return c.html(await getIndexHtml())
})

// Root path
app.get('/', async (c) => {
  return c.html(await getIndexHtml())
})

// Catch-all route for SPA fallback
app.get('*', async (c) => {
  // Check if the request is for an API endpoint
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not Found' }, 404)
  }
  
  // For all other routes, serve the SPA
  return c.html(await getIndexHtml())
})

// Helper function to get index.html content
async function getIndexHtml(): Promise<string> {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Viveforge Dashboard</title>
    <script type="module" crossorigin src="/assets/index-BTtGELXr.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-s_zEFhkd.css">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`
}

export default app