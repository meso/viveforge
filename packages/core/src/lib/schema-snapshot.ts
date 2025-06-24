// Use Web Crypto API instead of Node.js crypto for Cloudflare Workers
import type {
  D1Database,
  OperationResult,
  R2Bucket,
  SchemaSnapshot,
  SnapshotListResult,
} from '../types/cloudflare'
import type {
  CountResult,
  IndexInfo as DBIndexInfo,
  SchemaSnapshotCounterRecord,
  SnapshotRecord,
  TableInfo,
} from '../types/database'
import type { IndexInfo } from './index-manager'

interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: unknown
  pk: number
}

export interface TableSchema {
  name: string
  sql: string
  columns: ColumnInfo[]
  foreignKeys: { from: string; table: string; to: string }[]
  indexes: IndexInfo[]
}

export class SchemaSnapshotManager {
  constructor(
    private db: D1Database,
    private systemStorage?: R2Bucket
  ) {}

  // Get all table schemas excluding system tables
  async getAllTableSchemas(): Promise<TableSchema[]> {
    const result = await this.db
      .prepare(`
        SELECT name, sql 
        FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%' 
        AND name != '_cf_KV'
        AND name != 'schema_snapshots'
        AND name != 'schema_snapshot_counter'
        ORDER BY name
      `)
      .all()

    const schemas: TableSchema[] = []

    for (const table of result.results) {
      const tableInfo = table as TableInfo
      const columnsResult = await this.db.prepare(`PRAGMA table_info("${tableInfo.name}")`).all()

      const foreignKeysResult = await this.db
        .prepare(`PRAGMA foreign_key_list("${tableInfo.name}")`)
        .all()

      // Get indexes for this table
      const indexesResult = await this.db.prepare(`PRAGMA index_list("${tableInfo.name}")`).all()

      const indexes: IndexInfo[] = []
      for (const indexRow of indexesResult.results) {
        const indexInfo = indexRow as DBIndexInfo
        const indexName = indexInfo.name

        // Skip auto-generated indexes
        if (indexName.startsWith('sqlite_autoindex_')) {
          continue
        }

        // Get index details
        const indexInfoResult = await this.db.prepare(`PRAGMA index_info("${indexName}")`).all()

        const columns = indexInfoResult.results
          .sort(
            (a: Record<string, unknown>, b: Record<string, unknown>) =>
              (a.seqno as number) - (b.seqno as number)
          )
          .map((col: Record<string, unknown>) => col.name as string)

        // Get the original SQL from sqlite_master
        const sqlResult = await this.db
          .prepare('SELECT sql FROM sqlite_master WHERE type = ? AND name = ?')
          .bind('index', indexName)
          .first()

        indexes.push({
          name: indexName,
          tableName: tableInfo.name,
          columns: columns,
          unique: indexInfo.unique === 1,
          sql: (sqlResult as DBIndexInfo)?.sql || '',
        })
      }

      schemas.push({
        name: tableInfo.name,
        sql: tableInfo.sql,
        columns: columnsResult.results.map((col) => col as unknown as ColumnInfo),
        foreignKeys: foreignKeysResult.results as { from: string; table: string; to: string }[],
        indexes: indexes,
      })
    }

    return schemas
  }

  // Get all table data (excluding system tables)
  async getAllTableData(): Promise<{ [tableName: string]: Record<string, unknown>[] }> {
    const schemas = await this.getAllTableSchemas()
    const allData: { [tableName: string]: Record<string, unknown>[] } = {}

    for (const schema of schemas) {
      // Skip system tables
      if (
        ['admins', 'sessions', 'schema_snapshots', 'schema_snapshot_counter'].includes(schema.name)
      ) {
        continue
      }

      try {
        const result = await this.db.prepare(`SELECT * FROM "${schema.name}"`).all()
        allData[schema.name] = result.results as Record<string, unknown>[]
      } catch (error) {
        console.warn(`Failed to get data for table ${schema.name}:`, error)
        allData[schema.name] = []
      }
    }

    return allData
  }

