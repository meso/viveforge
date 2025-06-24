/**
 * Cloudflare Workers type definitions for Vibebase
 * These provide proper typing for D1, R2, and ExecutionContext
 */
import type {
  DurableObjectId as CfDurableObjectId,
  DurableObjectStub as CfDurableObjectStub,
  D1Database as CloudflareD1Database,
  D1ExecResult as CloudflareD1ExecResult,
  D1PreparedStatement as CloudflareD1PreparedStatement,
  D1Result as CloudflareD1Result,
} from '@cloudflare/workers-types'

// Use Cloudflare's types directly
export type D1Database = CloudflareD1Database
export type D1PreparedStatement = CloudflareD1PreparedStatement
export type D1Result<T = unknown> = CloudflareD1Result<T>
export type D1ExecResult = CloudflareD1ExecResult

// R2 Storage types
export interface R2Bucket {
  get(key: string, options?: R2GetOptions): Promise<R2Object | null>
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: R2PutOptions
  ): Promise<R2Object>
  delete(keys: string | string[]): Promise<void>
  list(options?: R2ListOptions): Promise<R2Objects>
  head(key: string): Promise<R2Object | null>
}

export interface R2Object {
  key: string
  version: string
  size: number
  etag: string
  httpEtag: string
  uploaded: Date
  checksums: R2Checksums
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
  range?: R2Range
  body?: ReadableStream
  bodyUsed?: boolean
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
  arrayBuffer(): Promise<ArrayBuffer>
  blob(): Promise<Blob>
}

export interface R2GetOptions {
  onlyIf?: R2Conditional
  range?: R2Range
}

export interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
  md5?: ArrayBuffer | string
  sha1?: ArrayBuffer | string
  sha256?: ArrayBuffer | string
  sha384?: ArrayBuffer | string
  sha512?: ArrayBuffer | string
  onlyIf?: R2Conditional
}

export interface R2ListOptions {
  limit?: number
  prefix?: string
  cursor?: string
  delimiter?: string
  startAfter?: string
  include?: ('httpMetadata' | 'customMetadata')[]
}

export interface R2Objects {
  objects: R2Object[]
  truncated: boolean
  cursor?: string
  delimitedPrefixes: string[]
}

export interface R2Checksums {
  md5?: ArrayBuffer
  sha1?: ArrayBuffer
  sha256?: ArrayBuffer
  sha384?: ArrayBuffer
  sha512?: ArrayBuffer
}

export interface R2HTTPMetadata {
  contentType?: string
  contentLanguage?: string
  contentDisposition?: string
  contentEncoding?: string
  cacheControl?: string
  cacheExpiry?: Date
}

export interface R2Conditional {
  etagMatches?: string
  etagDoesNotMatch?: string
  uploadedBefore?: Date
  uploadedAfter?: Date
}

export interface R2Range {
  offset?: number
  length?: number
  suffix?: number
}

// KV Namespace type
export interface KVNamespace {
  get(key: string, options?: KVNamespaceGetOptions): Promise<string | null>
  getWithMetadata(
    key: string,
    options?: KVNamespaceGetOptions
  ): Promise<{ value: string | null; metadata: unknown }>
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: KVNamespacePutOptions
  ): Promise<void>
  delete(key: string): Promise<void>
  list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult>
}

export interface KVNamespaceGetOptions {
  type?: 'text' | 'json' | 'arrayBuffer' | 'stream'
  cacheTtl?: number
}

export interface KVNamespacePutOptions {
  expiration?: number
  expirationTtl?: number
  metadata?: unknown
}

export interface KVNamespaceListOptions {
  limit?: number
  prefix?: string
  cursor?: string
}

export interface KVNamespaceListResult {
  keys: { name: string; expiration?: number; metadata?: unknown }[]
  list_complete: boolean
  cursor?: string
}

// ExecutionContext type
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

// Use Cloudflare's Durable Object types directly
export type DurableObjectNamespace<_T = unknown> = unknown
export type DurableObjectId = CfDurableObjectId

// Extended Durable Object Stub with custom methods
export interface DurableObjectStub extends CfDurableObjectStub {
  updateSubscriptions?(clientId: string, data: unknown): Promise<unknown>
}

// Common result types for our application
export interface ValidationResult {
  valid: boolean
  errors: string[]
  conflictingRows: number
}

export interface SnapshotListResult {
  snapshots: SchemaSnapshot[]
  total: number
}

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

export interface OperationResult {
  success: boolean
  message: string
}

export interface TableDataResult {
  data: Record<string, unknown>[]
  total: number
}
