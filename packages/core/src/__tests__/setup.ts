// Test setup for Viveforge Core
import { beforeAll, beforeEach, afterEach, afterAll } from 'vitest'

export interface MockD1Database {
  prepare: (sql: string) => MockD1PreparedStatement
  batch: (statements: MockD1PreparedStatement[]) => Promise<any>
  exec: (sql: string) => Promise<any>
}

export interface MockD1PreparedStatement {
  bind: (...params: any[]) => MockD1PreparedStatement
  run: () => Promise<{ meta: { changes: number } }>
  all: () => Promise<{ results: any[] }>
  first: () => Promise<any>
}

export interface MockR2Bucket {
  get: (key: string) => Promise<{ text: () => Promise<string> } | null>
  put: (key: string, data: string) => Promise<void>
  delete: (key: string) => Promise<void>
}

export interface MockExecutionContext {
  waitUntil: (promise: Promise<any>) => void
}

// Create mock D1 database
export function createMockD1Database(): MockD1Database {
  const tables = new Map<string, any[]>()
  const schemas = new Map<string, string>()
  const tableColumns = new Map<string, any[]>()
  const tableIndexes = new Map<string, any[]>()
  const snapshots = new Map<string, any>()
  let snapshotCounter = 0
  
  // Default system tables
  tables.set('schema_snapshots', [])
  tables.set('schema_snapshot_counter', [{ id: 1, current_version: 0 }])
  
  // Helper to extract table name from various SQL statements
  function getTableNameFromSql(sql: string): string | null {
    const createTableMatch = sql.match(/CREATE\s+TABLE\s+(\w+)/i)
    const alterTableMatch = sql.match(/ALTER\s+TABLE\s+(\w+)/i)
    const insertIntoMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i)
    const pragmaMatch = sql.match(/PRAGMA\s+\w+\s*\(\s*"?(\w+)"?\s*\)/i)
    return createTableMatch?.[1] || alterTableMatch?.[1] || insertIntoMatch?.[1] || pragmaMatch?.[1] || null
  }
  
  const createMockStatement = (sql: string, bindings: any[] = []): MockD1PreparedStatement => {
    return {
      bind: (...params: any[]) => createMockStatement(sql, params),
      run: async () => {
        // Basic SQL execution simulation
        const normalizedSql = sql.trim().toUpperCase()
        
        if (normalizedSql.startsWith('CREATE TABLE')) {
          const tableName = getTableNameFromSql(sql)
          if (tableName) {
            tables.set(tableName, [])
            schemas.set(tableName, sql)
            
            // Parse columns from CREATE TABLE statement
            const columnsMatch = sql.match(/\((.*)\)/s)
            if (columnsMatch) {
              const columnDefs = columnsMatch[1].split(',').map(col => {
                const parts = col.trim().split(/\s+/)
                return {
                  cid: 0,
                  name: parts[0],
                  type: parts[1] || 'TEXT',
                  notnull: col.includes('NOT NULL') ? 1 : 0,
                  dflt_value: null,
                  pk: col.includes('PRIMARY KEY') ? 1 : 0
                }
              })
              tableColumns.set(tableName, columnDefs)
            }
            tableIndexes.set(tableName, [])
          }
        } else if (normalizedSql.startsWith('DROP TABLE')) {
          const tableName = getTableNameFromSql(sql)
          if (tableName) {
            tables.delete(tableName)
            schemas.delete(tableName)
            tableColumns.delete(tableName)
            tableIndexes.delete(tableName)
          }
        } else if (normalizedSql.startsWith('CREATE') && normalizedSql.includes('INDEX')) {
          const indexMatch = sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)/i)
          const tableMatch = sql.match(/ON\s+(\w+)/i)
          if (indexMatch && tableMatch) {
            const indexName = indexMatch[1]
            const tableName = tableMatch[1]
            const unique = sql.toUpperCase().includes('UNIQUE')
            
            if (!tableIndexes.has(tableName)) {
              tableIndexes.set(tableName, [])
            }
            tableIndexes.get(tableName)!.push({
              name: indexName,
              unique: unique ? 1 : 0,
              sql: sql
            })
          }
        } else if (normalizedSql.startsWith('DROP INDEX')) {
          const indexMatch = sql.match(/DROP\s+INDEX\s+(\w+)/i)
          if (indexMatch) {
            const indexName = indexMatch[1]
            // Find and remove index from all tables
            for (const [tableName, indexes] of tableIndexes.entries()) {
              const indexIndex = indexes.findIndex((idx: any) => idx.name === indexName)
              if (indexIndex !== -1) {
                indexes.splice(indexIndex, 1)
                break
              }
            }
          }
        } else if (normalizedSql.startsWith('INSERT')) {
          // Handle snapshot creation
          if (normalizedSql.includes('schema_snapshots')) {
            snapshotCounter++
            const snapshotId = bindings[0] || `snapshot-${snapshotCounter}`
            const snapshot = {
              id: snapshotId,
              version: bindings[1] || snapshotCounter,
              name: bindings[2] || `Snapshot ${snapshotCounter}`,
              description: bindings[3] || null,
              full_schema: bindings[4] || '',
              tables_json: bindings[5] || '[]',
              schema_hash: bindings[6] || 'hash',
              created_at: new Date().toISOString(),
              created_by: bindings[7] || null,
              snapshot_type: bindings[8] || 'manual',
              d1_bookmark_id: bindings[9] || null
            }
            snapshots.set(snapshotId, snapshot)
            tables.get('schema_snapshots')!.push(snapshot)
          } else {
            // Regular table insert
            const tableName = getTableNameFromSql(sql)
            if (tableName && tables.has(tableName)) {
              const record = { id: Math.random().toString(36) }
              tables.get(tableName)!.push(record)
            }
          }
        }
        
        return { meta: { changes: 1 } }
      },
      all: async () => {
        const normalizedSql = sql.trim().toUpperCase()
        
        if (normalizedSql.includes('FROM SQLITE_MASTER')) {
          if (normalizedSql.includes("TYPE='TABLE'")) {
            return {
              results: Array.from(schemas.entries()).map(([name, sql]) => ({
                name,
                sql,
                type: 'table'
              }))
            }
          } else if (normalizedSql.includes("TYPE = 'INDEX'")) {
            const allIndexes: any[] = []
            for (const [tableName, indexes] of tableIndexes.entries()) {
              for (const index of indexes) {
                allIndexes.push({
                  name: index.name,
                  tbl_name: tableName,
                  sql: index.sql
                })
              }
            }
            return { results: allIndexes }
          }
        } else if (normalizedSql.startsWith('PRAGMA TABLE_INFO')) {
          const tableName = getTableNameFromSql(sql)
          if (tableName && tableColumns.has(tableName)) {
            return { results: tableColumns.get(tableName) || [] }
          }
          return { results: [] }
        } else if (normalizedSql.startsWith('PRAGMA FOREIGN_KEY_LIST')) {
          return { results: [] }
        } else if (normalizedSql.startsWith('PRAGMA INDEX_LIST')) {
          const tableName = getTableNameFromSql(sql)
          if (tableName && tableIndexes.has(tableName)) {
            return { results: tableIndexes.get(tableName) || [] }
          }
          return { results: [] }
        } else if (normalizedSql.startsWith('PRAGMA INDEX_INFO')) {
          // Extract index name from sql
          const indexMatch = sql.match(/PRAGMA\s+index_info\s*\(\s*"?(\w+)"?\s*\)/i)
          if (indexMatch) {
            const indexName = indexMatch[1]
            // Find index and return column info
            for (const indexes of tableIndexes.values()) {
              const index = indexes.find((idx: any) => idx.name === indexName)
              if (index) {
                return {
                  results: [{ seqno: 0, cid: 0, name: 'title' }] // Mock column info
                }
              }
            }
          }
          return { results: [] }
        } else if (normalizedSql.startsWith('SELECT COUNT(*)')) {
          if (normalizedSql.includes('schema_snapshots')) {
            return { results: [{ total: snapshots.size }] }
          }
          return { results: [{ count: 0 }] }
        } else if (normalizedSql.startsWith('SELECT') && normalizedSql.includes('FROM schema_snapshots')) {
          const snapshotList = Array.from(snapshots.values())
          if (normalizedSql.includes('ORDER BY version DESC')) {
            snapshotList.sort((a, b) => b.version - a.version)
          }
          return { results: snapshotList }
        }
        
        return { results: [] }
      },
      first: async () => {
        const normalizedSql = sql.trim().toUpperCase()
        
        // Handle specific first() queries
        if (normalizedSql.includes('schema_snapshot_counter')) {
          return { current_version: snapshotCounter }
        } else if (normalizedSql.includes('FROM schema_snapshots') && normalizedSql.includes('WHERE id =')) {
          const snapshotId = bindings[0]
          return snapshots.get(snapshotId) || null
        } else if (normalizedSql.includes('FROM sqlite_master') && normalizedSql.includes('WHERE type=') && normalizedSql.includes('AND name =')) {
          const tableName = bindings[0]
          return schemas.has(tableName) ? { sql: schemas.get(tableName) } : null
        }
        
        const result = await createMockStatement(sql, bindings).all()
        return result.results[0] || null
      }
    }
  }
  
  return {
    prepare: (sql: string) => createMockStatement(sql),
    batch: async (statements: MockD1PreparedStatement[]) => {
      for (const stmt of statements) {
        await stmt.run()
      }
      return { results: [] }
    },
    exec: async (sql: string) => {
      return { results: [] }
    }
  }
}

// Create mock R2 bucket
export function createMockR2Bucket(): MockR2Bucket {
  const storage = new Map<string, string>()
  
  return {
    get: async (key: string) => {
      const data = storage.get(key)
      return data ? { text: async () => data } : null
    },
    put: async (key: string, data: string) => {
      storage.set(key, data)
    },
    delete: async (key: string) => {
      storage.delete(key)
    }
  }
}

// Create mock execution context
export function createMockExecutionContext(): MockExecutionContext {
  const promises: Promise<any>[] = []
  
  return {
    waitUntil: (promise: Promise<any>) => {
      promises.push(promise)
    }
  }
}

// Helper functions
function extractTableName(sql: string): string | null {
  const createTableMatch = sql.match(/CREATE\s+TABLE\s+(\w+)/i)
  const dropTableMatch = sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i)
  return createTableMatch?.[1] || dropTableMatch?.[1] || null
}

function extractTableNameFromInsert(sql: string): string | null {
  const match = sql.match(/INSERT\s+INTO\s+(\w+)/i)
  return match?.[1] || null
}