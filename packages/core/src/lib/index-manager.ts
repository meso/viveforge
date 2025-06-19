import { validateAndEscapeTableName, validateAndEscapeIndexName, validateAndEscapeColumnName } from './sql-utils'
import type { D1Database } from '../types/cloudflare'
import type { IndexInfo as DBIndexInfo, IndexColumnInfo } from '../types/database'

export interface IndexInfo {
  name: string
  tableName: string
  columns: string[]
  unique: boolean
  sql: string
}

export class IndexManager {
  constructor(
    private db: D1Database,
    private createAsyncSnapshot: (options: {
      name?: string
      description?: string
      snapshotType?: 'manual' | 'auto' | 'pre_change'
    }) => void
  ) {}

  private async enableForeignKeys(): Promise<void> {
    try {
      await this.db.prepare('PRAGMA foreign_keys = ON').run()
    } catch (error) {
      console.warn('Failed to enable foreign keys:', error)
    }
  }

  // Get all indexes for a specific table
  async getTableIndexes(tableName: string): Promise<IndexInfo[]> {
    await this.enableForeignKeys()
    
    try {
      // Get index list for the table
      const safeTableName = validateAndEscapeTableName(tableName)
      const indexListResult = await this.db
        .prepare(`PRAGMA index_list(${safeTableName})`)
        .all()

      const indexes: IndexInfo[] = []

      for (const indexRow of indexListResult.results) {
        const dbIndex = indexRow as DBIndexInfo
        const indexName = dbIndex.name
        
        // Skip auto-generated indexes (those starting with sqlite_autoindex_)
        if (indexName.startsWith('sqlite_autoindex_')) {
          continue
        }

        // Get detailed info about this index
        const safeIndexName = validateAndEscapeIndexName(indexName)
        const indexInfoResult = await this.db
          .prepare(`PRAGMA index_info(${safeIndexName})`)
          .all()

        const columns = indexInfoResult.results
          .sort((a: any, b: any) => a.seqno - b.seqno)
          .map((col: any) => col.name)

        // Get the original SQL from sqlite_master
        const sqlResult = await this.db
          .prepare('SELECT sql FROM sqlite_master WHERE type = ? AND name = ?')
          .bind('index', indexName)
          .first()

        indexes.push({
          name: indexName,
          tableName: tableName,
          columns: columns,
          unique: dbIndex.unique === 1,
          sql: (sqlResult as DBIndexInfo)?.sql || ''
        })
      }

      return indexes
    } catch (error) {
      console.error('Error getting table indexes:', error)
      return []
    }
  }

  // Create a new index
  async createIndex(
    indexName: string,
    tableName: string,
    columns: string[],
    options: { unique?: boolean } = {}
  ): Promise<void> {
    await this.enableForeignKeys()
    
    // Validate inputs
    if (!indexName || !tableName || !columns || columns.length === 0) {
      throw new Error('Index name, table name, and columns are required')
    }

    // Validate index name format (this will be done by validateAndEscapeIndexName)
    const safeIndexName = validateAndEscapeIndexName(indexName)
    const safeTableName = validateAndEscapeTableName(tableName)
    const safeColumns = columns.map(col => validateAndEscapeColumnName(col))

    // Check if index already exists
    const existingIndexes = await this.getTableIndexes(tableName)
    if (existingIndexes.some(idx => idx.name === indexName)) {
      throw new Error(`Index "${indexName}" already exists`)
    }

    // Create snapshot before index creation asynchronously
    this.createAsyncSnapshot({
      name: `Before creating index ${indexName}`,
      description: `Auto-snapshot before creating index ${indexName} on table ${tableName}`,
      snapshotType: 'pre_change'
    })

    try {
      const uniqueClause = options.unique ? 'UNIQUE ' : ''
      const columnsList = safeColumns.join(', ')
      const sql = `CREATE ${uniqueClause}INDEX ${safeIndexName} ON ${safeTableName} (${columnsList})`
      
      await this.db.prepare(sql).run()
    } catch (error) {
      console.error('Error creating index:', error)
      throw new Error(`Failed to create index: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Drop an existing index
  async dropIndex(indexName: string): Promise<void> {
    await this.enableForeignKeys()
    
    // Validate input
    if (!indexName) {
      throw new Error('Index name is required')
    }

    // Check if index exists and get its details
    const allIndexes = await this.getAllUserIndexes()
    const targetIndex = allIndexes.find(idx => idx.name === indexName)
    
    if (!targetIndex) {
      throw new Error(`Index "${indexName}" not found`)
    }

    // Prevent dropping system indexes
    if (indexName.startsWith('sqlite_autoindex_')) {
      throw new Error('Cannot drop system-generated indexes')
    }

    // Create snapshot before index deletion asynchronously
    this.createAsyncSnapshot({
      name: `Before dropping index ${indexName}`,
      description: `Auto-snapshot before dropping index ${indexName} from table ${targetIndex.tableName}`,
      snapshotType: 'pre_change'
    })

    try {
      const safeIndexName = validateAndEscapeIndexName(indexName)
      await this.db.prepare(`DROP INDEX ${safeIndexName}`).run()
    } catch (error) {
      console.error('Error dropping index:', error)
      throw new Error(`Failed to drop index: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Get all user-created indexes across all tables
  async getAllUserIndexes(): Promise<IndexInfo[]> {
    await this.enableForeignKeys()
    
    try {
      // Get all user-created indexes from sqlite_master
      const result = await this.db
        .prepare(`
          SELECT name, tbl_name, sql 
          FROM sqlite_master 
          WHERE type = 'index' 
          AND name NOT LIKE 'sqlite_autoindex_%'
          AND sql IS NOT NULL
          ORDER BY tbl_name, name
        `)
        .all()

      const indexes: IndexInfo[] = []

      for (const row of result.results) {
        const dbIndex = row as DBIndexInfo
        const indexName = dbIndex.name
        const tableName = (dbIndex as any).tbl_name

        // Get detailed info about this index
        const safeIndexName = validateAndEscapeIndexName(indexName)
        const indexInfoResult = await this.db
          .prepare(`PRAGMA index_info(${safeIndexName})`)
          .all()

        const columns = indexInfoResult.results
          .sort((a: any, b: any) => a.seqno - b.seqno)
          .map((col: any) => col.name)

        // Check if index is unique by parsing SQL or using PRAGMA
        const safeTableName = validateAndEscapeTableName(tableName)
        const indexListResult = await this.db
          .prepare(`PRAGMA index_list(${safeTableName})`)
          .all()

        const indexDetails = indexListResult.results.find((idx: any) => idx.name === indexName)
        
        indexes.push({
          name: indexName,
          tableName: tableName,
          columns: columns,
          unique: (indexDetails as DBIndexInfo)?.unique === 1,
          sql: dbIndex.sql || ''
        })
      }

      return indexes
    } catch (error) {
      console.error('Error getting all user indexes:', error)
      return []
    }
  }
}