  // Calculate schema hash for comparison using Web Crypto API
  async calculateSchemaHash(schemas: TableSchema[]): Promise<string> {
    const schemaString = schemas
      .map((s) => s.sql)
      .sort()
      .join('|')

    const encoder = new TextEncoder()
    const data = encoder.encode(schemaString)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  // Check if schema has changed
  async hasSchemaChanged(): Promise<boolean> {
    const currentSchemas = await this.getAllTableSchemas()
    const currentHash = await this.calculateSchemaHash(currentSchemas)

    // Get latest snapshot
    const latestSnapshot = await this.db
      .prepare(`
        SELECT schema_hash 
        FROM schema_snapshots 
        ORDER BY version DESC 
        LIMIT 1
      `)
      .first()

    if (!latestSnapshot) {
      return true // No snapshots yet
    }

    return currentHash !== (latestSnapshot as SnapshotRecord).schema_hash
  }

  // Get next version number
  async getNextVersion(): Promise<number> {
    // Try to get current version
    const counter = await this.db
      .prepare('SELECT current_version FROM schema_snapshot_counter WHERE id = 1')
      .first()

    if (!counter) {
      // Initialize counter
      await this.db
        .prepare('INSERT INTO schema_snapshot_counter (id, current_version) VALUES (1, 0)')
        .run()
      return 1
    }

    const nextVersion = (counter as SchemaSnapshotCounterRecord).current_version + 1

    // Update counter
    await this.db
      .prepare('UPDATE schema_snapshot_counter SET current_version = ? WHERE id = 1')
      .bind(nextVersion)
      .run()

    return nextVersion
  }

  // Create a new snapshot (overloaded method for backward compatibility)
  async createSnapshot(
    description?: string,
    snapshotType?: 'manual' | 'auto' | 'pre_change'
  ): Promise<{ id: string }>
  async createSnapshot(options: {
    name?: string
    description?: string
    createdBy?: string
    snapshotType?: 'manual' | 'auto' | 'pre_change'
    d1BookmarkId?: string
  }): Promise<{ id: string }>
  async createSnapshot(
    optionsOrDescription?:
      | {
          name?: string
          description?: string
          createdBy?: string
          snapshotType?: 'manual' | 'auto' | 'pre_change'
          d1BookmarkId?: string
        }
      | string,
    snapshotType?: 'manual' | 'auto' | 'pre_change'
  ): Promise<{ id: string }> {
    // Handle the two different call signatures
    let options: {
      name?: string
      description?: string
      createdBy?: string
      snapshotType?: 'manual' | 'auto' | 'pre_change'
      d1BookmarkId?: string
    } = {}

    if (typeof optionsOrDescription === 'string') {
      // Called with description and snapshotType
      options = {
        description: optionsOrDescription,
        snapshotType: snapshotType || 'manual',
      }
    } else {
      // Called with options object
      options = optionsOrDescription || {}
    }
    const schemas = await this.getAllTableSchemas()
    const fullSchema = schemas.map((s) => s.sql).join(';\n')
    const schemaHash = await this.calculateSchemaHash(schemas)
    const version = await this.getNextVersion()
    const id = crypto.randomUUID()

    // Save schema and data to R2 if available
    if (this.systemStorage) {
      try {
        // Get all table data
        const allData = await this.getAllTableData()

        // Save data to R2
        const dataKey = `snapshots/${id}/data.json`
        await this.systemStorage.put(dataKey, JSON.stringify(allData))

        // Save schema info to R2
        const schemaKey = `snapshots/${id}/schema.json`
        await this.systemStorage.put(schemaKey, JSON.stringify(schemas))
      } catch (error) {
        console.warn('Failed to save data to R2, continuing with schema-only snapshot:', error)
      }
    }

    await this.db
      .prepare(`
        INSERT INTO schema_snapshots (
          id, version, name, description, full_schema, tables_json, 
          schema_hash, created_by, snapshot_type, d1_bookmark_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        version,
        options.name || `Snapshot v${version}`,
        options.description || null,
        fullSchema,
        JSON.stringify(schemas),
        schemaHash,
        options.createdBy || null,
        options.snapshotType || 'manual',
        options.d1BookmarkId || null
      )
      .run()

    return { id }
  }

  // Get all snapshots
  async getSnapshots(limit = 20, offset = 0): Promise<SnapshotListResult> {
    const countResult = await this.db
      .prepare('SELECT COUNT(*) as total FROM schema_snapshots')
      .first()

    const result = await this.db
      .prepare(`
        SELECT 
          id, version, name, description, full_schema, tables_json,
          schema_hash, created_at, created_by, snapshot_type, d1_bookmark_id
        FROM schema_snapshots 
        ORDER BY version DESC 
        LIMIT ? OFFSET ?
      `)
      .bind(limit, offset)
      .all()

    const snapshots: SchemaSnapshot[] = result.results.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      version: row.version as number,
      name: row.name as string,
      description: row.description === null ? undefined : (row.description as string),
      fullSchema: row.full_schema as string,
      tablesJson: row.tables_json as string,
      schemaHash: row.schema_hash as string,
      createdAt: row.created_at as string,
      createdBy: row.created_by === null ? undefined : (row.created_by as string),
      snapshotType: row.snapshot_type as 'manual' | 'auto' | 'pre_change',
      d1BookmarkId: row.d1_bookmark_id === null ? undefined : (row.d1_bookmark_id as string),
    }))

    return {
      snapshots,
      total: (countResult as CountResult)?.total || 0,
    }
  }

  // Get single snapshot
  async getSnapshot(id: string): Promise<SchemaSnapshot | null> {
    const result = await this.db
      .prepare(`
        SELECT 
          id, version, name, description, full_schema, tables_json,
          schema_hash, created_at, created_by, snapshot_type, d1_bookmark_id
        FROM schema_snapshots 
        WHERE id = ?
      `)
      .bind(id)
      .first()

    if (!result) return null

    const record = result as Record<string, unknown>
    return {
      id: record.id as string,
      version: record.version as number,
      name: record.name as string,
      description: record.description === null ? undefined : (record.description as string),
      fullSchema: record.full_schema as string,
      tablesJson: record.tables_json as string,
      schemaHash: record.schema_hash as string,
      createdAt: record.created_at as string,
      createdBy: record.created_by === null ? undefined : (record.created_by as string),
      snapshotType: record.snapshot_type as 'manual' | 'auto' | 'pre_change',
      d1BookmarkId: record.d1_bookmark_id === null ? undefined : (record.d1_bookmark_id as string),
    }
  }

  // Restore from snapshot
  async restoreSnapshot(snapshotId: string): Promise<OperationResult> {
    const snapshot = await this.getSnapshot(snapshotId)
    if (!snapshot) {
      throw new Error('Snapshot not found')
    }

    const schemas: TableSchema[] = JSON.parse(snapshot.tablesJson)

    // Try to get data from R2
    let snapshotData: { [tableName: string]: Record<string, unknown>[] } = {}
    if (this.systemStorage) {
      try {
        const dataKey = `snapshots/${snapshotId}/data.json`
        const dataObject = await this.systemStorage.get(dataKey)
        if (dataObject) {
          const dataText = await dataObject.text()
          snapshotData = JSON.parse(dataText)
        }
      } catch (error) {
        console.warn('Failed to get data from R2, restoring schema only:', error)
      }
    }

    // Begin restoration
    try {
      // Create a new transaction-like approach using batch
      const allStatements = []

      // First statement: disable foreign keys
      allStatements.push(this.db.prepare('PRAGMA foreign_keys = OFF'))

      // Get current user tables
      const currentTables = await this.db
        .prepare(`
          SELECT name 
          FROM sqlite_master 
          WHERE type='table' 
          AND name NOT LIKE 'sqlite_%' 
          AND name != '_cf_KV'
          AND name NOT IN ('admins', 'sessions', 'schema_snapshots', 'schema_snapshot_counter', 'd1_migrations')
        `)
        .all()

      // Sort tables for deletion in reverse dependency order
      const tableNames = currentTables.results.map((t: Record<string, unknown>) => t.name as string)
      const deletionOrder = this.sortTablesForDeletion(tableNames)

      // Add DROP statements in correct order
      for (const tableName of deletionOrder) {
        allStatements.push(this.db.prepare(`DROP TABLE IF EXISTS "${tableName}"`))
      }

      // Prepare table creation and data insertion statements
      const schemasToRestore = schemas.filter(
        (schema) =>
          ![
            'admins',
            'sessions',
            'schema_snapshots',
            'schema_snapshot_counter',
            'd1_migrations',
          ].includes(schema.name)
      )

      // Define dependency order (parent tables first)
      const tablePriority = {
        users: 1, // Usually the base table that others reference
        items: 2, // May reference users
        messages: 3, // May reference users and items
      }

      // Sort tables by priority
      schemasToRestore.sort((a, b) => {
        const priorityA = tablePriority[a.name as keyof typeof tablePriority] || 999
        const priorityB = tablePriority[b.name as keyof typeof tablePriority] || 999
        if (priorityA !== priorityB) return priorityA - priorityB
        return a.name.localeCompare(b.name)
      })

      // Add CREATE statements for all tables
      for (const schema of schemasToRestore) {
        allStatements.push(this.db.prepare(schema.sql))
      }

      // Execute all statements in a single batch
      try {
        await this.db.batch(allStatements)
      } catch (batchError) {
        console.error('Batch execution failed:', batchError)
        throw new Error(
          `Failed to restore schema: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`
        )
      }

      // Now insert data if available (separate batch for data)
      if (Object.keys(snapshotData).length > 0) {
        for (const schema of schemasToRestore) {
          if (snapshotData[schema.name] && snapshotData[schema.name].length > 0) {
            const tableData = snapshotData[schema.name]

            const columns = Object.keys(tableData[0])
            const placeholders = columns.map(() => '?').join(', ')
            const insertSQL = `INSERT INTO "${schema.name}" (${columns.join(', ')}) VALUES (${placeholders})`

            // Insert records individually with FK disabled
            let _insertedCount = 0
            for (const record of tableData) {
              const values = columns.map((col) => (record[col] === undefined ? null : record[col]))
              try {
                // Ensure FK are off for inserts too
                await this.db.prepare('PRAGMA foreign_keys = OFF').run()
                await this.db
                  .prepare(insertSQL)
                  .bind(...values)
                  .run()
                _insertedCount++
              } catch (_insertError) {
                // Continue with other records on error
              }
            }
          }
        }
      }

      // Restore indexes
      for (const schema of schemasToRestore) {
        if (schema.indexes && schema.indexes.length > 0) {
          for (const index of schema.indexes) {
            if (index.sql) {
              try {
                await this.db.prepare(index.sql).run()
              } catch (indexError) {
                console.warn(`Failed to restore index ${index.name}:`, indexError)
                // Continue with other indexes
              }
            }
          }
        }
      }

      // Re-enable foreign keys before creating post-restore snapshot
      await this.db.prepare('PRAGMA foreign_keys = ON').run()

      return { success: true, message: 'スナップショットが正常に復元されました' }
    } catch (error) {
      // Try to re-enable foreign keys even on error
      try {
        await this.db.prepare('PRAGMA foreign_keys = ON').run()
      } catch (e) {
        console.warn('Failed to re-enable foreign keys:', e)
      }

      throw error
    }
  }

  // Helper method to sort tables for deletion (children before parents)
  private sortTablesForDeletion(tableNames: string[]): string[] {
    // Define known dependencies (reverse of creation order)
    const deletionPriority = {
      messages: 1, // Delete first (depends on users and items)
      items: 2, // Delete second (depends on users)
      users: 3, // Delete last (no dependencies)
    }

    return tableNames.sort((a, b) => {
      const priorityA = deletionPriority[a as keyof typeof deletionPriority] || 0
      const priorityB = deletionPriority[b as keyof typeof deletionPriority] || 0
      if (priorityA !== priorityB) return priorityA - priorityB
      return a.localeCompare(b)
    })
  }

  // Delete old snapshots (keep N most recent)
  async deleteSnapshot(id: string): Promise<OperationResult> {
    // Check if snapshot exists
    const snapshot = await this.getSnapshot(id)
    if (!snapshot) {
      throw new Error('Snapshot not found')
    }

    // Delete snapshot from database
    await this.db.prepare('DELETE FROM schema_snapshots WHERE id = ?').bind(id).run()

    // Try to delete associated data from R2
    if (this.systemStorage) {
      try {
        const dataKey = `snapshots/${id}/data.json`
        await this.systemStorage.delete(dataKey)
      } catch (error) {
        // Continue even if R2 deletion fails
        console.warn('Failed to delete snapshot data from R2:', error)
      }
    }

    return { success: true, message: 'スナップショットが削除されました' }
  }

  async pruneSnapshots(keepCount: number): Promise<number> {
    const result = await this.db
      .prepare(`
        DELETE FROM schema_snapshots 
        WHERE id NOT IN (
          SELECT id FROM schema_snapshots 
          ORDER BY version DESC 
          LIMIT ?
        )
      `)
      .bind(keepCount)
      .run()

    return result.meta.changes || 0
  }
}
