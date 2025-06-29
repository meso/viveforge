/**
 * Custom Queries Client
 */

import type { ApiResponse, CustomQuery, CustomQueryParameter, CustomQueryResult } from '../types'
import type { HttpClient } from './http-client'

export class CustomQueriesClient {
  constructor(private http: HttpClient) {}

  /**
   * List available custom queries
   */
  async list(): Promise<ApiResponse<CustomQuery[]>> {
    return this.http.get<CustomQuery[]>('/api/custom-queries')
  }

  /**
   * Get custom query details
   */
  async get(queryId: string): Promise<ApiResponse<CustomQuery>> {
    return this.http.get<CustomQuery>(`/api/custom-queries/${queryId}`)
  }

  /**
   * Execute a custom query
   */
  async execute<T = unknown>(
    queryId: string,
    parameters?: Record<string, unknown>
  ): Promise<ApiResponse<CustomQueryResult<T>>> {
    return this.http.post<CustomQueryResult<T>>(`/api/custom/${queryId}`, parameters)
  }

  /**
   * Execute a custom query by name/slug
   */
  async executeByName<T = unknown>(
    queryName: string,
    parameters?: Record<string, unknown>
  ): Promise<ApiResponse<CustomQueryResult<T>>> {
    return this.http.post<CustomQueryResult<T>>(`/api/custom/by-name/${queryName}`, parameters)
  }

  /**
   * Test a custom query (admin only)
   */
  async test<T = unknown>(
    sql: string,
    parameters?: Record<string, unknown>
  ): Promise<ApiResponse<CustomQueryResult<T>>> {
    return this.http.post<CustomQueryResult<T>>('/api/custom-queries/test', {
      sql,
      parameters,
    })
  }

  /**
   * Create a new custom query (admin only)
   */
  async create(query: {
    name: string
    description?: string
    sql: string
    parameters?: CustomQueryParameter[]
    cache_ttl?: number
    is_enabled?: boolean
  }): Promise<ApiResponse<CustomQuery>> {
    return this.http.post<CustomQuery>('/api/custom-queries', query)
  }

  /**
   * Update a custom query (admin only)
   */
  async update(
    queryId: string,
    updates: {
      name?: string
      description?: string
      sql?: string
      parameters?: CustomQueryParameter[]
      cache_ttl?: number
      is_enabled?: boolean
    }
  ): Promise<ApiResponse<CustomQuery>> {
    return this.http.put<CustomQuery>(`/api/custom-queries/${queryId}`, updates)
  }

  /**
   * Delete a custom query (admin only)
   */
  async delete(queryId: string): Promise<ApiResponse<void>> {
    return this.http.delete(`/api/custom-queries/${queryId}`)
  }

  /**
   * Get query execution logs (admin only)
   */
  async getLogs(
    queryId: string,
    options?: {
      limit?: number
      offset?: number
      start_date?: string
      end_date?: string
    }
  ): Promise<
    ApiResponse<
      Array<{
        id: string
        executed_at: string
        execution_time: number
        parameters: Record<string, unknown>
        success: boolean
        error?: string
      }>
    >
  > {
    const params: Record<string, string> = {}
    if (options?.limit) params.limit = String(options.limit)
    if (options?.offset) params.offset = String(options.offset)
    if (options?.start_date) params.start_date = options.start_date
    if (options?.end_date) params.end_date = options.end_date

    return this.http.get(`/api/custom-queries/${queryId}/logs`, params)
  }

  /**
   * Clear query cache (admin only)
   */
  async clearCache(queryId: string): Promise<ApiResponse<void>> {
    return this.http.post(`/api/custom-queries/${queryId}/clear-cache`)
  }

  /**
   * Get query performance stats (admin only)
   */
  async getStats(queryId: string): Promise<
    ApiResponse<{
      total_executions: number
      avg_execution_time: number
      cache_hit_rate: number
      last_executed: string
      error_rate: number
    }>
  > {
    return this.http.get(`/api/custom-queries/${queryId}/stats`)
  }
}
