import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { HookManager } from '../lib/hook-manager'
import type { Env, Variables } from '../types'
import type { CustomDurableObjectNamespace, DurableObjectStub } from '../types/cloudflare'

export const realtime = new Hono<{ Bindings: Env; Variables: Variables }>()

// Schema for subscription request
const subscribeSchema = z.object({
  tables: z.array(z.string()).optional(),
  hookIds: z.array(z.string()).optional(),
})

// GET /api/realtime/test-sse - Simple test SSE endpoint
realtime.get('/test-sse', async (_c) => {
  console.log('Test SSE endpoint called')
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // Send initial connection message
  writer.write(
    encoder.encode(`data: {"type":"connected","timestamp":"${new Date().toISOString()}"}\n\n`)
  )

  // Send test ping every 2 seconds
  const interval = setInterval(() => {
    writer.write(
      encoder.encode(`data: {"type":"ping","timestamp":"${new Date().toISOString()}"}\n\n`)
    )
  }, 2000)

  // Cleanup after 30 seconds
  setTimeout(() => {
    clearInterval(interval)
    writer.close()
  }, 30000)

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
})

// GET /api/realtime/sse - Server-Sent Events endpoint (using multiAuth middleware)
realtime.get('/sse', async (c) => {
  console.log('SSE: Endpoint called')

  // multiAuth middleware already handles token validation via URL parameter
  // The middleware supports both API keys and user JWT tokens
  const authContext = c.get('authContext')

  if (!authContext) {
    console.log('SSE: No authentication context found')
    return c.text('Unauthorized - Authentication required', 401)
  }

  console.log('SSE: Authentication successful, type:', authContext.type)
  if (authContext.type === 'user') {
    console.log('SSE: User ID:', authContext.user.id)
  }

  // Create a simple SSE stream for testing
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // Send initial connection message
  writer.write(
    encoder.encode(`data: {"type":"connected","timestamp":"${new Date().toISOString()}"}\n\n`)
  )

  // Send an immediate test event after connection
  setTimeout(() => {
    writer.write(
      encoder.encode(
        `data: {"type":"insert","table":"tasks","record":{"id":"test-123","title":"Test Event","created_at":"${new Date().toISOString()}"}}\n\n`
      )
    )
  }, 100)

  // Send test events every 2 seconds
  const interval = setInterval(() => {
    writer.write(
      encoder.encode(
        `data: {"type":"insert","table":"tasks","record":{"id":"test-${Date.now()}","title":"Test Event ${Date.now()}","created_at":"${new Date().toISOString()}"}}\n\n`
      )
    )
  }, 2000)

  // Cleanup after 30 seconds
  setTimeout(() => {
    clearInterval(interval)
    writer.close()
  }, 30000)

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
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
    const realtime = c.env.REALTIME as CustomDurableObjectNamespace
    const id = realtime.idFromName('global')
    const stub = realtime.get(id)

    // Update subscriptions
    const extendedStub = stub as DurableObjectStub
    if (extendedStub.updateSubscriptions) {
      await extendedStub.updateSubscriptions(clientId, { tables, hookIds })
    }

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
    const realtime = c.env.REALTIME as CustomDurableObjectNamespace
    const id = realtime.idFromName('global')
    const stub = realtime.get(id)

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
realtime.options('*', async (_c) => {
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
