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
    const response = await this.http.post<CustomQueryResult<T>>(
      `/api/custom-queries/${queryId}/execute`,
      {
        parameters: parameters || {},
      }
    )

    if (!response.success && response.error) {
      throw new Error(response.error)
    }

    return response
  }

  /**
   * Execute a custom query by slug
   */
  async executeBySlug<T = unknown>(
    slug: string,
    parameters?: Record<string, unknown>
  ): Promise<ApiResponse<CustomQueryResult<T>>> {
    const response = await this.http.post<CustomQueryResult<T>>(
      `/api/custom-queries/slug/${slug}/execute`,
      {
        parameters: parameters || {},
      }
    )

    if (!response.success && response.error) {
      throw new Error(response.error)
    }

    return response
  }

  /**
   * Test a custom query (admin only)
   */
  async test<T = unknown>(
    queryId: string,
    parameters?: Record<string, unknown>
  ): Promise<ApiResponse<CustomQueryResult<T>>> {
    return this.http.post<CustomQueryResult<T>>(`/api/custom-queries/${queryId}/test`, {
      parameters: parameters || {},
    })
  }

  /**
   * Create a new custom query (admin only)
   */
  async create(query: {
    slug: string
    name: string
    sql_query: string
    description?: string
    parameters?: CustomQueryParameter[]
    cache_ttl?: number
    is_enabled?: boolean
  }): Promise<ApiResponse<CustomQuery>> {
    const response = await this.http.post<CustomQuery>('/api/custom-queries', query)

    if (!response.success && response.error) {
      throw new Error(response.error)
    }

    return response
  }

  /**
   * Update a custom query (admin only)
   */
  async update(
    queryId: string,
    updates: {
      slug?: string
      name?: string
      sql_query?: string
      description?: string
      parameters?: CustomQueryParameter[]
      cache_ttl?: number
      is_enabled?: boolean
    }
  ): Promise<ApiResponse<CustomQuery>> {
    return this.http.patch<CustomQuery>(`/api/custom-queries/${queryId}`, updates)
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
   * Get query performance stats (admin only)
   */
  async getStats(queryId?: string): Promise<
    ApiResponse<{
      total_queries?: number
      enabled_queries?: number
      total_executions: number
      average_execution_time: number
      cache_hit_rate: number
      most_used_queries?: Array<{
        id: string
        name: string
        execution_count: number
      }>
    }>
  > {
    if (queryId) {
      return this.http.get(`/api/custom-queries/${queryId}/stats`)
    }
    return this.http.get('/api/custom-queries/stats')
  }

  /**
   * Get execution history for a query
   */
  async getExecutionHistory(
    queryId: string,
    options?: {
      limit?: number
      offset?: number
    }
  ): Promise<
    ApiResponse<{
      executions: Array<{
        id: string
        query_id: string
        parameters: Record<string, unknown>
        execution_time: number
        result_count: number
        cached: boolean
        executed_at: string
      }>
      total: number
    }>
  > {
    const params: Record<string, string> = {}
    if (options?.limit !== undefined) params.limit = String(options.limit)
    if (options?.offset !== undefined) params.offset = String(options.offset)

    return this.http.get(`/api/custom-queries/${queryId}/history`, params)
  }

  /**
   * Clear query cache
   */
  async clearCache(queryId?: string): Promise<
    ApiResponse<{
      cleared_entries: number
      cache_size_before: number
      cache_size_after: number
    }>
  > {
    if (queryId) {
      return this.http.delete(`/api/custom-queries/${queryId}/cache`)
    }
    return this.http.delete('/api/custom-queries/cache')
  }
}
