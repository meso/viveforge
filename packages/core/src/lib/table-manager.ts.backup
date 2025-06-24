import type {
  D1Database,
  ExecutionContext,
  OperationResult,
  R2Bucket,
  SnapshotListResult,
  TableDataResult,
  ValidationResult,
} from '../types/cloudflare'
import type { CountResult, IndexColumnInfo, TableInfo } from '../types/database'
import { DataManager } from './data-manager'
import { ErrorHandler } from './error-handler'
import type { IndexInfo } from './index-manager'
import { IndexManager } from './index-manager'
import type { ColumnDefinition, ColumnInfo } from './schema-manager'
import { SchemaManager } from './schema-manager'
import { SchemaSnapshotManager } from './schema-snapshot'
import { validateAndEscapeColumnName, validateAndEscapeTableName } from './sql-utils'

interface TableManagerEnvironment {
  REALTIME?: DurableObjectNamespace<undefined>
}

// System tables that cannot be modified by users
export const SYSTEM_TABLES = [
  'admins',
  'sessions',
  'schema_snapshots',
  'schema_snapshot_counter',
  'd1_migrations',
  'api_keys',
  'user_sessions',
  'oauth_providers',
  'app_settings',
  'table_policies',
  'hooks',
  'event_queue',
  'realtime_subscriptions',
  'custom_queries',
  'custom_query_logs',
  'push_subscriptions',
  'notification_rules',
  'notification_templates',
  'notification_logs',
] as const
type SystemTable = (typeof SYSTEM_TABLES)[number]

export interface LocalTableInfo {
  name: string
  type: 'system' | 'user'
  sql: string // CREATE TABLE statement
  rowCount?: number
  access_policy?: 'public' | 'private'
}

export class TableManager {
  private snapshotManager: SchemaSnapshotManager
  private schemaManager: SchemaManager
  private dataManager: DataManager
  private indexManager: IndexManager
  private errorHandler: ErrorHandler

  constructor(
    private db: D1Database,
    private systemStorage?: R2Bucket,
    private executionCtx?: ExecutionContext,
    private env?: TableManagerEnvironment
  ) {
    this.errorHandler = ErrorHandler.getInstance()
    // Only initialize snapshotManager if R2 is available
    this.snapshotManager = new SchemaSnapshotManager(db, systemStorage)
    this.schemaManager = new SchemaManager(
      db,
      this.snapshotManager,
      this.createAsyncSnapshot.bind(this)
    )
    this.dataManager = new DataManager(db, env, executionCtx)
    this.indexManager = new IndexManager(db, this.createAsyncSnapshot.bind(this))
  }

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

  // Get all tables with their types
  async getTables(): Promise<LocalTableInfo[]> {
    await this.enableForeignKeys()
    const result = await this.db
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_cf_KV'"
      )
      .all()

    const tables: LocalTableInfo[] = []

    for (const row of result.results) {
      const tableRow = row as TableInfo
      const name = tableRow.name
      const isSystem = SYSTEM_TABLES.includes(name as SystemTable)

      // Get row count for each table
      let rowCount = 0
      try {
        const countResult = await this.db
          .prepare(`SELECT COUNT(*) as count FROM ${validateAndEscapeTableName(name)}`)
          .first()
        rowCount = (countResult as CountResult)?.count || 0
      } catch (e) {
        this.errorHandler.handleStorageWarning(`getRowCountFor${name}`, e)
      }

      // Get access policy for user tables
      let access_policy: 'public' | 'private' | undefined
      if (!isSystem) {
        try {
          const policyResult = await this.db
            .prepare(`SELECT access_policy FROM table_policies WHERE table_name = ?`)
            .bind(name)
            .first()
          interface PolicyResult {
            access_policy: 'public' | 'private'
            [key: string]: unknown
          }
          access_policy = (policyResult as PolicyResult)?.access_policy || 'public'
        } catch (_e) {
          // If table_policies doesn't exist yet, default to public
          access_policy = 'public'
        }
      }

      tables.push({
        name,
        type: isSystem ? 'system' : 'user',
        sql: tableRow.sql,
        rowCount,
        access_policy,
      })
    }

