import type {
  ApiResponse,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  Item,
  OAuthProvider,
  SchemaSnapshot,
  SupportedProvider,
  TableInfo,
} from '../types/api'
import { apiClient } from './api-client'
import { tableApi } from './table-api'

// Re-export types for backward compatibility
export type {
  ApiResponse,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  Item,
  OAuthProvider,
  SchemaSnapshot,
  SupportedProvider,
  TableInfo,
} from '../types/api'

// Main API client - orchestrates all API operations
export const api = {
  // Basic API operations
  ...apiClient,

  // Table-related operations
  ...tableApi,
}
