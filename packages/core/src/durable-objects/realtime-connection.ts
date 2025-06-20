import { DurableObject } from 'cloudflare:workers'

export interface RealtimeMessage {
  type: 'event' | 'ping' | 'subscribe' | 'unsubscribe'
  event?: {
    id: string
    table: string
    recordId: string
    eventType: 'insert' | 'update' | 'delete'
    data: any
    timestamp: string
  }
  subscriptions?: {
    tables?: string[]
    hookIds?: string[]
  }
}

interface Connection {
  id: string
  userId?: string
  subscriptions: {
    tables: Set<string>
    hookIds: Set<string>
  }
  writer: WritableStreamDefaultWriter<Uint8Array>
  lastPing: number
}

export class RealtimeConnectionManager extends DurableObject {
  private connections: Map<string, Connection> = new Map()
  private pingInterval?: number

  constructor(state: DurableObjectState, env: any) {
    super(state, env)
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    
    // Handle SSE connections
    if (url.pathname === '/connect') {
      return this.handleSSEConnection(request)
    }
    
    // Handle event broadcasts
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      return this.handleBroadcast(request)
    }
    
    // Handle connection management
    if (url.pathname === '/disconnect' && request.method === 'POST') {
      return this.handleDisconnect(request)
    }
    
    return new Response('Not Found', { status: 404 })
  }

  private async handleSSEConnection(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId')
    const userId = url.searchParams.get('userId')
    
    if (!clientId) {
      return new Response('Missing clientId', { status: 400 })
    }

    // Create SSE response with proper headers
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // Store connection
    const connection: Connection = {
      id: clientId,
      userId: userId || undefined,
      subscriptions: {
        tables: new Set(),
        hookIds: new Set()
      },
      writer,
      lastPing: Date.now()
    }
    
    this.connections.set(clientId, connection)

    // Send initial connection message
    await this.sendToClient(connection, {
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString()
    })

    // Start ping interval if not already running
    if (!this.pingInterval) {
      this.startPingInterval()
    }

    // Clean up on disconnect
    request.signal.addEventListener('abort', () => {
      this.connections.delete(clientId)
      writer.close().catch(() => {})
      
      // Stop ping interval if no more connections
      if (this.connections.size === 0 && this.pingInterval) {
        clearInterval(this.pingInterval)
        this.pingInterval = undefined
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable Nginx buffering
      }
    })
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const message: RealtimeMessage = await request.json()
      
      if (message.type !== 'event' || !message.event) {
        return new Response('Invalid message', { status: 400 })
      }

      const event = message.event
      let broadcastCount = 0

      // Broadcast to all relevant connections
      for (const [clientId, connection] of this.connections) {
        // Check if connection is subscribed to this event
        if (connection.subscriptions.tables.has(event.table) ||
            connection.subscriptions.tables.has('*')) {
          await this.sendToClient(connection, {
            type: 'event',
            ...event
          })
          broadcastCount++
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        broadcastCount 
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Broadcast error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }

  private async handleDisconnect(request: Request): Promise<Response> {
    try {
      const { clientId } = await request.json() as { clientId?: string }
      
      if (!clientId) {
        return new Response('Missing clientId', { status: 400 })
      }

      const connection = this.connections.get(clientId)
      if (connection) {
        await connection.writer.close().catch(() => {})
        this.connections.delete(clientId)
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Disconnect error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }

  private async sendToClient(connection: Connection, data: any): Promise<void> {
    try {
      const encoder = new TextEncoder()
      const message = `data: ${JSON.stringify(data)}\n\n`
      await connection.writer.write(encoder.encode(message))
    } catch (error) {
      // Connection might be closed
      console.error(`Failed to send to client ${connection.id}:`, error)
      this.connections.delete(connection.id)
    }
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now()
      const timeout = 30000 // 30 seconds

      for (const [clientId, connection] of this.connections) {
        // Send ping
        this.sendToClient(connection, {
          type: 'ping',
          timestamp: new Date().toISOString()
        }).catch(() => {
          // Remove dead connections
          this.connections.delete(clientId)
        })

        // Check for stale connections
        if (now - connection.lastPing > timeout * 2) {
          connection.writer.close().catch(() => {})
          this.connections.delete(clientId)
        }
      }

      // Stop interval if no connections
      if (this.connections.size === 0 && this.pingInterval) {
        clearInterval(this.pingInterval)
        this.pingInterval = undefined
      }
    }, 25000) as any // Ping every 25 seconds
  }

  // Handle subscription updates from clients
  async updateSubscriptions(clientId: string, subscriptions: RealtimeMessage['subscriptions']): Promise<void> {
    const connection = this.connections.get(clientId)
    if (!connection) return

    if (subscriptions?.tables) {
      connection.subscriptions.tables = new Set(subscriptions.tables)
    }
    if (subscriptions?.hookIds) {
      connection.subscriptions.hookIds = new Set(subscriptions.hookIds)
    }

    // Send confirmation
    await this.sendToClient(connection, {
      type: 'subscriptions_updated',
      subscriptions: {
        tables: Array.from(connection.subscriptions.tables),
        hookIds: Array.from(connection.subscriptions.hookIds)
      },
      timestamp: new Date().toISOString()
    })
  }
}