    return tables.sort((a, b) => {
      // System tables first, then alphabetical
      if (a.type !== b.type) return a.type === 'system' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  // Get columns for a specific table
  async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    return this.schemaManager.getTableColumns(tableName)
  }

  // Get foreign key constraints for a specific table
  async getForeignKeys(tableName: string): Promise<{ from: string; table: string; to: string }[]> {
    return this.schemaManager.getForeignKeys(tableName)
  }

  // Helper method to create async snapshots
  private createAsyncSnapshot(options: {
    name?: string
    description?: string
    createdBy?: string
    snapshotType?: 'manual' | 'auto' | 'pre_change'
  }): void {
    if (this.executionCtx?.waitUntil) {
      this.executionCtx.waitUntil(
        this.snapshotManager.createSnapshot(options).catch((error: unknown) => {
          this.errorHandler.handleStorageWarning('createAsyncSnapshot', error)
        })
      )
    } else {
      // Fallback for when executionCtx is not available
      this.snapshotManager.createSnapshot(options).catch((error: unknown) => {
        this.errorHandler.handleStorageWarning('createFallbackSnapshot', error)
      })
    }
  }

  // Create a new user table
  async createTable(tableName: string, columns: ColumnDefinition[]): Promise<void> {
    return this.schemaManager.createTable(tableName, columns)
  }

  // Drop a user table
  async dropTable(tableName: string): Promise<void> {
    return this.schemaManager.dropTable(tableName)
  }

  // Create a record in a table
  async createRecord(tableName: string, data: Record<string, unknown>): Promise<void> {
    return this.dataManager.createRecord(tableName, data)
  }

  // Delete a record from a table
  async deleteRecord(tableName: string, id: string): Promise<void> {
    return this.dataManager.deleteRecord(tableName, id)
  }

  // Get data from any table
  async getTableData(tableName: string, limit = 100, offset = 0): Promise<TableDataResult> {
    return this.dataManager.getTableData(tableName, limit, offset)
  }

  // Get data from table with custom sorting
  async getTableDataWithSort(
    tableName: string,
    limit = 100,
    offset = 0,
    sortBy?: string,
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<TableDataResult> {
    return this.dataManager.getTableDataWithSort(tableName, limit, offset, sortBy, sortOrder)
  }

  // Get table data with access control
  async getTableDataWithAccessControl(
    tableName: string,
    userId?: string,
    limit = 100,
    offset = 0,
    sortBy?: string,
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<TableDataResult> {
    // Get access policy for the table
    const accessPolicy = await this.getTableAccessPolicy(tableName)

    return this.dataManager.getTableDataWithAccessControl(
      tableName,
      accessPolicy,
      userId,
      limit,
      offset,
      sortBy,
      sortOrder
    )
  }

  // Get single record by ID
  async getRecordById(tableName: string, id: string): Promise<Record<string, unknown> | null> {
    return this.dataManager.getRecordById(tableName, id)
  }

  // Get single record by ID with access control
  async getRecordByIdWithAccessControl(
    tableName: string,
    id: string,
    userId?: string
  ): Promise<Record<string, unknown> | null> {
    // Get access policy for the table
    const accessPolicy = await this.getTableAccessPolicy(tableName)

    return this.dataManager.getRecordByIdWithAccessControl(tableName, id, accessPolicy, userId)
  }

  // Create record and return the generated ID
  async createRecordWithId(tableName: string, data: Record<string, unknown>): Promise<string> {
    return this.dataManager.createRecordWithId(tableName, data)
  }

  // Create record with access control (auto-set owner_id for private tables)
  async createRecordWithAccessControl(
    tableName: string,
    data: Record<string, unknown>,
    userId?: string
  ): Promise<string> {
    // Get access policy for the table
    const accessPolicy = await this.getTableAccessPolicy(tableName)

    return this.dataManager.createRecordWithAccessControl(tableName, data, accessPolicy, userId)
  }

  // Update record
  async updateRecord(tableName: string, id: string, data: Record<string, unknown>): Promise<void> {
    return this.dataManager.updateRecord(tableName, id, data)
  }

  // Add column to existing table
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

    // Validate table name and column name
    this.errorHandler.validateSystemTable(tableName)
    this.errorHandler.validateNameFormat(column.name, 'column')

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

  // Helper method to add foreign key by recreating table (SQLite limitation)
  private async addForeignKeyByRecreatingTable(
    tableName: string,
    columnName: string,
    foreignKey: { table: string; column: string }
  ): Promise<void> {
    // Get current table schema
    const tableInfo = (await this.db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
      .bind(tableName)
      .first()) as TableInfo | null

    if (!tableInfo) {
      this.errorHandler.handleNotFound('Table', tableName)
      return
    }

    // Create temp table with new foreign key
    const tempTableName = `${tableName}_temp_${Date.now()}`
    const originalSQL = tableInfo.sql

    // Parse and modify the CREATE TABLE statement to add foreign key
    const modifiedSQL = this.addForeignKeyToCreateStatement(
      originalSQL,
      columnName,
      foreignKey,
      tempTableName
    )

    // Use batch operation for atomic transaction
    const statements = [
      this.db.prepare(modifiedSQL),
      this.db.prepare(
        `INSERT INTO ${validateAndEscapeTableName(tempTableName)} SELECT * FROM ${validateAndEscapeTableName(tableName)}`
      ),
      this.db.prepare(`DROP TABLE ${validateAndEscapeTableName(tableName)}`),
      this.db.prepare(
        `ALTER TABLE ${validateAndEscapeTableName(tempTableName)} RENAME TO ${validateAndEscapeTableName(tableName)}`
      ),
    ]

    await this.db.batch(statements)
  }

  // Helper to modify CREATE TABLE statement to add foreign key
  private addForeignKeyToCreateStatement(
    sql: string,
    columnName: string,
    foreignKey: { table: string; column: string },
    newTableName: string
  ): string {
    // Replace table name
    let modifiedSQL = sql.replace(
      /CREATE TABLE\s+(\w+)/i,
      `CREATE TABLE ${validateAndEscapeTableName(newTableName)}`
    )

    // Find the closing parenthesis and add foreign key before it
    const lastParen = modifiedSQL.lastIndexOf(')')
    const fkConstraint = `, FOREIGN KEY (${validateAndEscapeColumnName(columnName)}) REFERENCES ${validateAndEscapeTableName(foreignKey.table)}(${validateAndEscapeColumnName(foreignKey.column)})`

    modifiedSQL = modifiedSQL.slice(0, lastParen) + fkConstraint + modifiedSQL.slice(lastParen)

    return modifiedSQL
  }

  // Rename column (requires table recreation in SQLite)
  async renameColumn(tableName: string, oldName: string, newName: string): Promise<void> {
    await this.enableForeignKeys()

    this.errorHandler.validateSystemTable(tableName)

    // Create pre-change snapshot asynchronously
    this.createAsyncSnapshot({
      description: `Before renaming column ${oldName} to ${newName} in ${tableName}`,
      snapshotType: 'pre_change',
    })

    // SQLite 3.25.0+ supports ALTER TABLE RENAME COLUMN
    const sql = `ALTER TABLE ${validateAndEscapeTableName(tableName)} RENAME COLUMN ${validateAndEscapeColumnName(oldName)} TO ${validateAndEscapeColumnName(newName)}`
    console.log('Renaming column with SQL:', sql)
    await this.db.prepare(sql).run()
  }

  // Drop column (requires table recreation in SQLite)
  async dropColumn(tableName: string, columnName: string): Promise<void> {
    await this.enableForeignKeys()

    this.errorHandler.validateSystemTable(tableName)

    // Create pre-change snapshot asynchronously
    this.createAsyncSnapshot({
      description: `Before dropping column ${columnName} from ${tableName}`,
      snapshotType: 'pre_change',
    })

    // SQLite 3.35.0+ supports ALTER TABLE DROP COLUMN
    const sql = `ALTER TABLE ${validateAndEscapeTableName(tableName)} DROP COLUMN ${validateAndEscapeColumnName(columnName)}`
    console.log('Dropping column with SQL:', sql)
    await this.db.prepare(sql).run()
  }

  // Add foreign key constraint to existing column (requires table recreation)
  async addForeignKeyToColumn(
    tableName: string,
    columnName: string,
    foreignKey: { table: string; column: string }
  ): Promise<void> {
    await this.enableForeignKeys()

    this.errorHandler.validateSystemTable(tableName)

    // In SQLite, we need to recreate the table to add foreign key constraints
    await this.addForeignKeyByRecreatingTable(tableName, columnName, foreignKey)
  }

  // Validate data before constraint/type changes
  async validateColumnChanges(
    tableName: string,
    columnName: string,
    changes: {
      type?: string
      notNull?: boolean
      foreignKey?: { table: string; column: string } | null
    }
  ): Promise<ValidationResult> {
    const errors: string[] = []
    let conflictingRows = 0

    // Check for NOT NULL constraint violations
    if (changes.notNull === true) {
      const nullCheckResult = await this.db
        .prepare(
          `SELECT COUNT(*) as count FROM ${validateAndEscapeTableName(tableName)} WHERE ${validateAndEscapeColumnName(columnName)} IS NULL`
        )
        .first()

      const nullCount = (nullCheckResult as CountResult)?.count || 0
      if (nullCount > 0) {
        errors.push(
          `Cannot add NOT NULL constraint: ${nullCount} rows have NULL values in column '${columnName}'`
        )
        conflictingRows += nullCount
      }
    }

    // Check for foreign key constraint violations
    if (changes.foreignKey) {
      const fkCheckResult = await this.db
        .prepare(`
          SELECT COUNT(*) as count 
          FROM ${validateAndEscapeTableName(tableName)} t1 
          WHERE t1.${validateAndEscapeColumnName(columnName)} IS NOT NULL 
          AND NOT EXISTS (
            SELECT 1 FROM ${validateAndEscapeTableName(changes.foreignKey.table)} t2 
            WHERE t2.${validateAndEscapeColumnName(changes.foreignKey.column)} = t1.${validateAndEscapeColumnName(columnName)}
          )
        `)
        .first()

      const fkViolationCount = (fkCheckResult as CountResult)?.count || 0
      if (fkViolationCount > 0) {
        errors.push(
          `Cannot add foreign key constraint: ${fkViolationCount} rows reference non-existent values in '${changes.foreignKey.table}.${changes.foreignKey.column}'`
        )
        conflictingRows += fkViolationCount
      }
    }

    // Check for type conversion issues
    if (changes.type) {
      const currentColumn = await this.db
        .prepare(`PRAGMA table_info(${validateAndEscapeTableName(tableName)})`)
        .all()

      interface TableInfoColumn {
        name: string
        type: string
        [key: string]: unknown
      }
      const column = currentColumn.results.find((col) => {
        const columnInfo = col as TableInfoColumn
        return columnInfo.name === columnName
      })
      if (column && (column as TableInfoColumn).type !== changes.type) {
        // Check if data can be safely converted
        if (changes.type === 'INTEGER') {
          const invalidIntegerResult = await this.db
            .prepare(`
              SELECT COUNT(*) as count 
              FROM ${validateAndEscapeTableName(tableName)} 
              WHERE ${validateAndEscapeColumnName(columnName)} IS NOT NULL 
              AND CAST(${validateAndEscapeColumnName(columnName)} AS INTEGER) = 0 
              AND ${validateAndEscapeColumnName(columnName)} != '0' 
              AND ${validateAndEscapeColumnName(columnName)} != 0
            `)
            .first()

          const invalidCount = (invalidIntegerResult as CountResult)?.count || 0
          if (invalidCount > 0) {
            errors.push(
              `Cannot convert to INTEGER: ${invalidCount} rows contain non-numeric values in column '${columnName}'`
            )
            conflictingRows += invalidCount
          }
        } else if (changes.type === 'REAL') {
          const invalidRealResult = await this.db
            .prepare(`
              SELECT COUNT(*) as count 
              FROM ${validateAndEscapeTableName(tableName)} 
              WHERE ${validateAndEscapeColumnName(columnName)} IS NOT NULL 
              AND CAST(${validateAndEscapeColumnName(columnName)} AS REAL) = 0.0 
              AND ${validateAndEscapeColumnName(columnName)} != '0' 
              AND ${validateAndEscapeColumnName(columnName)} != '0.0' 
              AND ${validateAndEscapeColumnName(columnName)} != 0 
              AND ${validateAndEscapeColumnName(columnName)} != 0.0
            `)
            .first()

          const invalidCount = (invalidRealResult as CountResult)?.count || 0
          if (invalidCount > 0) {
            errors.push(
              `Cannot convert to REAL: ${invalidCount} rows contain non-numeric values in column '${columnName}'`
            )
            conflictingRows += invalidCount
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      conflictingRows,
    }
  }

  // Modify column constraints (requires table recreation for most changes)
  async modifyColumn(
    tableName: string,
    columnName: string,
    changes: {
      type?: string
      notNull?: boolean
      foreignKey?: { table: string; column: string } | null
    }
  ): Promise<void> {
    await this.enableForeignKeys()

    this.errorHandler.validateSystemTable(tableName)

    // Validate changes before proceeding
    const validation = await this.validateColumnChanges(tableName, columnName, changes)
    if (!validation.valid) {
      this.errorHandler.handleValidationErrors(validation.errors)
    }

    // Get current table schema
    const tableInfo = (await this.db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
      .bind(tableName)
      .first()) as TableInfo | null

    if (!tableInfo) {
      this.errorHandler.handleNotFound('Table', tableName)
      return
    }

    // Get current column info
    const columns = await this.getTableColumns(tableName)
    const currentColumn = columns.find((col) => col.name === columnName)

    if (!currentColumn) {
      this.errorHandler.handleNotFound('Column', `${columnName} in table ${tableName}`)
      return
    }

    // Create temp table with modifications
    const tempTableName = `${tableName}_temp_${Date.now()}`
    const modifiedSQL = this.modifyCreateStatementForColumn(
      tableInfo.sql,
      columnName,
      changes,
      tempTableName,
      columns
    )

    console.log('Original SQL:', tableInfo.sql)
    console.log('Modified SQL:', modifiedSQL)
    console.log('Temp table name:', tempTableName)

    // Create pre-change snapshot asynchronously
    this.createAsyncSnapshot({
      description: `Before modifying column ${columnName} in ${tableName}`,
      snapshotType: 'pre_change',
    })

    // Use batch operation for atomic transaction
    const statements = [
      this.db.prepare(modifiedSQL),
      this.db.prepare(
        `INSERT INTO ${validateAndEscapeTableName(tempTableName)} SELECT * FROM ${validateAndEscapeTableName(tableName)}`
      ),
      this.db.prepare(`DROP TABLE ${validateAndEscapeTableName(tableName)}`),
      this.db.prepare(
        `ALTER TABLE ${validateAndEscapeTableName(tempTableName)} RENAME TO ${validateAndEscapeTableName(tableName)}`
      ),
    ]

    await this.db.batch(statements)
  }

  // Helper to modify CREATE TABLE statement for column changes
  private modifyCreateStatementForColumn(
    sql: string,
    columnName: string,
    changes: {
      type?: string
      notNull?: boolean
      foreignKey?: { table: string; column: string } | null
    },
    newTableName: string,
    columns: ColumnInfo[]
  ): string {
    // Always rebuild the entire CREATE statement to avoid parsing issues
    const columnDefs = columns
      .map((col) => {
        if (col.name === columnName) {
          // Apply changes to this column
          let def = `${validateAndEscapeColumnName(col.name)} ${changes.type || col.type}`
          const shouldBeNotNull =
            changes.notNull !== undefined ? changes.notNull : col.notnull === 1
          if (col.pk) def += ' PRIMARY KEY'
          if (col.dflt_value !== null && col.dflt_value !== undefined) {
            // Handle different default value types
            if (typeof col.dflt_value === 'string') {
              if (col.dflt_value === 'CURRENT_TIMESTAMP' || col.dflt_value === 'NULL') {
                // Simple SQL keywords
                def += ` DEFAULT ${col.dflt_value}`
              } else if (col.dflt_value.includes('(')) {
                // Complex function call - wrap in parentheses for SQLite
                def += ` DEFAULT (${col.dflt_value})`
              } else {
                // String literal
                def += ` DEFAULT '${col.dflt_value}'`
              }
            } else {
              def += ` DEFAULT ${col.dflt_value}`
            }
          }
          if (shouldBeNotNull) def += ' NOT NULL'
          return def
        } else {
          // Keep existing column definition
          let def = `${validateAndEscapeColumnName(col.name)} ${col.type}`
          if (col.pk) def += ' PRIMARY KEY'
          if (col.dflt_value !== null && col.dflt_value !== undefined) {
            // Handle different default value types
            if (typeof col.dflt_value === 'string') {
              if (col.dflt_value === 'CURRENT_TIMESTAMP' || col.dflt_value === 'NULL') {
                // Simple SQL keywords
                def += ` DEFAULT ${col.dflt_value}`
              } else if (col.dflt_value.includes('(')) {
                // Complex function call - wrap in parentheses for SQLite
                def += ` DEFAULT (${col.dflt_value})`
              } else {
                // String literal
                def += ` DEFAULT '${col.dflt_value}'`
              }
            } else {
              def += ` DEFAULT ${col.dflt_value}`
            }
          }
          if (col.notnull) def += ' NOT NULL'
          return def
        }
      })
      .join(', ')

    // Build foreign key constraints array
    const foreignKeys: string[] = []

    // Add new foreign key if specified
    if (changes.foreignKey) {
      foreignKeys.push(
        `FOREIGN KEY (${validateAndEscapeColumnName(columnName)}) REFERENCES ${validateAndEscapeTableName(changes.foreignKey.table)}(${validateAndEscapeColumnName(changes.foreignKey.column)})`
      )
    }

    // Extract existing foreign keys from original SQL (simple approach)
    // Look for patterns like: FOREIGN KEY (column) REFERENCES table(column)
    const originalFkRegex =
      /FOREIGN KEY\s*\(\s*"?([^)"]+)"?\s*\)\s*REFERENCES\s+"?([^"(]+)"?\s*\(\s*"?([^)"]+)"?\s*\)/gi
    let match: RegExpExecArray | null
    match = originalFkRegex.exec(sql)
    while (match !== null) {
      const [_fullMatch, fkColumn, refTable, refColumn] = match
      // Only keep if it's not the column we're modifying
      if (fkColumn !== columnName) {
        foreignKeys.push(
          `FOREIGN KEY (${validateAndEscapeColumnName(fkColumn)}) REFERENCES ${validateAndEscapeTableName(refTable)}(${validateAndEscapeColumnName(refColumn)})`
        )
      }
      match = originalFkRegex.exec(sql)
    }

    // If removing foreign key constraint for this column, don't add it back
    if (changes.foreignKey === null) {
      // Already handled by not including it above
    }

    // Build final SQL
    const fkClause = foreignKeys.length > 0 ? `, ${foreignKeys.join(', ')}` : ''
    const modifiedSQL = `CREATE TABLE ${validateAndEscapeTableName(newTableName)} (${columnDefs}${fkClause})`

    return modifiedSQL
  }

  // Execute custom SQL (with safety checks)
  async executeSQL(
    sql: string,
    params: unknown[] = []
  ): Promise<{ results: Record<string, unknown>[] }> {
    // Basic SQL injection prevention
    const normalizedSQL = sql.trim().toUpperCase()

    // Only allow SELECT for now
    if (!normalizedSQL.startsWith('SELECT')) {
      this.errorHandler.handleUnsafeSQL(sql)
    }

    // Prevent modification of system tables
    for (const systemTable of SYSTEM_TABLES) {
      if (normalizedSQL.includes(systemTable.toUpperCase())) {
        this.errorHandler.throwError({
          code: 'SYSTEM_TABLE_QUERY' as never,
          message: `Cannot query system table: ${systemTable}`,
          userMessage: `Querying system table "${systemTable}" is not allowed for security reasons.`,
          context: { tableName: systemTable, operation: 'sql_query' },
          suggestions: [
            'Query only user-created tables',
            'Use the specific table operations instead',
          ],
        })
      }
    }

    const result = await this.db
      .prepare(sql)
      .bind(...(params as (string | number | boolean | null | undefined)[]))
      .all()

    return {
      results: result.results as Record<string, unknown>[],
    }
  }

  // Schema snapshot management
  async createSnapshot(
    options: {
      name?: string
      description?: string
      createdBy?: string
      snapshotType?: 'manual' | 'auto' | 'pre_change'
    } = {}
  ): Promise<string> {
    return this.snapshotManager.createSnapshot({
      snapshotType: 'manual',
      ...options,
    })
  }

  async getSnapshots(limit = 20, offset = 0): Promise<SnapshotListResult> {
    return this.snapshotManager.getSnapshots(limit, offset)
  }

  async getSnapshot(id: string): Promise<Record<string, unknown> | null> {
    const snapshot = await this.snapshotManager.getSnapshot(id)
    return snapshot as Record<string, unknown> | null
  }

  // Access policy management
  async getTableAccessPolicy(tableName: string): Promise<'public' | 'private'> {
    try {
      const result = await this.db
        .prepare(`SELECT access_policy FROM table_policies WHERE table_name = ?`)
        .bind(tableName)
        .first()
      interface AccessPolicyResult {
        access_policy: 'public' | 'private'
        [key: string]: unknown
      }
      return (result as AccessPolicyResult)?.access_policy || 'public'
    } catch (_e) {
      // If table doesn't exist in policies, default to public
      return 'public'
    }
  }

  async setTableAccessPolicy(tableName: string, policy: 'public' | 'private'): Promise<void> {
    // Ensure table_policies table exists
    await this.db
      .prepare(`
      CREATE TABLE IF NOT EXISTS table_policies (
        table_name TEXT PRIMARY KEY,
        access_policy TEXT NOT NULL DEFAULT 'public' CHECK (access_policy IN ('public', 'private')),
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
      )
    `)
      .run()

    // Insert or update policy
    await this.db
      .prepare(`
      INSERT INTO table_policies (table_name, access_policy, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(table_name) DO UPDATE SET
        access_policy = excluded.access_policy,
        updated_at = excluded.updated_at
    `)
      .bind(tableName, policy)
      .run()
  }

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

  async deleteSnapshot(id: string): Promise<OperationResult> {
    return await this.snapshotManager.deleteSnapshot(id)
  }

  // Index management methods
  async getTableIndexes(tableName: string): Promise<IndexInfo[]> {
    return this.indexManager.getTableIndexes(tableName)
  }

  async createIndex(
    indexName: string,
    tableName: string,
    columns: string[],
    options: { unique?: boolean } = {}
  ): Promise<void> {
    return this.indexManager.createIndex(indexName, tableName, columns, options)
  }

  async dropIndex(indexName: string): Promise<void> {
    return this.indexManager.dropIndex(indexName)
  }

  async getAllUserIndexes(): Promise<IndexInfo[]> {
    return this.indexManager.getAllUserIndexes()
  }

  // Search functionality
  async getSearchableColumns(tableName: string): Promise<Array<{ name: string; type: string }>> {
    return this.errorHandler.handleOperation(
      async () => {
        // Get all columns for the table
        const columnsResult = await this.db
          .prepare(`PRAGMA table_info(${validateAndEscapeTableName(tableName)})`)
          .all()

        const columns = columnsResult.results as Array<{
          name: string
          type: string
          notnull: number
          dflt_value: unknown
          pk: number
        }>

        // Get all indexes for the table
        const indexesResult = await this.db
          .prepare(`PRAGMA index_list(${validateAndEscapeTableName(tableName)})`)
          .all()

        const searchableColumns: Array<{ name: string; type: string }> = []

        // Check each index to find indexed columns
        for (const indexRow of indexesResult.results) {
          const index = indexRow as any as IndexInfo
          const indexName = index.name

          // Skip SQLite auto-created indexes for primary keys/unique constraints
          if (indexName.startsWith('sqlite_autoindex_')) continue

          // Get columns in this index
          const indexColumnsResult = await this.db
            .prepare(`PRAGMA index_info(${validateAndEscapeTableName(indexName)})`)
            .all()

          for (const indexColumnRow of indexColumnsResult.results) {
            const columnInfo = indexColumnRow as IndexColumnInfo
            const columnName = columnInfo.name
            const column = columns.find((col) => col.name === columnName)

            if (column && ['TEXT', 'INTEGER'].includes(column.type.toUpperCase())) {
              // Avoid duplicates
              if (!searchableColumns.find((sc) => sc.name === columnName)) {
                searchableColumns.push({
                  name: columnName,
                  type: column.type.toUpperCase(),
                })
              }
            }
          }
        }

        // Exclude PRIMARY KEY columns from search (they can be accessed directly via GET /{id})
        // PRIMARY KEYs don't need to be searchable since they have direct access endpoints

        return searchableColumns.sort((a, b) => a.name.localeCompare(b.name))
      },
      { operationName: 'getSearchableColumns', tableName }
    )
  }

  async searchRecords(
    tableName: string,
    options: {
      column: string
      operator: string
      value?: string
      limit?: number
      offset: number
    }
  ): Promise<{
    data: Record<string, unknown>[]
    total: number
    hasMore: boolean
  }> {
    return this.errorHandler.handleOperation(
      async () => {
        const { column, operator, value, limit, offset } = options

        // Build WHERE clause
        let whereClause = ''
        let params: unknown[] = []

        switch (operator) {
          case 'eq':
            whereClause = `${validateAndEscapeColumnName(column)} = ?`
            params = [value]
            break
          case 'lt':
            whereClause = `${validateAndEscapeColumnName(column)} < ?`
            params = [value]
            break
          case 'le':
            whereClause = `${validateAndEscapeColumnName(column)} <= ?`
            params = [value]
            break
          case 'gt':
            whereClause = `${validateAndEscapeColumnName(column)} > ?`
            params = [value]
            break
          case 'ge':
            whereClause = `${validateAndEscapeColumnName(column)} >= ?`
            params = [value]
            break
          case 'ne':
            whereClause = `${validateAndEscapeColumnName(column)} != ?`
            params = [value]
            break
          case 'is_null':
            whereClause = `${validateAndEscapeColumnName(column)} IS NULL`
            params = []
            break
          case 'is_not_null':
            whereClause = `${validateAndEscapeColumnName(column)} IS NOT NULL`
            params = []
            break
          default:
            throw new Error(`Unsupported operator: ${operator}`)
        }

        // Get total count
        const countResult = await this.db
          .prepare(
            `SELECT COUNT(*) as total FROM ${validateAndEscapeTableName(tableName)} WHERE ${whereClause}`
          )
          .bind(...(params as (string | number | boolean | null | undefined)[]))
          .first()

        const total = (countResult as CountResult)?.total || 0

        // Build data query
        let dataQuery = `SELECT * FROM ${validateAndEscapeTableName(tableName)} WHERE ${whereClause}`
        const dataParams = [...params]

        if (limit !== undefined) {
          dataQuery += ` LIMIT ? OFFSET ?`
          dataParams.push(limit, offset)
        } else if (offset > 0) {
          dataQuery += ` OFFSET ?`
          dataParams.push(offset)
        }

        // Get data
        const dataResult = await this.db
          .prepare(dataQuery)
          .bind(...(dataParams as (string | number | boolean | null | undefined)[]))
          .all()

        const data = dataResult.results || []
        const hasMore = limit !== undefined ? offset + data.length < total : false

        return {
          data: data as Record<string, unknown>[],
          total,
          hasMore,
        }
      },
      { operationName: 'searchRecords', tableName, columnName: options.column }
    )
  }
}
