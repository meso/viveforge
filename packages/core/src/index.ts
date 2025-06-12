import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
// Removed serveStatic import since we're using Workers Assets
import { api } from './routes/api'
import { auth } from './routes/auth'
import { tables } from './routes/tables'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('/api/*', cors())

// API routes
app.route('/api', api)
app.route('/api/tables', tables)
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

// Helper function to get index.html content
async function getIndexHtml(): Promise<string> {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ourforge Dashboard</title>
    <script type="module" crossorigin src="/assets/index-pkHAnB2v.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-g6Lxz6Pd.css">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`
}

export default app