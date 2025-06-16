import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { api } from './routes/api'
import { auth } from './routes/auth'
import { admins } from './routes/admins'
import { tables } from './routes/tables'
import { data } from './routes/data'
import { docs } from './routes/docs'
import { snapshots } from './routes/snapshots'
import { storage } from './routes/storage'
import { requireAuth } from './middleware/auth'
import { SetupWizard } from './lib/setup-wizard'
import type { Env, Variables } from './types'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', logger())
app.use('/api/*', cors())

// Root route - Setup wizard or dashboard
app.get('/', async (c) => {
  try {
    if (!c.env.DB) {
      throw new Error('Database not available')
    }
    
    const setupWizard = new SetupWizard(c.env.DB)
    const isSetupCompleted = await setupWizard.isSetupCompleted()
    const isAuthConfigured = await setupWizard.isAuthConfigured()
    
    // If setup is not completed and auth is not configured, show setup wizard
    if (!isSetupCompleted && !isAuthConfigured) {
      const domain = new URL(c.req.url).hostname
      return c.html(setupWizard.generateSetupWizardHTML(domain))
    }
    
    // Otherwise, serve the main dashboard
    return c.html(`
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vibebase Dashboard</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
</body>
</html>`)
  } catch (error) {
    console.error('Error checking setup status:', error)
    // Fallback to dashboard if DB is not accessible yet
    return c.html(`
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-case=1.0">
    <title>Vibebase Dashboard</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
</body>
</html>`)
  }
})

// API routes (protected by authentication)
app.route('/api', api)
app.route('/api/tables', tables)
app.route('/api/data', data)
app.route('/api/docs', docs)
app.route('/api/snapshots', snapshots)
app.route('/api/storage', storage)
app.route('/api/admins', admins)
app.route('/auth', auth)

// Apply authentication middleware to protected routes
app.use('/api/tables/*', requireAuth)
app.use('/api/data/*', requireAuth)
app.use('/api/docs/*', requireAuth)
app.use('/api/snapshots/*', requireAuth)
app.use('/api/storage/*', requireAuth)

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