/**
 * Common types for CRUD operations and shared interfaces
 */

// Standard error type for consistent error handling
export interface AppError {
  message: string
  code?: string
  details?: Record<string, unknown>
}

// Generic API response envelope
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

// Pagination parameters
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

// Generic pagination response
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// Generic form validation errors
export interface ValidationErrors {
  [field: string]: string | undefined
}

// Generic resource with common fields
export interface BaseResource {
  id: string
  created_at: string
  updated_at: string
}

// CRUD operation types
export type CrudOperation = 'create' | 'read' | 'update' | 'delete'

// Generic filter/search parameters
export interface FilterParams {
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  filters?: Record<string, unknown>
}

// Loading states for async operations
export interface LoadingStates {
  loading: boolean
  creating: boolean
  updating: boolean
  deleting: boolean
}

// Generic configuration for API endpoints
export interface ApiConfig {
  baseUrl: string
  listEndpoint: string
  getEndpoint: (id: string) => string
  createEndpoint: string
  updateEndpoint: (id: string) => string
  deleteEndpoint: (id: string) => string
}

// Request options for API calls
export interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  credentials?: RequestCredentials
}
