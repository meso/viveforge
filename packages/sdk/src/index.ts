/**
 * Vibebase SDK
 * TypeScript client for Vibebase - Personal BaaS on Cloudflare
 */

export { AuthClient } from './lib/auth-client'
export { CustomQueriesClient } from './lib/custom-queries-client'
export { DataClient } from './lib/data-client'
// Individual clients
export { HttpClient } from './lib/http-client'
export { RealtimeClient, RealtimeManager } from './lib/realtime-client'
export { StorageClient } from './lib/storage-client'
// Types
export type {
  ApiError,
  ApiResponse,
  AuthConfig,
  ColumnDefinition,
  CreateOptions,
  CustomQuery,
  CustomQueryParameter,
  CustomQueryResult,
  FileInfo,
  FileUploadOptions,
  ForeignKeyDefinition,
  QueryOptions,
  RealtimeEvent,
  RealtimeSubscription,
  TableRow,
  TableSchema,
  UpdateOptions,
  User,
  UserSession,
  VibebaseConfig,
} from './types'
// Main client
export { createClient, VibebaseClient } from './vibebase-client'

// Version
export const VERSION = '0.1.0'
