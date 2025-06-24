/**
 * API type definitions
 * Centralized location for all API-related interfaces and types
 */

// Core data models
export interface Item {
  id: string
  name: string
  description?: string
  userId?: string
  createdAt: string
  updatedAt: string
}

// Database-related types
export interface TableInfo {
  name: string
  type: 'system' | 'user'
  sql: string
  rowCount?: number
  access_policy?: 'public' | 'private'
}

export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | number | null
  pk: number
}

export interface ForeignKeyInfo {
  from: string
  table: string
  to: string
}

export interface IndexInfo {
  name: string
  tableName: string
  columns: string[]
  unique: boolean
  sql: string
}

// Schema management types
export interface SchemaSnapshot {
  id: string
  version: number
  name?: string
  description?: string
  fullSchema: string
  tablesJson: string
  schemaHash: string
  createdAt: string
  createdBy?: string
  snapshotType: 'manual' | 'auto' | 'pre_change'
  d1BookmarkId?: string
}

// OAuth provider types
export interface OAuthProvider {
  id: string
  provider: string
  client_id: string
  client_secret: string
  is_enabled: boolean
  scopes: string[]
  redirect_uri?: string
  created_at: string
  updated_at: string
}

export interface SupportedProvider {
  provider: string
  name: string
  default_scopes: string[]
  setup_instructions: string
  note?: string
}

// Generic API response types
export interface ApiResponse<T> {
  data?: T
  error?: string
}
