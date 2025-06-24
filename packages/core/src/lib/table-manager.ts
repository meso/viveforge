import type {
  CustomDurableObjectNamespace,
  D1Database,
  ExecutionContext,
  OperationResult,
  R2Bucket,
  SnapshotListResult,
  TableDataResult,
  ValidationResult,
} from '../types/cloudflare'
import { ErrorHandler } from './error-handler'
import type { IndexInfo } from './index-manager'
import { IndexManager } from './index-manager'
import type { ColumnDefinition, ColumnInfo } from './schema-manager'
import { SchemaManager } from './schema-manager'
import { SchemaSnapshotManager } from './schema-snapshot'
import { validateAndEscapeColumnName, validateAndEscapeTableName } from './sql-utils'
import { TableAccessController } from './table-access-controller'
import { TableDataManager } from './table-data-manager'
import type { LocalTableInfo } from './table-operations'
import { SYSTEM_TABLES, TableOperations } from './table-operations'
import { TableValidator } from './table-validator'

interface TableManagerEnvironment {
  REALTIME?: CustomDurableObjectNamespace
}

/**
 * Main orchestrator for table operations, delegating to specialized components
 * This refactored version provides the same interface but with better separation of concerns
 */
export class TableManager {
  private snapshotManager: SchemaSnapshotManager
  private schemaManager: SchemaManager
  private indexManager: IndexManager
  private errorHandler: ErrorHandler

  // New specialized components
  private tableOperations: TableOperations
  private tableDataManager: TableDataManager
  private tableAccessController: TableAccessController
  private tableValidator: TableValidator

  constructor(
    private db: D1Database,
    private systemStorage?: R2Bucket,
    private executionCtx?: ExecutionContext,
    private env?: TableManagerEnvironment
  ) {
    this.errorHandler = ErrorHandler.getInstance()

    // Initialize legacy components (maintain compatibility)
    this.snapshotManager = new SchemaSnapshotManager(db, systemStorage)
    this.schemaManager = new SchemaManager(
      db,
      this.snapshotManager,
      this.createAsyncSnapshot.bind(this)
    )
    this.indexManager = new IndexManager(db, this.createAsyncSnapshot.bind(this))

    // Initialize new specialized components
    this.tableOperations = new TableOperations(db, this.schemaManager)
    this.tableDataManager = new TableDataManager(db, env, executionCtx)
    this.tableAccessController = new TableAccessController(db, env, executionCtx)
    this.tableValidator = new TableValidator(db)
  }

  // =================== TABLE OPERATIONS ===================

  /**
   * Get list of all tables (both system and user tables)
   */
  async getTables(): Promise<LocalTableInfo[]> {
    return this.tableOperations.getTables()
  }

