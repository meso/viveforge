// Test setup for Vibebase Core
import { beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import type { D1Database, D1PreparedStatement, R2Bucket, ExecutionContext } from '../types/cloudflare'

// Mock interfaces that extend the real Cloudflare types
export interface MockD1Database {
  prepare: (sql: string) => MockD1PreparedStatement
  batch: (statements: MockD1PreparedStatement[]) => Promise<any>
  exec: (sql: string) => Promise<any>
}

export interface MockD1PreparedStatement {
  bind: (...params: any[]) => MockD1PreparedStatement
  run: () => Promise<{ results: any[], success: boolean, meta: { changes: number, last_row_id: number, duration: number, size_after: number, rows_read: number, rows_written: number } }>
  all: () => Promise<{ results: any[], success: boolean, meta: { changes: number, last_row_id: number, duration: number, size_after: number, rows_read: number, rows_written: number } }>
  first: () => Promise<any>
}

export interface MockR2Bucket {
  get: (key: string) => Promise<{ 
    key: string, 
    version: string, 
    size: number, 
    etag: string, 
    httpEtag: string, 
    uploaded: Date, 
    checksums: any, 
    text: () => Promise<string>,
    json: () => Promise<any>,
    arrayBuffer: () => Promise<ArrayBuffer>,
    blob: () => Promise<Blob>
  } | null>
  put: (key: string, data: string) => Promise<{ key: string, version: string, size: number, etag: string, httpEtag: string, uploaded: Date, checksums: any, text: () => Promise<string>, json: () => Promise<any>, arrayBuffer: () => Promise<ArrayBuffer>, blob: () => Promise<Blob> }>
  delete: (key: string) => Promise<void>
  list: (options?: any) => Promise<{ objects: any[], truncated: boolean, delimitedPrefixes: string[] }>
  head: (key: string) => Promise<any>
}

export interface MockExecutionContext {
  waitUntil: (promise: Promise<any>) => void
  passThroughOnException: () => void
}

// Create mock D1 database
// Helper function to handle SELECT queries with WHERE clauses
function handleSelectWithWhere(sql: string, tableData: any[], bindings?: any[]): { results: any[] } {
  const normalizedSql = sql.trim().toUpperCase()
  
  // Simple WHERE parsing for search functionality
  if (normalizedSql.includes('WHERE')) {
    // Extract column, operator, and value from WHERE clause
    const whereMatch = sql.match(/WHERE\s+["']?(\w+)["']?\s*([=<>!]+|IS NULL|IS NOT NULL)\s*(.+)?/i)
    if (whereMatch) {
      const [, column, operator, valueStr] = whereMatch
      
      let value = valueStr?.trim().replace(/['"`]/g, '') // Remove quotes
      if (value === '?' && bindings && bindings.length > 0) {
        // Use actual bound parameter
        value = bindings[0]
      }
      
      const filteredData = tableData.filter(record => {
        const recordValue = record[column]
        
        switch (operator.toUpperCase()) {
          case '=':
            return recordValue === value
          case '>':
            return Number(recordValue) > Number(value)
          case '<':
            return Number(recordValue) < Number(value)
          case '>=':
            return Number(recordValue) >= Number(value)
          case '<=':
            return Number(recordValue) <= Number(value)
          case 'IS NULL':
            return recordValue === null || recordValue === undefined
          case 'IS NOT NULL':
            return recordValue !== null && recordValue !== undefined
          default:
            return false
        }
      })
      
      return { results: filteredData }
    }
  }
  
  return { results: tableData }
}

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
          const columnsMatch = sql.match(/\(([^)]+)\)/i)
          if (indexMatch && tableMatch && columnsMatch) {
            const indexName = indexMatch[1]
            const tableName = tableMatch[1]
            const unique = sql.toUpperCase().includes('UNIQUE')
            const columns = columnsMatch[1].split(',').map(col => col.trim())
            
            if (!tableIndexes.has(tableName)) {
              tableIndexes.set(tableName, [])
            }
            tableIndexes.get(tableName)!.push({
              name: indexName,
              unique: unique ? 1 : 0,
              sql: sql,
              columns: columns
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
          if (normalizedSql.includes('SCHEMA_SNAPSHOTS')) {
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
              // Parse column names from INSERT statement
              const columnsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i)
              if (columnsMatch) {
                const columns = columnsMatch[1].split(',').map(col => col.trim().replace(/["`]/g, ''))
                
                // Create record with bound parameters
                const record: any = { 
                  id: Math.random().toString(36).substring(2, 18) // Generate random ID
                }
                
                // Map parameters to columns
                columns.forEach((column, index) => {
                  if (bindings[index] !== undefined) {
                    record[column] = bindings[index]
                  }
                })
                
                // Add timestamp fields if they don't exist
                record.created_at = record.created_at || new Date().toISOString()
                record.updated_at = record.updated_at || new Date().toISOString()
                
                tables.get(tableName)!.push(record)
              }
            }
          }
        }
        
        return { 
          results: [], 
          success: true, 
          meta: { 
            changes: 1, 
            last_row_id: 1, 
            duration: 1, 
            size_after: 100, 
            rows_read: 0, 
            rows_written: 1 
          } 
        }
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
              })),
              success: true,
              meta: {
                changes: 0,
                last_row_id: 0,
                duration: 1,
                size_after: 100,
                rows_read: Array.from(schemas.entries()).length,
                rows_written: 0
              }
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
            return { 
              results: allIndexes,
              success: true,
              meta: {
                changes: 0,
                last_row_id: 0,
                duration: 1,
                size_after: 100,
                rows_read: allIndexes.length,
                rows_written: 0
              }
            }
          }
        } else if (normalizedSql.startsWith('PRAGMA TABLE_INFO')) {
          const tableName = getTableNameFromSql(sql)
          if (tableName && tableColumns.has(tableName)) {
            const columns = tableColumns.get(tableName) || []
            return { 
              results: columns,
              success: true,
              meta: {
                changes: 0,
                last_row_id: 0,
                duration: 1,
                size_after: 100,
                rows_read: columns.length,
                rows_written: 0
              }
            }
          }
          return { 
            results: [], 
            success: true, 
            meta: { 
              changes: 0, 
              last_row_id: 0, 
              duration: 1, 
              size_after: 100, 
              rows_read: 0, 
              rows_written: 0 
            } 
          }
        } else if (normalizedSql.startsWith('PRAGMA FOREIGN_KEY_LIST')) {
          return { 
            results: [], 
            success: true, 
            meta: { 
              changes: 0, 
              last_row_id: 0, 
              duration: 1, 
              size_after: 100, 
              rows_read: 0, 
              rows_written: 0 
            } 
          }
        } else if (normalizedSql.startsWith('PRAGMA INDEX_LIST')) {
          const tableName = getTableNameFromSql(sql)
          if (tableName && tableIndexes.has(tableName)) {
            const indexes = tableIndexes.get(tableName) || []
            return { 
              results: indexes,
              success: true,
              meta: {
                changes: 0,
                last_row_id: 0,
                duration: 1,
                size_after: 100,
                rows_read: indexes.length,
                rows_written: 0
              }
            }
          }
          return { 
            results: [], 
            success: true, 
            meta: { 
              changes: 0, 
              last_row_id: 0, 
              duration: 1, 
              size_after: 100, 
              rows_read: 0, 
              rows_written: 0 
            } 
          }
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
                  results: index.columns.map((col: string, i: number) => ({ 
                    seqno: i, 
                    cid: i, 
                    name: col 
                  })),
                  success: true,
                  meta: {
                    changes: 0,
                    last_row_id: 0,
                    duration: 1,
                    size_after: 100,
                    rows_read: index.columns.length,
                    rows_written: 0
                  }
                }
              }
            }
          }
          return { 
            results: [], 
            success: true, 
            meta: { 
              changes: 0, 
              last_row_id: 0, 
              duration: 1, 
              size_after: 100, 
              rows_read: 0, 
              rows_written: 0 
            } 
          }
        } else if (normalizedSql.startsWith('SELECT COUNT(*)')) {
          if (normalizedSql.includes('SCHEMA_SNAPSHOTS')) {
            return { 
              results: [{ total: snapshots.size }],
              success: true,
              meta: {
                changes: 0,
                last_row_id: 0,
                duration: 1,
                size_after: 100,
                rows_read: 1,
                rows_written: 0
              }
            }
          }
          
          // Handle COUNT(*) for other tables
          const tableMatch = sql.match(/FROM\s+["']?(\w+)["']?/i)
          if (tableMatch) {
            const tableName = tableMatch[1]
            const tableData = tables.get(tableName) || []
            
            // Handle WHERE clauses in COUNT queries
            if (normalizedSql.includes('WHERE')) {
              const filtered = handleSelectWithWhere(sql, tableData, bindings)
              return { 
                results: [{ total: filtered.results.length, count: filtered.results.length }],
                success: true,
                meta: {
                  changes: 0,
                  last_row_id: 0,
                  duration: 1,
                  size_after: 100,
                  rows_read: 1,
                  rows_written: 0
                }
              }
            }
            
            return { 
              results: [{ total: tableData.length, count: tableData.length }],
              success: true,
              meta: {
                changes: 0,
                last_row_id: 0,
                duration: 1,
                size_after: 100,
                rows_read: 1,
                rows_written: 0
              }
            }
          }
          
          return { 
            results: [{ count: 0 }],
            success: true,
            meta: {
              changes: 0,
              last_row_id: 0,
              duration: 1,
              size_after: 100,
              rows_read: 0,
              rows_written: 0
            }
          }
        } else if (normalizedSql.startsWith('SELECT') && normalizedSql.includes('FROM SCHEMA_SNAPSHOTS')) {
          const snapshotList = Array.from(snapshots.values())
          if (normalizedSql.includes('ORDER BY version DESC')) {
            snapshotList.sort((a, b) => b.version - a.version)
          }
          return { 
            results: snapshotList,
            success: true,
            meta: {
              changes: 0,
              last_row_id: 0,
              duration: 1,
              size_after: 100,
              rows_read: snapshotList.length,
              rows_written: 0
            }
          }
        } else if (normalizedSql.startsWith('SELECT')) {
          // Handle general SELECT queries
          const tableMatch = sql.match(/FROM\s+["']?(\w+)["']?/i)
          if (tableMatch) {
            const tableName = tableMatch[1]
            let tableData = tables.get(tableName) || []
            
            // Handle WHERE clauses for search functionality
            if (normalizedSql.includes('WHERE')) {
              const filtered = handleSelectWithWhere(sql, tableData, bindings)
              tableData = filtered.results
            }
            
            // Handle LIMIT and OFFSET for pagination
            let offset = 0
            let limit = tableData.length
            
            const limitMatch = sql.match(/LIMIT\s+(\?|\d+)(?:\s+OFFSET\s+(\?|\d+))?/i)
            if (limitMatch) {
              let bindingIndex = 0
              
              // Count ? placeholders before LIMIT in WHERE clause to know binding offset
              const beforeLimit = sql.substring(0, sql.toLowerCase().indexOf('limit'))
              const questionMarksBeforeLimit = (beforeLimit.match(/\?/g) || []).length
              bindingIndex = questionMarksBeforeLimit
              
              limit = limitMatch[1] === '?' ? (bindings?.[bindingIndex] || limit) : parseInt(limitMatch[1])
              if (limitMatch[2]) {
                offset = limitMatch[2] === '?' ? (bindings?.[bindingIndex + 1] || 0) : parseInt(limitMatch[2])
              }
            }
            
            // Apply pagination
            const paginatedData = tableData.slice(offset, offset + limit)
            
            return { 
              results: paginatedData,
              success: true,
              meta: {
                changes: 0,
                last_row_id: 0,
                duration: 1,
                size_after: 100,
                rows_read: paginatedData.length,
                rows_written: 0
              }
            }
          }
        }
        
        return { 
          results: [], 
          success: true, 
          meta: { 
            changes: 0, 
            last_row_id: 0, 
            duration: 1, 
            size_after: 100, 
            rows_read: 0, 
            rows_written: 0 
          } 
        }
      },
      first: async () => {
        const normalizedSql = sql.trim().toUpperCase()
        
        // Handle specific first() queries
        if (normalizedSql.includes('SCHEMA_SNAPSHOT_COUNTER')) {
          return { current_version: snapshotCounter }
        } else if (normalizedSql.includes('FROM SCHEMA_SNAPSHOTS') && normalizedSql.includes('WHERE ID =')) {
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
      return data ? { 
        key,
        version: '1',
        size: data.length,
        etag: 'mock-etag',
        httpEtag: '"mock-etag"',
        uploaded: new Date(),
        checksums: {},
        text: async () => data,
        json: async () => JSON.parse(data),
        arrayBuffer: async () => new TextEncoder().encode(data).buffer,
        blob: async () => new Blob([data])
      } : null
    },
    put: async (key: string, data: string) => {
      storage.set(key, data)
      return {
        key,
        version: '1',
        size: data.length,
        etag: 'mock-etag',
        httpEtag: '"mock-etag"',
        uploaded: new Date(),
        checksums: {},
        text: async () => data,
        json: async () => JSON.parse(data),
        arrayBuffer: async () => new TextEncoder().encode(data).buffer,
        blob: async () => new Blob([data])
      }
    },
    delete: async (key: string) => {
      storage.delete(key)
    },
    list: async (options?: any) => {
      return { objects: [], truncated: false, delimitedPrefixes: [] }
    },
    head: async (key: string) => {
      return null
    }
  }
}

// Create mock execution context
export function createMockExecutionContext(): MockExecutionContext {
  const promises: Promise<any>[] = []
  
  return {
    waitUntil: (promise: Promise<any>) => {
      promises.push(promise)
      // Execute the promise immediately in tests to ensure it completes
      promise.catch(error => {
        console.warn('waitUntil promise failed:', error)
      })
    },
    passThroughOnException: () => {
      // In tests, this is a no-op
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