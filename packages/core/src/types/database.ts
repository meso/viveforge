// Database result types for Vibebase
export interface TableInfo {
  name: string
  sql: string
  type: string
  rowCount?: number
}

export interface CountResult {
  count: number
  total?: number
}

export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: unknown
  pk: number
}

export interface IndexInfo {
  name: string
  unique: number
  sql: string
}

export interface IndexColumnInfo {
  seqno: number
  cid: number
  name: string
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
}

export interface SchemaSnapshotCounterRecord {
  current_version: number
}

export interface AdminRecord {
  id: string
  email: string
  provider: string
  provider_id: string
  created_at: string
  updated_at: string
}
