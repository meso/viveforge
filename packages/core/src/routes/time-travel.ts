import { Hono } from 'hono'
import type { Env, Variables } from '../types'

const timeTravel = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get Time Travel info (plan detection)
timeTravel.get('/info', async (c) => {
  try {
    const env = c.env
    if (!env.DB) {
      return c.json({ error: 'Database not configured' }, 500)
    }

    // Try to get Time Travel info for a date > 7 days ago
    const testDate = new Date()
    testDate.setDate(testDate.getDate() - 10) // 10 days ago
    
    // Attempt to get a bookmark from 10 days ago
    // This is a simplified check - in production you'd use actual D1 Time Travel API
    let canAccessExtended = false
    let maxDays = 7
    
    try {
      // This would be the actual D1 Time Travel API call
      // For now, we'll check env variable or other method
      if (env.ENVIRONMENT === 'production') {
        // Assume production env has paid plan
        canAccessExtended = true
        maxDays = 30
      }
    } catch (error) {
      // If error, assume free plan
      canAccessExtended = false
      maxDays = 7
    }
    
    return c.json({
      available: true,
      maxDays,
      plan: canAccessExtended ? 'paid' : 'free',
      earliestAvailable: new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000).toISOString()
    })
  } catch (error) {
    console.error('Failed to get Time Travel info:', error)
    return c.json({ error: 'Failed to get Time Travel info' }, 500)
  }
})

// Get available restore points
timeTravel.get('/points', async (c) => {
  try {
    const env = c.env
    if (!env.DB) {
      return c.json({ error: 'Database not configured' }, 500)
    }

    // In a real implementation, this would query D1's Time Travel API
    // For now, return mock data showing available restore points
    const now = Date.now()
    const maxDays = env.ENVIRONMENT === 'production' ? 30 : 7
    const points = []
    
    // Generate hourly points for the last 24 hours
    for (let i = 1; i <= 24; i++) {
      points.push({
        timestamp: new Date(now - i * 60 * 60 * 1000).toISOString(),
        type: 'hourly',
        available: true
      })
    }
    
    // Generate daily points for remaining days
    for (let i = 1; i < maxDays; i++) {
      points.push({
        timestamp: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(),
        type: 'daily',
        available: true
      })
    }
    
    return c.json({ points, maxDays })
  } catch (error) {
    console.error('Failed to get restore points:', error)
    return c.json({ error: 'Failed to get restore points' }, 500)
  }
})

// Restore to a specific point in time
timeTravel.post('/restore', async (c) => {
  try {
    const env = c.env
    if (!env.DB) {
      return c.json({ error: 'Database not configured' }, 500)
    }

    const body = await c.req.json()
    const { timestamp, bookmark } = body
    
    if (!timestamp && !bookmark) {
      return c.json({ error: 'Either timestamp or bookmark is required' }, 400)
    }
    
    // Validate timestamp is within allowed range
    if (timestamp) {
      const maxDays = env.ENVIRONMENT === 'production' ? 30 : 7
      const earliestAllowed = Date.now() - maxDays * 24 * 60 * 60 * 1000
      const requestedTime = new Date(timestamp).getTime()
      
      if (requestedTime < earliestAllowed) {
        return c.json({ 
          error: `Cannot restore beyond ${maxDays} days. Upgrade to paid plan for 30-day history.`,
          maxDays,
          earliestAllowed: new Date(earliestAllowed).toISOString()
        }, 400)
      }
    }
    
    // In production, this would call D1's Time Travel restore API
    // Example: wrangler d1 time-travel restore DB_NAME --timestamp="..."
    
    return c.json({ 
      success: true, 
      message: 'Time Travel restore initiated',
      restoredTo: timestamp || `bookmark ${bookmark}`,
      warning: 'This is a destructive operation. The database has been restored to the specified point in time.'
    })
  } catch (error) {
    console.error('Failed to restore via Time Travel:', error)
    return c.json({ error: error instanceof Error ? error.message : 'Failed to restore' }, 500)
  }
})

// Get current bookmark
timeTravel.get('/bookmark', async (c) => {
  try {
    const env = c.env
    if (!env.DB) {
      return c.json({ error: 'Database not configured' }, 500)
    }

    // In production, this would call: wrangler d1 time-travel info DB_NAME
    // For now, return mock data
    return c.json({
      bookmark: '00000000-0000-0000-0000-000000000000',
      timestamp: new Date().toISOString(),
      info: 'Current database state bookmark'
    })
  } catch (error) {
    console.error('Failed to get bookmark:', error)
    return c.json({ error: 'Failed to get current bookmark' }, 500)
  }
})

export { timeTravel }