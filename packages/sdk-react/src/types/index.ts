/**
 * React SDK Types
 */

import type {
  FileInfo,
  FileUploadOptions,
  QueryOptions,
  RealtimeEvent,
  TableRow,
  VibebaseClient,
  VibebaseConfig,
} from '@vibebase/sdk'
import type { ReactNode } from 'react'

// Provider types
export interface VibebaseProviderProps {
  children: ReactNode
  config: VibebaseConfig
  client?: VibebaseClient
}

export interface VibebaseContextValue {
  client: VibebaseClient
  isReady: boolean
}

// Query types
export interface UseQueryOptions<T = unknown> {
  enabled?: boolean
  refetchInterval?: number
  refetchOnWindowFocus?: boolean
  retry?: number | boolean
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

export interface UseQueryResult<T = unknown> {
  data: T | undefined
  error: Error | null
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  refetch: () => Promise<void>
  isRefetching: boolean
}

// Mutation types
export interface UseMutationOptions<TData = unknown, TVariables = unknown> {
  onSuccess?: (data: TData, variables: TVariables) => void
  onError?: (error: Error, variables: TVariables) => void
  onMutate?: (variables: TVariables) => Promise<unknown> | unknown
}

export interface UseMutationResult<TData = unknown, TVariables = unknown> {
  mutate: (variables: TVariables) => Promise<void>
  mutateAsync: (variables: TVariables) => Promise<TData>
  data: TData | undefined
  error: Error | null
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  reset: () => void
}

// Infinite query types
export interface UseInfiniteQueryOptions<T = unknown> extends UseQueryOptions<T> {
  getNextPageParam?: (lastPage: T, allPages: T[]) => unknown
  getPreviousPageParam?: (firstPage: T, allPages: T[]) => unknown
}

export interface UseInfiniteQueryResult<T = unknown> extends Omit<UseQueryResult<T[]>, 'data'> {
  data: T[]
  hasNextPage: boolean
  hasPreviousPage: boolean
  isFetchingNextPage: boolean
  isFetchingPreviousPage: boolean
  fetchNextPage: () => Promise<void>
  fetchPreviousPage: () => Promise<void>
}

// Data hook types
export interface UseDataOptions extends QueryOptions {
  realtimeEnabled?: boolean
}

export interface UseDataResult<T extends TableRow = TableRow> {
  data: T[]
  total: number
  error: Error | null
  isLoading: boolean
  refetch: () => Promise<void>
  create: (data: Omit<T, 'id' | 'created_at' | 'updated_at'>) => Promise<T>
  update: (id: string, data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>) => Promise<T>
  delete: (id: string) => Promise<void>
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
}

// File upload types
export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface UseFileUploadResult {
  upload: (file: File, fileName?: string, options?: FileUploadOptions) => Promise<FileInfo>
  uploadMultiple: (files: File[], options?: FileUploadOptions) => Promise<FileInfo[]>
  isUploading: boolean
  progress: UploadProgress | null
  error: Error | null
  reset: () => void
}

// Realtime types
export interface UseRealtimeOptions {
  enabled?: boolean
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}

export interface UseRealtimeResult {
  isConnected: boolean
  subscribe: (
    tableName: string,
    eventType: 'insert' | 'update' | 'delete' | '*',
    callback: (event: RealtimeEvent) => void
  ) => () => void
  unsubscribeAll: () => void
}

// Custom query types
export interface UseCustomQueryVariables {
  [key: string]: string | number | boolean | Date
}

export interface UseCustomQueryResult<T = unknown> {
  data: T[]
  error: Error | null
  isLoading: boolean
  execute: (variables?: UseCustomQueryVariables) => Promise<void>
  isExecuting: boolean
}
