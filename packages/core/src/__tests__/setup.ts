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
    // Handle both quoted and unquoted table names
    const createTableMatch = sql.match(/CREATE\s+TABLE\s+["']?(\w+)["']?/i)
    const alterTableMatch = sql.match(/ALTER\s+TABLE\s+["']?(\w+)["']?/i)
    const insertIntoMatch = sql.match(/INSERT\s+INTO\s+["']?(\w+)["']?/i)
    const pragmaMatch = sql.match(/PRAGMA\s+\w+\s*\(\s*["']?(\w+)["']?\s*\)/i)
    return createTableMatch?.[1] || alterTableMatch?.[1] || insertIntoMatch?.[1] || pragmaMatch?.[1] || null
  }
  
  // Helper to normalize table names by removing quotes
  function normalizeTableName(tableName: string): string {
    return tableName.replace(/["\'`]/g, '')
  }
  
  // Helper to find table with normalized name lookup
  function findTable(tableName: string): string | null {
    const normalizedName = normalizeTableName(tableName)
    for (const [key] of tables.entries()) {
      if (normalizeTableName(key) === normalizedName) {
        return key
      }
    }
    return null
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
            const normalizedName = normalizeTableName(tableName)
            tables.set(normalizedName, [])
            schemas.set(normalizedName, sql)
            
            // Parse columns from CREATE TABLE statement more robustly
            // Handle nested parentheses properly
            const createTableMatch = sql.match(/CREATE\s+TABLE\s+[^(]+\((.*)\)/s)
            if (createTableMatch) {
              const columnStr = createTableMatch[1]
              // Parse the actual user-defined columns from the SQL
              const userColumnDefs: any[] = []
              
              // Split by comma and parse each column definition
              const columnParts = columnStr.split(',').map(c => c.trim())
              let cidCounter = 1 // Start after the auto-generated id column
              
              for (const col of columnParts) {
                const trimmedCol = col.trim()
                
                // Skip auto-generated columns that are already handled by the table manager
                if (trimmedCol.startsWith('id TEXT PRIMARY KEY') || 
                    trimmedCol.includes('created_at DATETIME') || 
                    trimmedCol.includes('updated_at DATETIME')) {
                  continue
                }
                
                // Parse column definition
                const parts = trimmedCol.split(/\s+/)
                let colName = parts[0]?.replace(/["\'`]/g, '')
                
                if (colName && !['id', 'created_at', 'updated_at'].includes(colName)) {
                  userColumnDefs.push({
                    cid: cidCounter++,
                    name: colName,
                    type: parts[1] || 'TEXT',
                    notnull: trimmedCol.includes('NOT NULL') ? 1 : 0,
                    dflt_value: null,
                    pk: trimmedCol.includes('PRIMARY KEY') ? 1 : 0
                  })
                }
              }
              
              // Always add the auto-generated columns in the expected order
              const allColumns = [
                {
                  cid: 0,
                  name: 'id',
                  type: 'TEXT',
                  notnull: 0,
                  dflt_value: null,
                  pk: 1
                },
                ...userColumnDefs,
                {
                  cid: cidCounter,
                  name: 'created_at',
                  type: 'DATETIME',
                  notnull: 1,
                  dflt_value: null,
                  pk: 0
                },
                {
                  cid: cidCounter + 1,
                  name: 'updated_at',
                  type: 'DATETIME',
                  notnull: 1,
                  dflt_value: null,
                  pk: 0
                }
              ]
              
              tableColumns.set(normalizedName, allColumns)
            }
            tableIndexes.set(normalizedName, [])
          }
        } else if (normalizedSql.startsWith('DROP TABLE')) {
          const tableName = getTableNameFromSql(sql)
          if (tableName) {
            const normalizedName = normalizeTableName(tableName)
            const actualTableName = findTable(normalizedName)
            if (actualTableName) {
              tables.delete(actualTableName)
              schemas.delete(actualTableName)
              tableColumns.delete(actualTableName)
              tableIndexes.delete(actualTableName)
            }
          }
        } else if (normalizedSql.startsWith('CREATE') && normalizedSql.includes('INDEX')) {
          const indexMatch = sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+["']?(\w+)["']?/i)
          const tableMatch = sql.match(/ON\s+["']?(\w+)["']?/i)
          const columnsMatch = sql.match(/\(([^)]+)\)/i)
          if (indexMatch && tableMatch && columnsMatch) {
            const indexName = indexMatch[1]
            const tableName = normalizeTableName(tableMatch[1])
            const unique = sql.toUpperCase().includes('UNIQUE')
            const columns = columnsMatch[1].split(',').map(col => col.trim().replace(/["\'`]/g, ''))
            
            // Find the actual table name
            const actualTableName = findTable(tableName)
            if (actualTableName) {
              if (!tableIndexes.has(actualTableName)) {
                tableIndexes.set(actualTableName, [])
              }
              const existingIndexes = tableIndexes.get(actualTableName)!
              
              // Check for duplicate index name
              if (existingIndexes.some(idx => idx.name === indexName)) {
                throw new Error(`Index "${indexName}" already exists`)
              }
              
              existingIndexes.push({
                name: indexName,
                unique: unique ? 1 : 0,
                sql: sql,
                columns: columns
              })
            }
          }
        } else if (normalizedSql.startsWith('DROP INDEX')) {
          const indexMatch = sql.match(/DROP\s+INDEX\s+["']?(\w+)["']?/i)
          if (indexMatch) {
            const indexName = indexMatch[1]
            // Find and remove index from all tables
            for (const [tableName, indexes] of tableIndexes.entries()) {
              const indexIndex = indexes.findIndex((idx: any) => idx.name === indexName)
              if (indexIndex !== -1) {
                indexes.splice(indexIndex, 1)
                return { 
                  results: [], 
                  success: true, 
                  meta: { 
                    changes: 1, 
                    last_row_id: 0, 
                    duration: 1, 
                    size_after: 100, 
                    rows_read: 0, 
                    rows_written: 0 
                  } 
                }
              }
            }
          }
        } else if (normalizedSql.startsWith('ALTER TABLE') && normalizedSql.includes('ADD COLUMN')) {
          const tableName = getTableNameFromSql(sql)
          if (tableName) {
            const normalizedName = normalizeTableName(tableName)
            const actualTableName = findTable(normalizedName)
            if (actualTableName && tableColumns.has(actualTableName)) {
              // Parse the new column from ALTER TABLE statement
              const addColumnMatch = sql.match(/ADD\s+COLUMN\s+["']?(\w+)["']?\s+(\w+)/i)
              if (addColumnMatch) {
                const [, columnName, columnType] = addColumnMatch
                const columns = tableColumns.get(actualTableName)!
                const newColumn = {
                  cid: columns.length,
                  name: columnName.replace(/["'`]/g, ''),
                  type: columnType,
                  notnull: sql.includes('NOT NULL') ? 1 : 0,
                  dflt_value: null,
                  pk: 0
                }
                columns.push(newColumn)
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
            if (tableName) {
              const normalizedName = normalizeTableName(tableName)
              const actualTableName = findTable(normalizedName)
              if (actualTableName && tables.has(actualTableName)) {
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
                  
                  tables.get(actualTableName)!.push(record)
                }
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
          if (tableName) {
            const normalizedName = normalizeTableName(tableName)
            const actualTableName = findTable(normalizedName)
            if (actualTableName && tableColumns.has(actualTableName)) {
              const columns = tableColumns.get(actualTableName) || []
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
          if (tableName) {
            const normalizedName = normalizeTableName(tableName)
            const actualTableName = findTable(normalizedName)
            if (actualTableName && tableIndexes.has(actualTableName)) {
              const indexes = tableIndexes.get(actualTableName) || []
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
            const tableName = normalizeTableName(tableMatch[1])
            const actualTableName = findTable(tableName)
            const tableData = actualTableName ? (tables.get(actualTableName) || []) : []
            
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
            const tableName = normalizeTableName(tableMatch[1])
            const actualTableName = findTable(tableName)
            let tableData = actualTableName ? (tables.get(actualTableName) || []) : []
            
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
          const targetName = bindings[0]
          const normalizedName = normalizeTableName(targetName)
          
          // Check if this is a table lookup
          if (bindings.length > 0 && bindings[0] && typeof bindings[0] === 'string') {
            if (normalizedSql.includes("TYPE='table'")) {
              const actualTableName = findTable(normalizedName)
              return actualTableName && schemas.has(actualTableName) ? { sql: schemas.get(actualTableName) } : null
            } else if (normalizedSql.includes("TYPE = 'index'")) {
              // Find index across all tables
              for (const indexes of tableIndexes.values()) {
                const index = indexes.find((idx: any) => idx.name === targetName)
                if (index) {
                  return { sql: index.sql }
                }
              }
              return null
            }
          }
          
          return schemas.has(targetName) ? { sql: schemas.get(targetName) } : null
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