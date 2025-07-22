/**
 * Realtime Client for Server-Sent Events
 */
import type { ApiResponse, RealtimeEvent, RealtimeSubscription } from '../types'
import type { HttpClient } from './http-client'

export class RealtimeClient {
  private subscriptions = new Map<string, RealtimeSubscription>()
  private eventSource: EventSource | null = null
  private baseUrl: string
  private authToken: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * Set authentication token
   */
  setAuth(token: string): void {
    this.authToken = token
  }

  /**
   * Subscribe to table changes
   */
  subscribe(
    tableName: string,
    eventType: 'insert' | 'update' | 'delete' | '*',
    callback: (event: RealtimeEvent) => void
  ): RealtimeSubscription {
    const id = `${tableName}:${eventType}:${Date.now()}`

    const subscription: RealtimeSubscription = {
      id,
      tableName,
      eventType,
      callback,
      unsubscribe: () => this.unsubscribe(id),
    }

    this.subscriptions.set(id, subscription)
    this.ensureConnection()

    return subscription
  }

  /**
   * Unsubscribe from table changes
   */
  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId)

    // Close connection if no more subscriptions
    if (this.subscriptions.size === 0) {
      this.disconnect()
    }
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    this.subscriptions.clear()
    this.disconnect()
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN
  }

  /**
   * Manually connect to realtime stream
   */
  connect(): void {
    this.ensureConnection()
  }

  /**
   * Disconnect from realtime stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }

  /**
   * Ensure EventSource connection is active
   */
  private ensureConnection(): void {
    if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
      return
    }

    const url = new URL('/api/realtime/sse', this.baseUrl)

    // Add auth token to URL if available (since EventSource doesn't support headers)
    if (this.authToken) {
      url.searchParams.set('token', this.authToken)
    }

    console.log('Creating EventSource with URL:', url.toString())
    this.eventSource = new EventSource(url.toString())

    this.eventSource.onmessage = (event) => {
      try {
        console.log('Received SSE event:', event.data)
        const data = JSON.parse(event.data)
        console.log('Parsed event:', data)

        // Skip connection events
        if (data.type === 'connected') {
          console.log('Skipping connection event')
          return
        }

        // Only handle realtime events
        if (data.type && data.table && data.record) {
          console.log('Processing realtime event')
          this.handleRealtimeEvent(data as RealtimeEvent)
        } else {
          console.log('Ignoring non-realtime event:', data)
        }
      } catch (error) {
        console.error('Failed to parse realtime event:', error, 'Raw data:', event.data)
      }
    }

    this.eventSource.onerror = (error) => {
      console.error('Realtime connection error:', error)

      // Attempt to reconnect after delay
      setTimeout(() => {
        if (this.subscriptions.size > 0) {
          this.ensureConnection()
        }
      }, 5000)
    }

    this.eventSource.onopen = () => {
      console.log('Realtime connection established')
    }
  }

  /**
   * Handle incoming realtime events
   */
  private handleRealtimeEvent(event: RealtimeEvent): void {
    console.log('Handling realtime event:', event, 'subscriptions:', this.subscriptions.size)
    for (const subscription of this.subscriptions.values()) {
      console.log(
        'Checking subscription:',
        subscription.tableName,
        subscription.eventType,
        'vs',
        event.table,
        event.type
      )

      // Match table name
      if (subscription.tableName !== event.table && subscription.tableName !== '*') {
        console.log('Table name mismatch')
        continue
      }

      // Match event type
      if (subscription.eventType !== event.type && subscription.eventType !== '*') {
        console.log('Event type mismatch')
        continue
      }

      console.log('Calling subscription callback')
      try {
        subscription.callback(event)
      } catch (error) {
        console.error('Error in realtime callback:', error)
      }
    }
  }
}

/**
 * Utility functions for working with realtime subscriptions
 */
export class RealtimeManager {
  private http: HttpClient

  constructor(http: HttpClient) {
    this.http = http
  }

  /**
   * Create a database hook for realtime events
   */
  async createHook(
    tableName: string,
    eventType: 'insert' | 'update' | 'delete'
  ): Promise<ApiResponse<{ id: string }>> {
    return this.http.post('/api/hooks', {
      table_name: tableName,
      event_type: eventType,
    })
  }

  /**
   * List existing hooks
   */
  async listHooks(): Promise<
    ApiResponse<
      Array<{
        id: string
        table_name: string
        event_type: string
        is_enabled: boolean
        created_at: string
      }>
    >
  > {
    return this.http.get('/api/hooks')
  }

  /**
   * Delete a hook
   */
  async deleteHook(hookId: string): Promise<ApiResponse<void>> {
    return this.http.delete(`/api/hooks/${hookId}`)
  }

  /**
   * Toggle hook status
   */
  async toggleHook(hookId: string, enabled: boolean): Promise<ApiResponse<void>> {
    return this.http.patch(`/api/hooks/${hookId}`, { is_enabled: enabled })
  }
}