  /**
   * Get column information for a specific table
   */
  async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    return this.tableOperations.getTableColumns(tableName)
  }

  /**
   * Get foreign key relationships for a table
   */
  async getForeignKeys(tableName: string): Promise<{ from: string; table: string; to: string }[]> {
    return this.tableOperations.getForeignKeys(tableName)
  }

  /**
   * Create a new user table
   */
  async createTable(tableName: string, columns: ColumnDefinition[]): Promise<void> {
    return this.tableOperations.createTable(tableName, columns)
  }

  /**
   * Drop a user table
   */
  async dropTable(tableName: string): Promise<void> {
    return this.tableOperations.dropTable(tableName)
  }

  // =================== DATA OPERATIONS ===================

  /**
   * Create a record in a table
   */
  async createRecord(tableName: string, data: Record<string, unknown>): Promise<void> {
    return this.tableDataManager.createRecord(tableName, data)
  }

  /**
   * Delete a record from a table
   */
  async deleteRecord(tableName: string, id: string): Promise<void> {
    return this.tableDataManager.deleteRecord(tableName, id)
  }

  /**
   * Get data from any table
   */
  async getTableData(tableName: string, limit = 100, offset = 0): Promise<TableDataResult> {
    return this.tableDataManager.getTableData(tableName, limit, offset)
  }

  /**
   * Get data from table with custom sorting
   */
  async getTableDataWithSort(
    tableName: string,
    limit = 100,
    offset = 0,
    sortBy?: string,
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<TableDataResult> {
    return this.tableDataManager.getTableDataWithSort(tableName, limit, offset, sortBy, sortOrder)
  }

  /**
   * Get a specific record by ID
   */
  async getRecordById(tableName: string, id: string): Promise<Record<string, unknown> | null> {
    return this.tableDataManager.getRecordById(tableName, id)
  }

  /**
   * Create a record with a specific ID (or let the system generate one)
   */
  async createRecordWithId(tableName: string, data: Record<string, unknown>): Promise<string> {
    return this.tableDataManager.createRecordWithId(tableName, data)
  }

  /**
   * Update a record in a table
   */
  async updateRecord(tableName: string, id: string, data: Record<string, unknown>): Promise<void> {
    return this.tableDataManager.updateRecord(tableName, id, data)
  }

  // =================== ACCESS CONTROL ===================

  /**
   * Get table data with access control
   */
  async getTableDataWithAccessControl(
    tableName: string,
    userId?: string,
    limit = 100,
    offset = 0,
    sortBy?: string,
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<TableDataResult> {
    return this.tableAccessController.getTableDataWithAccessControl(
      tableName,
      userId,
      limit,
      offset,
      sortBy,
      sortOrder
    )
  }

  /**
   * Get single record by ID with access control
   */
  async getRecordByIdWithAccessControl(
    tableName: string,
    id: string,
    userId?: string
  ): Promise<Record<string, unknown> | null> {
    return this.tableAccessController.getRecordByIdWithAccessControl(tableName, id, userId)
  }

  /**
   * Create record with access control (auto-set owner_id for private tables)
   */
  async createRecordWithAccessControl(
    tableName: string,
    data: Record<string, unknown>,
    userId?: string
  ): Promise<string> {
    return this.tableAccessController.createRecordWithAccessControl(tableName, data, userId)
  }

  /**
   * Update record with access control
   */
  async updateRecordWithAccessControl(
    tableName: string,
    id: string,
    data: Record<string, unknown>,
    userId?: string
  ): Promise<void> {
    return this.tableAccessController.updateRecordWithAccessControl(tableName, id, data, userId)
  }

  /**
   * Delete record with access control
   */
  async deleteRecordWithAccessControl(
    tableName: string,
    id: string,
    userId?: string
  ): Promise<void> {
    return this.tableAccessController.deleteRecordWithAccessControl(tableName, id, userId)
  }

  /**
   * Get access policy for a table
   */
  async getTableAccessPolicy(tableName: string): Promise<'public' | 'private'> {
    return this.tableAccessController.getTableAccessPolicy(tableName)
  }

  /**
   * Set access policy for a table
   */
  async setTableAccessPolicy(tableName: string, policy: 'public' | 'private'): Promise<void> {
    return this.tableAccessController.setTableAccessPolicy(tableName, policy)
  }

  // =================== SEARCH ===================

  /**
   * Get searchable columns for a table (only indexed TEXT and INTEGER columns)
   */
  async getSearchableColumns(tableName: string): Promise<Array<{ name: string; type: string }>> {
    return this.tableDataManager.getSearchableColumns(tableName)
  }

  /**
   * Search records in a table using indexed columns
   */
  async searchRecords(
    tableName: string,
    searchParams: Array<{ column: string; value: string; operator?: string }>,
    limit = 100,
    offset = 0
  ): Promise<TableDataResult> {
    return this.tableDataManager.searchRecords(tableName, searchParams, limit, offset)
  }

  // =================== INDEX MANAGEMENT ===================

  /**
   * Get indexes for a table
   */
  async getTableIndexes(tableName: string): Promise<IndexInfo[]> {
    return this.indexManager.getTableIndexes(tableName)
  }

  /**
   * Create an index
   */
  async createIndex(
    indexName: string,
    tableName: string,
    columns: string[],
    options: { unique?: boolean } = {}
  ): Promise<void> {
    return this.indexManager.createIndex(indexName, tableName, columns, options)
  }

  /**
   * Drop an index
   */
  async dropIndex(indexName: string): Promise<void> {
    return this.indexManager.dropIndex(indexName)
  }

  /**
   * Get all user indexes
   */
  async getAllUserIndexes(): Promise<IndexInfo[]> {
    return this.indexManager.getAllUserIndexes()
  }

  // =================== SCHEMA OPERATIONS ===================

  /**
   * Add column to existing table
   */
  async addColumn(
    tableName: string,
    column: {
      name: string
      type: string
      constraints?: string
      foreignKey?: { table: string; column: string }
    }
  ): Promise<void> {
    await this.enableForeignKeys()

    // Validate using the new validator
    this.tableValidator.validateTableName(tableName)
    this.tableValidator.validateNameFormat(column.name, 'column')

    // Build ALTER TABLE statement
    let alterSQL = `ALTER TABLE ${validateAndEscapeTableName(tableName)} ADD COLUMN ${validateAndEscapeColumnName(column.name)} ${column.type}`
    if (column.constraints) {
      alterSQL += ` ${column.constraints}`
    }

    // Create pre-change snapshot asynchronously
    this.createAsyncSnapshot({
      description: `Before adding column ${column.name} to ${tableName}`,
      snapshotType: 'pre_change',
    })

    console.log('Adding column with SQL:', alterSQL)
    await this.db.prepare(alterSQL).run()

    // If foreign key is specified, we need to recreate the table (SQLite limitation)
    if (column.foreignKey) {
      await this.addForeignKeyByRecreatingTable(tableName, column.name, column.foreignKey)
    }
  }

  // =================== SNAPSHOT OPERATIONS ===================

  /**
   * Create a manual snapshot
   */
  async createManualSnapshot(description?: string): Promise<OperationResult> {
    const result = await this.snapshotManager.createSnapshot(description, 'manual')
    return {
      success: true,
      message: `Snapshot created with ID: ${result.id}`,
    }
  }

  /**
   * Create a snapshot (legacy method for backward compatibility)
   */
  async createSnapshot(
    options: {
      name?: string
      description?: string
      createdBy?: string
      snapshotType?: 'manual' | 'auto' | 'pre_change'
    } = {}
  ): Promise<string> {
    const result = await this.snapshotManager.createSnapshot(
      options.description || options.name,
      options.snapshotType || 'manual'
    )
    return result.id
  }

  /**
   * Get a single snapshot by ID
   */
  async getSnapshot(id: string): Promise<Record<string, unknown> | null> {
    const snapshot = await this.snapshotManager.getSnapshot(id)
    return snapshot as Record<string, unknown> | null
  }

  /**
   * Get snapshots with pagination
   */
  async getSnapshots(limit = 100, offset = 0): Promise<SnapshotListResult> {
    return this.snapshotManager.getSnapshots(limit, offset)
  }

  /**
   * Restore from snapshot
   */
  async restoreSnapshot(id: string): Promise<OperationResult> {
    // Create pre-change snapshot before restore
    this.createAsyncSnapshot({
      description: `Before restoring snapshot ${id}`,
      snapshotType: 'pre_change',
    })

    // Disable foreign keys during restore to prevent constraint errors
    await this.disableForeignKeys()
    try {
      const result = await this.snapshotManager.restoreSnapshot(id)
      return result
    } finally {
      // Always re-enable foreign keys after restore
      await this.enableForeignKeys()
    }
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(id: string): Promise<OperationResult> {
    return this.snapshotManager.deleteSnapshot(id)
  }

  // =================== VALIDATION ===================

  /**
   * Validate database schema
   */
  async validateSchema(): Promise<ValidationResult> {
    return this.errorHandler.handleOperation(
      async () => {
        const errors: string[] = []
        const warnings: string[] = []

        try {
          // Check if all system tables exist
          for (const systemTable of SYSTEM_TABLES) {
            const exists = await this.tableDataManager.tableExists(systemTable)
            if (!exists) {
              errors.push(`System table missing: ${systemTable}`)
            }
          }

          // Check for foreign key constraint violations
          const pragmaResult = await this.db.prepare('PRAGMA foreign_key_check').all()
          if (pragmaResult.results.length > 0) {
            errors.push(`Foreign key constraint violations found: ${pragmaResult.results.length}`)
          }

          return {
            valid: errors.length === 0,
            errors,
            warnings,
            conflictingRows: 0,
          }
        } catch (error) {
          errors.push(
            `Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
          return {
            valid: false,
            errors,
            warnings,
            conflictingRows: 0,
          }
        }
      },
      { operationName: 'validateSchema' }
    )
  }

  // =================== COLUMN OPERATIONS ===================

  /**
   * Rename a column (placeholder - requires table recreation in SQLite)
   */
  async renameColumn(tableName: string, oldName: string, newName: string): Promise<void> {
    console.warn(
      `Column renaming from ${oldName} to ${newName} in table ${tableName} is not yet implemented. SQLite requires table recreation.`
    )
    throw new Error('Column renaming is not yet supported')
  }

  /**
   * Drop a column (placeholder - requires table recreation in SQLite)
   */
  async dropColumn(tableName: string, columnName: string): Promise<void> {
    console.warn(
      `Column dropping for ${columnName} in table ${tableName} is not yet implemented. SQLite requires table recreation.`
    )
    throw new Error('Column dropping is not yet supported')
  }

  /**
   * Modify a column (placeholder - requires table recreation in SQLite)
   */
  async modifyColumn(
    tableName: string,
    columnName: string,
    _newDefinition: { type: string; constraints?: string }
  ): Promise<void> {
    console.warn(
      `Column modification for ${columnName} in table ${tableName} is not yet implemented. SQLite requires table recreation.`
    )
    throw new Error('Column modification is not yet supported')
  }

  /**
   * Validate column changes (placeholder)
   */
  async validateColumnChanges(
    _tableName: string,
    _columnName: string,
    _changes: unknown
  ): Promise<ValidationResult> {
    return {
      valid: true,
      errors: [],
      conflictingRows: 0,
    }
  }

  // =================== SQL OPERATIONS ===================

  /**
   * Execute SQL query (with safety checks)
   */
  async executeSQL(_query: string): Promise<unknown> {
    console.warn('Direct SQL execution is not yet implemented for security reasons')
    throw new Error('Direct SQL execution is not yet supported')
  }

  // =================== PRIVATE HELPER METHODS ===================

  private async enableForeignKeys(): Promise<void> {
    return this.errorHandler
      .handleOperation(
        async () => {
          await this.db.prepare('PRAGMA foreign_keys = ON').run()
        },
        { operationName: 'enableForeignKeys' }
      )
      .catch((error) => {
        // Log warning but don't throw - this is non-critical
        this.errorHandler.handleStorageWarning('enableForeignKeys', error)
      })
  }

  private async disableForeignKeys(): Promise<void> {
    return this.errorHandler
      .handleOperation(
        async () => {
          await this.db.prepare('PRAGMA foreign_keys = OFF').run()
        },
        { operationName: 'disableForeignKeys' }
      )
      .catch((error) => {
        // Log warning but don't throw - this is non-critical
        this.errorHandler.handleStorageWarning('disableForeignKeys', error)
      })
  }

  private createAsyncSnapshot(options: {
    name?: string
    description?: string
    snapshotType?: 'manual' | 'auto' | 'pre_change'
  }): void {
    if (this.executionCtx) {
      this.executionCtx.waitUntil(
        (async () => {
          try {
            await this.snapshotManager.createSnapshot(
              options.description || options.name,
              options.snapshotType || 'auto'
            )
          } catch (error) {
            console.error('Failed to create async snapshot:', error)
          }
        })()
      )
    }
  }

  private async addForeignKeyByRecreatingTable(
    tableName: string,
    columnName: string,
    _foreignKey: { table: string; column: string }
  ): Promise<void> {
    // This is a complex operation that requires recreating the table
    // For now, we'll log a warning and continue without the foreign key
    console.warn(
      `Foreign key constraints for column ${columnName} in table ${tableName} will be added in a future version. ` +
        `SQLite requires table recreation for this operation.`
    )
  }
}

// Re-export types and constants for backward compatibility
export { SYSTEM_TABLES, type LocalTableInfo }
