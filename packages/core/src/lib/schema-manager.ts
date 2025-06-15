import { SYSTEM_TABLES } from './table-manager'
import type { SchemaSnapshotManager } from './schema-snapshot'
import type { D1Database } from '../types/cloudflare'

export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: any
  pk: number
}

export interface ColumnDefinition {
  name: string
  type: string
  constraints?: string
  foreignKey?: { table: string; column: string }
}

export class SchemaManager {
  constructor(
    private db: D1Database,
    private snapshotManager: SchemaSnapshotManager,
    private createAsyncSnapshot: (options: {
      name?: string
      description?: string
      createdBy?: string
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

  // Create a new user table
  async createTable(tableName: string, columns: ColumnDefinition[]): Promise<void> {
    await this.enableForeignKeys()
    
    // Create pre-change snapshot asynchronously
    this.createAsyncSnapshot({
      description: `Before creating table: ${tableName}`,
      snapshotType: 'pre_change'
    })

    // Validate table name
    if (SYSTEM_TABLES.includes(tableName as any)) {
      throw new Error(`Cannot create system table: ${tableName}`)
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error('Invalid table name. Use only letters, numbers, and underscores.')
    }

    // Build CREATE TABLE statement
    const columnDefs = columns.map(col => {
      let def = `${col.name} ${col.type}`
      if (col.constraints) def += ` ${col.constraints}`
      return def
    }).join(', ')

    // Build foreign key constraints
    const foreignKeys = columns
      .filter(col => col.foreignKey)
      .map(col => `FOREIGN KEY (${col.name}) REFERENCES ${col.foreignKey!.table}(${col.foreignKey!.column})`)
      .join(', ')

    const sql = `CREATE TABLE ${tableName} (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      ${columnDefs},
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP${foreignKeys ? `, ${foreignKeys}` : ''}
    )`

    console.log('Creating table with SQL:', sql)
    await this.db.prepare(sql).run()
  }

  // Drop a user table
  async dropTable(tableName: string): Promise<void> {
    // Prevent dropping system tables
    if (SYSTEM_TABLES.includes(tableName as any)) {
      throw new Error(`Cannot drop system table: ${tableName}`)
    }
    
    // Create pre-change snapshot asynchronously
    this.createAsyncSnapshot({
      description: `Before dropping table: ${tableName}`,
      snapshotType: 'pre_change'
    })

    await this.db.prepare(`DROP TABLE IF EXISTS ${tableName}`).run()
  }

  // Get columns for a specific table
  async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    const result = await this.db
      .prepare(`PRAGMA table_info("${tableName}")`)
      .all()

    return result.results as ColumnInfo[]
  }

  // Get foreign key constraints for a specific table
  async getForeignKeys(tableName: string): Promise<{ from: string; table: string; to: string }[]> {
    const result = await this.db
      .prepare(`PRAGMA foreign_key_list("${tableName}")`)
      .all()

    return result.results.map((fk: any) => ({
      from: fk.from,
      table: fk.table,
      to: fk.to
    }))
  }

  // Add column to existing table
  async addColumn(tableName: string, column: ColumnDefinition): Promise<void> {
    await this.enableForeignKeys()
    
    // Validate table name
    if (SYSTEM_TABLES.includes(tableName as any)) {
      throw new Error(`Cannot modify system table: ${tableName}`)
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column.name)) {
      throw new Error('Invalid column name. Use only letters, numbers, and underscores.')
    }

    // Build ALTER TABLE statement
    let alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type}`
    if (column.constraints) {
      alterSQL += ` ${column.constraints}`
    }

    // Create pre-change snapshot asynchronously
    this.createAsyncSnapshot({
      description: `Before adding column ${column.name} to ${tableName}`,
      snapshotType: 'pre_change'
    })
    
    console.log('Adding column with SQL:', alterSQL)
    await this.db.prepare(alterSQL).run()

    // If foreign key is specified, we need to recreate the table (SQLite limitation)
    if (column.foreignKey) {
      await this.addForeignKeyByRecreatingTable(tableName, column.name, column.foreignKey)
    }
  }

  // Rename column (requires table recreation in SQLite)
  async renameColumn(tableName: string, oldName: string, newName: string): Promise<void> {
    await this.enableForeignKeys()
    
    if (SYSTEM_TABLES.includes(tableName as any)) {
      throw new Error(`Cannot modify system table: ${tableName}`)
    }

    // Create pre-change snapshot asynchronously
    this.createAsyncSnapshot({
      description: `Before renaming column ${oldName} to ${newName} in ${tableName}`,
      snapshotType: 'pre_change'
    })
    
    // SQLite 3.25.0+ supports ALTER TABLE RENAME COLUMN
    const sql = `ALTER TABLE ${tableName} RENAME COLUMN ${oldName} TO ${newName}`
    console.log('Renaming column with SQL:', sql)
    await this.db.prepare(sql).run()
  }

  // Drop column (requires table recreation in SQLite)
  async dropColumn(tableName: string, columnName: string): Promise<void> {
    await this.enableForeignKeys()
    
    if (SYSTEM_TABLES.includes(tableName as any)) {
      throw new Error(`Cannot modify system table: ${tableName}`)
    }

    // Create pre-change snapshot asynchronously
    this.createAsyncSnapshot({
      description: `Before dropping column ${columnName} from ${tableName}`,
      snapshotType: 'pre_change'
    })
    
    // SQLite 3.35.0+ supports ALTER TABLE DROP COLUMN
    const sql = `ALTER TABLE ${tableName} DROP COLUMN ${columnName}`
    console.log('Dropping column with SQL:', sql)
    await this.db.prepare(sql).run()
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
  ): Promise<{ valid: boolean; errors: string[]; conflictingRows: number }> {
    const errors: string[] = []
    let conflictingRows = 0

    // Check for NOT NULL constraint violations
    if (changes.notNull === true) {
      const nullCheckResult = await this.db
        .prepare(`SELECT COUNT(*) as count FROM "${tableName}" WHERE "${columnName}" IS NULL`)
        .first()
      
      const nullCount = nullCheckResult?.count as number || 0
      if (nullCount > 0) {
        errors.push(`Cannot add NOT NULL constraint: ${nullCount} rows have NULL values in column '${columnName}'`)
        conflictingRows += nullCount
      }
    }

    // Check for foreign key constraint violations
    if (changes.foreignKey) {
      const fkCheckResult = await this.db
        .prepare(`
          SELECT COUNT(*) as count 
          FROM "${tableName}" t1 
          WHERE t1."${columnName}" IS NOT NULL 
          AND NOT EXISTS (
            SELECT 1 FROM "${changes.foreignKey.table}" t2 
            WHERE t2."${changes.foreignKey.column}" = t1."${columnName}"
          )
        `)
        .first()
      
      const fkViolationCount = fkCheckResult?.count as number || 0
      if (fkViolationCount > 0) {
        errors.push(`Cannot add foreign key constraint: ${fkViolationCount} rows reference non-existent values in '${changes.foreignKey.table}.${changes.foreignKey.column}'`)
        conflictingRows += fkViolationCount
      }
    }

    // Check for type conversion issues
    if (changes.type) {
      const currentColumn = await this.db
        .prepare(`PRAGMA table_info("${tableName}")`)
        .all()
      
      const column = currentColumn.results.find((col: any) => col.name === columnName)
      if (column && column.type !== changes.type) {
        // Check if data can be safely converted
        if (changes.type === 'INTEGER') {
          const invalidIntegerResult = await this.db
            .prepare(`
              SELECT COUNT(*) as count 
              FROM "${tableName}" 
              WHERE "${columnName}" IS NOT NULL 
              AND CAST("${columnName}" AS INTEGER) = 0 
              AND "${columnName}" != '0' 
              AND "${columnName}" != 0
            `)
            .first()
          
          const invalidCount = invalidIntegerResult?.count as number || 0
          if (invalidCount > 0) {
            errors.push(`Cannot convert to INTEGER: ${invalidCount} rows contain non-numeric values in column '${columnName}'`)
            conflictingRows += invalidCount
          }
        } else if (changes.type === 'REAL') {
          const invalidRealResult = await this.db
            .prepare(`
              SELECT COUNT(*) as count 
              FROM "${tableName}" 
              WHERE "${columnName}" IS NOT NULL 
              AND CAST("${columnName}" AS REAL) = 0.0 
              AND "${columnName}" != '0' 
              AND "${columnName}" != '0.0' 
              AND "${columnName}" != 0 
              AND "${columnName}" != 0.0
            `)
            .first()
          
          const invalidCount = invalidRealResult?.count as number || 0
          if (invalidCount > 0) {
            errors.push(`Cannot convert to REAL: ${invalidCount} rows contain non-numeric values in column '${columnName}'`)
            conflictingRows += invalidCount
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      conflictingRows
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
    
    if (SYSTEM_TABLES.includes(tableName as any)) {
      throw new Error(`Cannot modify system table: ${tableName}`)
    }

    // Validate changes before proceeding
    const validation = await this.validateColumnChanges(tableName, columnName, changes)
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`)
    }

    // Get current table schema
    const tableInfo = await this.db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
      .bind(tableName)
      .first()
    
    if (!tableInfo) {
      throw new Error(`Table ${tableName} not found`)
    }

    // Get current column info
    const columns = await this.getTableColumns(tableName)
    const currentColumn = columns.find(col => col.name === columnName)
    
    if (!currentColumn) {
      throw new Error(`Column ${columnName} not found in table ${tableName}`)
    }

    // Create temp table with modifications
    const tempTableName = `${tableName}_temp_${Date.now()}`
    const modifiedSQL = this.modifyCreateStatementForColumn(
      tableInfo.sql as string,
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
      snapshotType: 'pre_change'
    })
    
    // Use batch operation for atomic transaction
    const statements = [
      this.db.prepare(modifiedSQL),
      this.db.prepare(`INSERT INTO "${tempTableName}" SELECT * FROM "${tableName}"`),
      this.db.prepare(`DROP TABLE "${tableName}"`),
      this.db.prepare(`ALTER TABLE "${tempTableName}" RENAME TO "${tableName}"`)
    ]
    
    await this.db.batch(statements)
  }

  // Helper method to add foreign key by recreating table (SQLite limitation)
  private async addForeignKeyByRecreatingTable(
    tableName: string,
    columnName: string,
    foreignKey: { table: string; column: string }
  ): Promise<void> {
    // Get current table schema
    const tableInfo = await this.db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
      .bind(tableName)
      .first()
    
    if (!tableInfo) {
      throw new Error(`Table ${tableName} not found`)
    }

    // Create temp table with new foreign key
    const tempTableName = `${tableName}_temp_${Date.now()}`
    const originalSQL = tableInfo.sql as string
    
    // Parse and modify the CREATE TABLE statement to add foreign key
    const modifiedSQL = this.addForeignKeyToCreateStatement(originalSQL, columnName, foreignKey, tempTableName)
    
    // Use batch operation for atomic transaction
    const statements = [
      this.db.prepare(modifiedSQL),
      this.db.prepare(`INSERT INTO ${tempTableName} SELECT * FROM ${tableName}`),
      this.db.prepare(`DROP TABLE ${tableName}`),
      this.db.prepare(`ALTER TABLE ${tempTableName} RENAME TO ${tableName}`)
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
    let modifiedSQL = sql.replace(/CREATE TABLE\s+(\w+)/i, `CREATE TABLE ${newTableName}`)
    
    // Find the closing parenthesis and add foreign key before it
    const lastParen = modifiedSQL.lastIndexOf(')')
    const fkConstraint = `, FOREIGN KEY (${columnName}) REFERENCES ${foreignKey.table}(${foreignKey.column})`
    
    modifiedSQL = modifiedSQL.slice(0, lastParen) + fkConstraint + modifiedSQL.slice(lastParen)
    
    return modifiedSQL
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
    const columnDefs = columns.map(col => {
      if (col.name === columnName) {
        // Apply changes to this column
        let def = `"${col.name}" ${changes.type || col.type}`
        const shouldBeNotNull = changes.notNull !== undefined ? changes.notNull : (col.notnull === 1)
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
        let def = `"${col.name}" ${col.type}`
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
    }).join(', ')
    
    // Build foreign key constraints array
    const foreignKeys: string[] = []
    
    // Add new foreign key if specified
    if (changes.foreignKey) {
      foreignKeys.push(`FOREIGN KEY ("${columnName}") REFERENCES "${changes.foreignKey.table}"("${changes.foreignKey.column}")`)
    }
    
    // Extract existing foreign keys from original SQL (simple approach)
    // Look for patterns like: FOREIGN KEY (column) REFERENCES table(column)
    const originalFkRegex = /FOREIGN KEY\s*\(\s*"?([^)"]+)"?\s*\)\s*REFERENCES\s+"?([^"(]+)"?\s*\(\s*"?([^)"]+)"?\s*\)/gi
    let match
    while ((match = originalFkRegex.exec(sql)) !== null) {
      const [fullMatch, fkColumn, refTable, refColumn] = match
      // Only keep if it's not the column we're modifying
      if (fkColumn !== columnName) {
        foreignKeys.push(`FOREIGN KEY ("${fkColumn}") REFERENCES "${refTable}"("${refColumn}")`)
      }
    }
    
    // If removing foreign key constraint for this column, don't add it back
    if (changes.foreignKey === null) {
      // Already handled by not including it above
    }
    
    // Build final SQL
    const fkClause = foreignKeys.length > 0 ? `, ${foreignKeys.join(', ')}` : ''
    const modifiedSQL = `CREATE TABLE "${newTableName}" (${columnDefs}${fkClause})`
    
    return modifiedSQL
  }
}