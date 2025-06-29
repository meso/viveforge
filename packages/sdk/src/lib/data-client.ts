/**
 * Data Client for CRUD operations
 */

import type {
  ApiResponse,
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
  ): Promise<ApiResponse<{ data: T[]; total: number }>> {
    const params: Record<string, string> = {}

    if (options?.limit) params.limit = String(options.limit)
    if (options?.offset) params.offset = String(options.offset)
    if (options?.orderBy) params.order_by = options.orderBy
    if (options?.orderDirection) params.order_direction = options.orderDirection
    if (options?.where) params.where = JSON.stringify(options.where)

    return this.http.get<{ data: T[]; total: number }>(`/api/tables/${tableName}/data`, params)
  }

  /**
   * Get a single record by ID
   */
  async get<T extends TableRow = TableRow>(tableName: string, id: string): Promise<ApiResponse<T>> {
    return this.http.get<T>(`/api/data/${tableName}/${id}`)
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
    return this.http.post<T>(`/api/tables/${tableName}/data`, payload)
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
    return this.http.put<T>(`/api/data/${tableName}/${id}`, payload)
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
