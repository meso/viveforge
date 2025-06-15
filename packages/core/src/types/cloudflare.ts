/**
 * Cloudflare Workers type definitions for Vibebase
 * These provide proper typing for D1, R2, and ExecutionContext
 */

// D1 Database types
export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>
  exec(query: string): Promise<D1ExecResult>
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement
  first<T = unknown>(): Promise<T | null>
  run(): Promise<D1Result>
  all<T = unknown>(): Promise<D1Result<T>>
}

export interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: {
    changes: number
    last_row_id: number
    duration: number
    size_after: number
    rows_read: number
    rows_written: number
  }
}

export interface D1ExecResult {
  count: number
  duration: number
}

// R2 Storage types
export interface R2Bucket {
  get(key: string, options?: R2GetOptions): Promise<R2Object | null>
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object>
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

// ExecutionContext type
export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void
  passThroughOnException(): void
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
  data: any[]
  total: number
}