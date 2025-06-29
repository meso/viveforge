/**
 * Vibebase React SDK
 *
 * React hooks and components for Vibebase BaaS
 */

// Re-export core types from SDK
export type {
  CustomQuery,
  CustomQueryResult,
  FileInfo,
  FileUploadOptions,
  QueryOptions,
  RealtimeEvent,
  RealtimeSubscription,
  TableRow,
  TableSchema,
  User,
  UserSession,
  VibebaseConfig,
} from '@vibebase/sdk'
// Auth hooks
export { useAuth } from './hooks/use-auth'
// Custom query hooks
export { useCustomQuery } from './hooks/use-custom-query'
// Data hooks
export { useData } from './hooks/use-data'
export { useFileUpload } from './hooks/use-file-upload'
export { useInfiniteQuery } from './hooks/use-infinite-query'
export { useMutation } from './hooks/use-mutation'
export { useQuery } from './hooks/use-query'
// Realtime hooks
export { useRealtime } from './hooks/use-realtime'
export { useRealtimeSubscription } from './hooks/use-realtime-subscription'
// Storage hooks
export { useStorage } from './hooks/use-storage'
export { useUser } from './hooks/use-user'
// Provider and Context
export { useVibebase, VibebaseProvider } from './providers/vibebase-provider'
// Types
export type {
  UseInfiniteQueryOptions,
  UseMutationOptions,
  UseQueryOptions,
  VibebaseContextValue,
  VibebaseProviderProps,
} from './types'
