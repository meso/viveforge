import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { HookManager } from '../lib/hook-manager'
import { getAuthContext, getCurrentEndUser } from '../middleware/auth'
import type { Env, Variables } from '../types'

export const realtime = new Hono<{ Bindings: Env; Variables: Variables }>()

// Schema for subscription request
const subscribeSchema = z.object({
  tables: z.array(z.string()).optional(),
  hookIds: z.array(z.string()).optional(),
})

// GET /api/realtime/sse - Server-Sent Events endpoint
realtime.get('/sse', async (c) => {
  try {
    const authContext = getAuthContext(c)
    const currentUser = getCurrentEndUser(c)

    // Check if Durable Object binding exists
    if (!c.env.REALTIME) {
      return c.json({ error: 'Realtime service not configured' }, 503)
    }

    // Generate client ID
    const clientId = crypto.randomUUID()

    // Get Durable Object ID (use a single global instance for now)
    const id = c.env.REALTIME.idFromName('global')
    const stub = c.env.REALTIME.get(id)

    // Build URL for Durable Object
    const url = new URL('/connect', 'http://internal')
    url.searchParams.set('clientId', clientId)

    // Add user ID if authenticated as user
    if (authContext?.type === 'user' && currentUser) {
      url.searchParams.set('userId', currentUser.id)
    }

    // Forward request to Durable Object
    const response = await stub.fetch(url.toString(), {
      method: 'GET',
      headers: {
        Upgrade: 'websocket',
      },
    })

    // Add CORS headers for SSE
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    return response
  } catch (error) {
    console.error('Error connecting to realtime service:', error)
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to connect to realtime service',
      },
      500
    )
  }
})

// POST /api/realtime/subscribe - Update subscriptions
realtime.post('/subscribe', zValidator('json', subscribeSchema), async (c) => {
  try {
    const { tables, hookIds } = c.req.valid('json')
    const clientId = c.req.header('X-Client-Id')

    if (!clientId) {
      return c.json({ error: 'Missing X-Client-Id header' }, 400)
    }

    if (!c.env.REALTIME) {
      return c.json({ error: 'Realtime service not configured' }, 503)
    }

    // Get Durable Object
    const id = c.env.REALTIME.idFromName('global')
    const stub = c.env.REALTIME.get(id)

    // Update subscriptions
    await stub.updateSubscriptions(clientId, { tables, hookIds })

    return c.json({
      success: true,
      message: 'Subscriptions updated',
      subscriptions: { tables, hookIds },
    })
  } catch (error) {
    console.error('Error updating subscriptions:', error)
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update subscriptions',
      },
      500
    )
  }
})

// POST /api/realtime/process-events - Process failed events from queue
// This endpoint is called periodically to retry failed events (backup mechanism)
realtime.post('/process-events', async (c) => {
  try {
    if (!c.env.DB || !c.env.REALTIME) {
      return c.json({ error: 'Required services not configured' }, 503)
    }

    const hookManager = new HookManager(c.env.DB)

    // Get unprocessed events (these are typically failed immediate broadcasts)
    const events = await hookManager.getUnprocessedEvents(100)

    if (events.length === 0) {
      return c.json({
        success: true,
        message: 'No failed events to retry',
        processed: 0,
      })
    }

    // Get Durable Object
    const id = c.env.REALTIME.idFromName('global')
    const stub = c.env.REALTIME.get(id)

    let processedCount = 0

    // Process each event
    for (const event of events) {
      try {
        // Parse event data
        const eventData = JSON.parse(event.event_data)

        // Broadcast to connected clients
        const broadcastResponse = await stub.fetch('http://internal/broadcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'event',
            event: {
              id: event.id,
              table: event.table_name,
              recordId: event.record_id,
              eventType: event.event_type,
              data: eventData,
              timestamp: event.created_at,
            },
          }),
        })

        if (broadcastResponse.ok) {
          // Mark event as processed
          await hookManager.markEventProcessed(event.id)
          processedCount++
        }
      } catch (error) {
        console.error(`Failed to process event ${event.id}:`, error)
      }
    }

    return c.json({
      success: true,
      message: `Retried ${processedCount} of ${events.length} failed events`,
      processed: processedCount,
      total: events.length,
    })
  } catch (error) {
    console.error('Error processing events:', error)
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process events',
      },
      500
    )
  }
})

// OPTIONS /api/realtime/* - Handle CORS preflight
realtime.options('*', async (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Id',
      'Access-Control-Max-Age': '86400',
    },
  })
})
