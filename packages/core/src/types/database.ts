// Database result types for Vibebase

// Type for WHERE clause filters
export type WhereClause = Record<string, string | number | boolean | null>

export interface TableInfo {
  name: string
  sql: string
  type: string
  rowCount?: number
  [key: string]: unknown
}

export interface CountResult {
  count: number
  total?: number
  [key: string]: unknown
}

export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: unknown
  pk: number
  [key: string]: unknown
}

export interface IndexInfo {
  name: string
  unique: number
  sql: string
  [key: string]: unknown
}

export interface IndexColumnInfo {
  seqno: number
  cid: number
  name: string
  [key: string]: unknown
}

export interface ForeignKeyInfo {
  id: number
  seq: number
  table: string
  from: string
  to: string
  on_update: string
  on_delete: string
  match: string
  [key: string]: unknown
}

export interface SnapshotRecord {
  id: string
  version: number
  name: string
  description: string | null
  full_schema: string
  tables_json: string
  schema_hash: string
  created_at: string
  created_by: string | null
  snapshot_type: string
  d1_bookmark_id: string | null
  [key: string]: unknown
}

export interface SchemaSnapshotCounterRecord {
  current_version: number
  [key: string]: unknown
}

export interface AdminRecord {
  id: string
  email: string
  provider: string
  provider_id: string
  created_at: string
  updated_at: string
}
