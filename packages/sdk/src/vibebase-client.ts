/**
 * Main Vibebase SDK Client
 */

import { AuthClient } from './lib/auth-client'
import { CustomQueriesClient } from './lib/custom-queries-client'
import { DataClient } from './lib/data-client'
import { HttpClient } from './lib/http-client'
import { PushClient } from './lib/push-client'
import { RealtimeClient, RealtimeManager } from './lib/realtime-client'
import { StorageClient } from './lib/storage-client'
import type { ApiResponse, VibebaseConfig } from './types'

export class VibebaseClient {
  private httpClient: HttpClient

  // Public API clients
  public readonly data: DataClient
  public readonly auth: AuthClient
  public readonly storage: StorageClient
  public readonly realtime: RealtimeClient
  public readonly realtimeManager: RealtimeManager
  public readonly customQueries: CustomQueriesClient
  public readonly push: PushClient

  constructor(config: VibebaseConfig) {
    // Validate config
    if (!config.apiUrl) {
      throw new Error('apiUrl is required')
    }

    // Initialize HTTP client
    this.httpClient = new HttpClient({
      baseUrl: config.apiUrl.replace(/\/$/, ''), // Remove trailing slash
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
      auth: {
        apiKey: config.apiKey,
        userToken: config.userToken,
      },
    })

    // Initialize API clients
    this.data = new DataClient(this.httpClient)
    this.auth = new AuthClient(this.httpClient)
    this.storage = new StorageClient(this.httpClient)
    this.realtime = new RealtimeClient(config.apiUrl)
    this.realtimeManager = new RealtimeManager(this.httpClient)
    this.customQueries = new CustomQueriesClient(this.httpClient)
    this.push = new PushClient(this.httpClient)

    // Set auth for realtime client
    if (config.apiKey) {
      this.realtime.setAuth(config.apiKey)
    } else if (config.userToken) {
      this.realtime.setAuth(config.userToken)
    }
  }

  /**
   * Update authentication token
   */
  setUserToken(token: string): void {
    this.auth.setUserToken(token)
    this.realtime.setAuth(token)
  }

  /**
   * Update API key
   */
  setApiKey(apiKey: string): void {
    this.auth.setApiKey(apiKey)
    this.realtime.setAuth(apiKey)
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.auth.clearAuth()
    this.realtime.disconnect()
  }

  /**
   * Health check
   */
  async health(): Promise<
    ApiResponse<{
      status: string
      timestamp: string
      version: string
    }>
  > {
    return this.httpClient.get('/api/health')
  }

  /**
   * Get API information
   */
  async getApiInfo(): Promise<
    ApiResponse<{
      name: string
      version: string
      documentation: string
      endpoints: string[]
    }>
  > {
    return this.httpClient.get('/api')
  }

  /**
   * List all tables
   */
  async getTables(): Promise<
    ApiResponse<
      Array<{
        name: string
        row_count: number
        size: number
        created_at: string
      }>
    >
  > {
    return this.httpClient.get('/api/tables')
  }

  /**
   * Create a new table (admin only)
   */
  async createTable(
    name: string,
    columns: Array<{
      name: string
      type: string
      nullable?: boolean
      defaultValue?: string
      primaryKey?: boolean
    }>
  ): Promise<ApiResponse<{ name: string; sql: string }>> {
    return this.httpClient.post('/api/tables', { name, columns })
  }

  /**
   * Drop a table (admin only)
   */
  async dropTable(name: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete(`/api/tables/${name}`)
  }

  /**
   * Execute raw SQL (admin only)
   */
  async executeSQL(
    sql: string,
    params?: unknown[]
  ): Promise<
    ApiResponse<{
      results: unknown[]
      meta: { changes: number; duration: number }
    }>
  > {
    return this.httpClient.post('/api/tables/query', { sql, params })
  }

  /**
   * Get database statistics (admin only)
   */
  async getDatabaseStats(): Promise<
    ApiResponse<{
      total_tables: number
      total_records: number
      database_size: number
      performance_metrics: {
        avg_query_time: number
        queries_per_second: number
      }
    }>
  > {
    return this.httpClient.get('/api/tables/stats')
  }

  /**
   * Disconnect from realtime and cleanup
   */
  disconnect(): void {
    this.realtime.disconnect()
  }
}

/**
 * Create a new Vibebase client instance
 */
export function createClient(config: VibebaseConfig): VibebaseClient {
  return new VibebaseClient(config)
}
