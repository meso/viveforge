/**
 * Data Client for CRUD operations
 */

import type {
  ApiResponse,
  ListResponse,
  CreateOptions,
  QueryOptions,
  TableRow,
  TableSchema,
  UpdateOptions,
} from '../types'
import type { HttpClient } from './http-client'

export class DataClient {
  constructor(private http: HttpClient) {}

  /**
   * Get table schema
   */
  async getSchema(tableName: string): Promise<ApiResponse<TableSchema>> {
    return this.http.get<TableSchema>(`/api/tables/${tableName}/schema`)
  }

  /**
   * List records from a table
   */
  async list<T extends TableRow = TableRow>(
    tableName: string,
    options?: QueryOptions
  ): Promise<ListResponse<T>> {
    const params: Record<string, string> = {}

    if (options?.limit) params.limit = String(options.limit)
    if (options?.offset) params.offset = String(options.offset)
    if (options?.orderBy) params.order_by = options.orderBy
    if (options?.orderDirection) params.order_direction = options.orderDirection
    if (options?.where) params.where = JSON.stringify(options.where)

    const response = await this.http.get<{ data: T[]; total: number; pagination?: any }>(`/api/data/${tableName}`, params)
    
    // Transform the response to flatten the data structure
    if (response.success && response.data) {
      // Handle the actual API response format which includes pagination
      if ('pagination' in response.data && response.data.pagination) {
        return {
          ...response,
          data: response.data.data,
          total: response.data.pagination.total
        }
      }
      // Handle older format
      return {
        ...response,
        data: response.data.data || response.data,
        total: response.data.total || 0
      }
    }
    
    return {
      ...response,
      data: [],
      total: 0
    }
  }

  /**
   * Get a single record by ID
   */
  async get<T extends TableRow = TableRow>(tableName: string, id: string): Promise<ApiResponse<T>> {
    const response = await this.http.get(`/api/data/${tableName}/${id}`)
    
    // Handle response format from API
    if (response.success && response.data && typeof response.data === 'object' && 'data' in response.data) {
      return {
        ...response,
        data: (response.data as any).data
      } as ApiResponse<T>
    }
    
    return response as ApiResponse<T>
  }

  /**
   * Create a new record
   */
  async create<T extends TableRow = TableRow>(
    tableName: string,
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>,
    options?: CreateOptions
  ): Promise<ApiResponse<T>> {
    const payload = {
      ...data,
      ...(options?.select && { select: options.select }),
    }
    const response = await this.http.post(`/api/data/${tableName}`, payload)
    
    // Handle nested response format from API
    if (response.success && response.data && typeof response.data === 'object' && 'data' in response.data) {
      return {
        ...response,
        data: (response.data as any).data
      } as ApiResponse<T>
    }
    
    return response as ApiResponse<T>
  }

  /**
   * Update a record
   */
  async update<T extends TableRow = TableRow>(
    tableName: string,
    id: string,
    data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>,
    options?: UpdateOptions
  ): Promise<ApiResponse<T>> {
    const payload = {
      ...data,
      ...(options?.select && { select: options.select }),
    }
    const response = await this.http.put(`/api/data/${tableName}/${id}`, payload)
    
    // Handle nested response format from API
    if (response.success && response.data && typeof response.data === 'object' && 'data' in response.data) {
      return {
        ...response,
        data: (response.data as any).data
      } as ApiResponse<T>
    }
    
    return response as ApiResponse<T>
  }

  /**
   * Delete a record
   */
  async delete(tableName: string, id: string): Promise<ApiResponse<void>> {
    return this.http.delete(`/api/data/${tableName}/${id}`)
  }

  /**
   * Execute raw SQL query (if enabled)
   */
  async query<T = unknown>(
    sql: string,
    params?: unknown[]
  ): Promise<ApiResponse<{ results: T[]; meta: { changes: number; duration: number } }>> {
    return this.http.post(`/api/tables/query`, { sql, params })
  }

  /**
   * Search records (if table has searchable columns)
   */
  async search<T extends TableRow = TableRow>(
    tableName: string,
    query: string,
    options?: Omit<QueryOptions, 'where'>
  ): Promise<ApiResponse<{ data: T[]; total: number }>> {
    const params: Record<string, string> = {
      q: query,
    }

    if (options?.limit) params.limit = String(options.limit)
    if (options?.offset) params.offset = String(options.offset)

    return this.http.get<{ data: T[]; total: number }>(`/api/tables/${tableName}/search`, params)
  }

  /**
   * Get table statistics
   */
  async getStats(tableName: string): Promise<
    ApiResponse<{
      total_records: number
      table_size: number
      indexes: number
      last_updated: string
    }>
  > {
    return this.http.get(`/api/tables/${tableName}/stats`)
  }

  /**
   * Bulk insert records
   */
  async bulkInsert<T extends TableRow = TableRow>(
    tableName: string,
    records: Omit<T, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<ApiResponse<{ inserted: number; records: T[] }>> {
    return this.http.post(`/api/tables/${tableName}/bulk`, { records })
  }

  /**
   * Bulk update records
   */
  async bulkUpdate<T extends TableRow = TableRow>(
    tableName: string,
    updates: { id: string; data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>> }[]
  ): Promise<ApiResponse<{ updated: number; records: T[] }>> {
    return this.http.put(`/api/tables/${tableName}/bulk`, { updates })
  }

  /**
   * Bulk delete records
   */
  async bulkDelete(tableName: string, ids: string[]): Promise<ApiResponse<{ deleted: number }>> {
    return this.http.request(`/api/tables/${tableName}/bulk`, {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    })
  }
}
