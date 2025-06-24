import type { D1Database } from '../types/cloudflare'
import { ErrorHandler } from './error-handler'
import type { ColumnDefinition } from './schema-manager'
import { validateAndEscapeColumnName, validateAndEscapeTableName } from './sql-utils'

// System tables that cannot be modified by users
const SYSTEM_TABLES = [
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

/**
 * Handles validation for table operations, data integrity, and constraints
 */
export class TableValidator {
  private errorHandler: ErrorHandler

  constructor(private db: D1Database) {
    this.errorHandler = ErrorHandler.getInstance()
  }

  /**
   * Validate if a table name is a system table
   */
  isSystemTable(tableName: string): boolean {
    return SYSTEM_TABLES.includes(tableName as SystemTable)
  }

  /**
   * Validate table name and check if it's a system table
   */
  validateTableName(tableName: string): void {
    // Basic format validation
    this.validateNameFormat(tableName, 'table')

    // Escape validation
    validateAndEscapeTableName(tableName)

    // System table check
    if (this.isSystemTable(tableName)) {
      throw new Error('Cannot modify system table')
    }
  }

  /**
   * Validate column definitions for table creation
   */
  validateColumnDefinitions(columns: ColumnDefinition[]): void {
    if (!columns || columns.length === 0) {
      throw new Error('At least one column is required')
    }

    // Track column names to check for duplicates
    const columnNames = new Set<string>()
    let hasPrimaryKey = false

    for (const column of columns) {
      // Validate column name format
      this.validateNameFormat(column.name, 'column')
      validateAndEscapeColumnName(column.name)

      // Check for duplicate column names
      if (columnNames.has(column.name.toLowerCase())) {
        throw new Error(`Duplicate column name: ${column.name}`)
      }
      columnNames.add(column.name.toLowerCase())

      // Validate column type
      this.validateColumnType(column.type)

      // Check for primary key constraints
      if (column.constraints?.toUpperCase().includes('PRIMARY KEY')) {
        if (hasPrimaryKey) {
          throw new Error('Multiple primary keys are not allowed')
        }
        hasPrimaryKey = true
      }

      // Validate foreign key if specified
      if (column.foreignKey) {
        this.validateForeignKeyDefinition(column.foreignKey)
      }
    }

    // Ensure there's an id column if no primary key is specified
    if (!hasPrimaryKey) {
      const hasIdColumn = columns.some((col) => col.name.toLowerCase() === 'id')
      if (!hasIdColumn) {
        throw new Error('Table must have either a primary key or an id column')
      }
    }
  }

  /**
   * Validate data for insert/update operations
   */
  validateInsertData(
    _tableName: string,
    data: Record<string, unknown>,
    columns: Array<{ name: string; type: string; notnull: number }>
  ): void {
    // Check required fields
    for (const column of columns) {
      const value = data[column.name]

      // Check NOT NULL constraints
      if (column.notnull === 1 && (value === null || value === undefined)) {
        // Skip auto-generated columns
        if (column.name === 'id' || column.name === 'created_at' || column.name === 'updated_at') {
          continue
        }
        throw new Error(`Column ${column.name} cannot be null`)
      }

      // Validate data types if value is provided
      if (value !== null && value !== undefined) {
        this.validateColumnValue(column.name, column.type, value)
      }
    }

    // Check for invalid column names
    for (const key of Object.keys(data)) {
      if (!columns.some((col) => col.name === key)) {
        throw new Error(`Unknown column: ${key}`)
      }
    }
  }

  /**
   * Validate data for update operations
   */
  validateUpdateData(
    _tableName: string,
    data: Record<string, unknown>,
    columns: Array<{ name: string; type: string; notnull: number }>
  ): void {
    if (!data || Object.keys(data).length === 0) {
      throw new Error('Update data cannot be empty')
    }

    // Don't allow updating system columns
    const systemColumns = ['id', 'created_at']
    for (const systemCol of systemColumns) {
      if (Object.hasOwn(data, systemCol)) {
        throw new Error(`Cannot update system column: ${systemCol}`)
      }
    }

    // Validate each provided column
    for (const [key, value] of Object.entries(data)) {
      const column = columns.find((col) => col.name === key)
      if (!column) {
        throw new Error(`Unknown column: ${key}`)
      }

      // Validate data type if value is provided
      if (value !== null && value !== undefined) {
        this.validateColumnValue(key, column.type, value)
      }

      // Check NOT NULL constraints for non-null values
      if (column.notnull === 1 && value === null) {
        throw new Error(`Column ${key} cannot be null`)
      }
    }
  }

  /**
   * Validate foreign key definition
   */
  validateForeignKeyDefinition(foreignKey: { table: string; column: string }): void {
    this.validateNameFormat(foreignKey.table, 'table')
    this.validateNameFormat(foreignKey.column, 'column')

    if (this.isSystemTable(foreignKey.table)) {
      throw new Error(`Cannot reference system table: ${foreignKey.table}`)
    }
  }

  /**
   * Validate column type
   */
  private validateColumnType(type: string): void {
    const validTypes = [
      'TEXT',
      'INTEGER',
      'REAL',
      'BLOB',
      'NUMERIC',
      'VARCHAR',
      'CHAR',
      'DECIMAL',
      'FLOAT',
      'DOUBLE',
      'BOOLEAN',
      'DATE',
      'DATETIME',
      'TIMESTAMP',
    ]

    const normalizedType = type.toUpperCase().split('(')[0] // Remove size specifications
    if (!validTypes.includes(normalizedType)) {
      throw new Error(`Invalid column type: ${type}`)
    }
  }

  /**
   * Validate column value against its type
   */
  private validateColumnValue(columnName: string, columnType: string, value: unknown): void {
    const type = columnType.toUpperCase().split('(')[0]

    switch (type) {
      case 'INTEGER':
        if (typeof value !== 'number' && typeof value !== 'string') {
          throw new Error(`Column ${columnName} must be a number`)
        }
        if (typeof value === 'string' && Number.isNaN(Number(value))) {
          throw new Error(`Column ${columnName} must be a valid number`)
        }
        break

      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
      case 'NUMERIC':
      case 'DECIMAL':
        if (typeof value !== 'number' && typeof value !== 'string') {
          throw new Error(`Column ${columnName} must be a number`)
        }
        if (typeof value === 'string' && Number.isNaN(Number(value))) {
          throw new Error(`Column ${columnName} must be a valid number`)
        }
        break

      case 'TEXT':
      case 'VARCHAR':
      case 'CHAR':
        if (typeof value !== 'string') {
          throw new Error(`Column ${columnName} must be a string`)
        }
        break

      case 'BOOLEAN':
        if (
          typeof value !== 'boolean' &&
          value !== 0 &&
          value !== 1 &&
          value !== '0' &&
          value !== '1' &&
          value !== 'true' &&
          value !== 'false'
        ) {
          throw new Error(`Column ${columnName} must be a boolean value`)
        }
        break

      case 'DATE':
      case 'DATETIME':
      case 'TIMESTAMP':
        if (typeof value !== 'string' && !(value instanceof Date)) {
          throw new Error(`Column ${columnName} must be a date string or Date object`)
        }
        if (typeof value === 'string' && Number.isNaN(Date.parse(value))) {
          throw new Error(`Column ${columnName} must be a valid date`)
        }
        break

      case 'BLOB':
        // BLOB can accept various types, minimal validation
        break

      default:
        // For unknown types, accept any value
        break
    }
  }

  /**
   * Validate name format (table names, column names, etc.)
   */
  validateNameFormat(name: string, type: 'table' | 'column' | 'index'): void {
    if (!name || typeof name !== 'string') {
      throw new Error(`${type} name is required`)
    }

    if (name.length > 63) {
      throw new Error(`${type} name is too long (maximum 63 characters)`)
    }

    // Check for valid identifier format
    const validNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    if (!validNameRegex.test(name)) {
      throw new Error(
        `${type} name must start with a letter or underscore and contain only letters, numbers, and underscores`
      )
    }

    // Check for SQL reserved words
    const reservedWords = [
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'CREATE',
      'DROP',
      'ALTER',
      'TABLE',
      'INDEX',
      'VIEW',
      'FROM',
      'WHERE',
      'JOIN',
      'INNER',
      'LEFT',
      'RIGHT',
      'OUTER',
      'ON',
      'AND',
      'OR',
      'NOT',
      'NULL',
      'PRIMARY',
      'KEY',
      'FOREIGN',
      'REFERENCES',
      'UNIQUE',
      'CHECK',
      'DEFAULT',
      'AUTO_INCREMENT',
      'INTEGER',
      'TEXT',
      'REAL',
      'BLOB',
      'NUMERIC',
    ]

    if (reservedWords.includes(name.toUpperCase())) {
      throw new Error(`${type} name cannot be a SQL reserved word: ${name}`)
    }
  }

  /**
   * Check if table exists
   */
  async validateTableExists(tableName: string): Promise<void> {
    const exists = await this.errorHandler.handleOperation(
      async () => {
        const result = await this.db
          .prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=? AND name NOT LIKE 'sqlite_%'`
          )
          .bind(tableName)
          .first()
        return !!result
      },
      { operationName: 'validateTableExists', tableName }
    )

    if (!exists) {
      throw new Error(`Table does not exist: ${tableName}`)
    }
  }

  /**
   * Check if column exists in table
   */
  async validateColumnExists(tableName: string, columnName: string): Promise<void> {
    const exists = await this.errorHandler.handleOperation(
      async () => {
        const result = await this.db
          .prepare(`PRAGMA table_info("${validateAndEscapeTableName(tableName)}")`)
          .all()

        const columns = result.results as Array<{ name: string }>
        return columns.some((col) => col.name === columnName)
      },
      { operationName: 'validateColumnExists', tableName }
    )

    if (!exists) {
      throw new Error(`Column does not exist: ${columnName} in table ${tableName}`)
    }
  }
}
