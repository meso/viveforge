/**
 * SQL utility functions for secure identifier handling
 * Prevents SQL injection by validating and escaping SQL identifiers
 */

// Valid SQL identifier pattern (letters, numbers, underscores, starting with letter/underscore)
const VALID_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/

// SQL reserved words that should not be used as identifiers
const SQL_RESERVED_WORDS = new Set([
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
  'TRIGGER',
  'PROCEDURE',
  'FUNCTION',
  'DATABASE',
  'SCHEMA',
  'FROM',
  'WHERE',
  'JOIN',
  'INNER',
  'LEFT',
  'RIGHT',
  'OUTER',
  'ON',
  'UNION',
  'GROUP',
  'ORDER',
  'BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'INTO',
  'VALUES',
  'SET',
  'AND',
  'OR',
  'NOT',
  'NULL',
  'TRUE',
  'FALSE',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'IF',
  'EXISTS',
  'DISTINCT',
  'AS',
  'IS',
  'IN',
  'BETWEEN',
  'LIKE',
  'GLOB',
  'REGEXP',
  'MATCH',
  'ESCAPE',
  'ISNULL',
  'NOTNULL',
  'COLLATE',
  'ASC',
  'DESC',
  'PRIMARY',
  'FOREIGN',
  'KEY',
  'REFERENCES',
  'CONSTRAINT',
  'UNIQUE',
  'CHECK',
  'DEFAULT',
  'AUTOINCREMENT',
  'ROWID',
  'OID',
  '_ROWID_',
])

/**
 * Validates if a string is a valid SQL identifier
 */
export function isValidSQLIdentifier(identifier: string): boolean {
  if (!identifier || typeof identifier !== 'string') {
    return false
  }

  // Check length (SQLite limit is 1000 characters, but we use a more reasonable limit)
  if (identifier.length > 64) {
    return false
  }

  // Check pattern
  if (!VALID_IDENTIFIER_PATTERN.test(identifier)) {
    return false
  }

  // Check reserved words
  if (SQL_RESERVED_WORDS.has(identifier.toUpperCase())) {
    return false
  }

  return true
}

/**
 * Escapes a SQL identifier by wrapping it in double quotes
 * Only use this for identifiers that have already been validated
 */
export function escapeSQLIdentifier(identifier: string): string {
  if (!isValidSQLIdentifier(identifier)) {
    throw new Error(`Invalid SQL identifier: "${identifier}"`)
  }

  // SQLite uses double quotes for identifiers
  // Escape any existing double quotes by doubling them
  return `"${identifier.replace(/"/g, '""')}"`
}

/**
 * Validates and escapes a table name
 */
export function validateAndEscapeTableName(tableName: string): string {
  if (!isValidSQLIdentifier(tableName)) {
    throw new Error(
      `Invalid table name: "${tableName}". Table names must start with a letter or underscore, contain only letters, numbers, and underscores, and not be SQL reserved words.`
    )
  }
  return escapeSQLIdentifier(tableName)
}

/**
 * Validates and escapes a column name
 */
export function validateAndEscapeColumnName(columnName: string): string {
  if (!isValidSQLIdentifier(columnName)) {
    throw new Error(
      `Invalid column name: "${columnName}". Column names must start with a letter or underscore, contain only letters, numbers, and underscores, and not be SQL reserved words.`
    )
  }
  return escapeSQLIdentifier(columnName)
}

/**
 * Validates and escapes an index name
 */
export function validateAndEscapeIndexName(indexName: string): string {
  if (!isValidSQLIdentifier(indexName)) {
    throw new Error(
      `Invalid index name: "${indexName}". Index names must start with a letter or underscore, contain only letters, numbers, and underscores, and not be SQL reserved words.`
    )
  }
  return escapeSQLIdentifier(indexName)
}

/**
 * Validates and escapes multiple column names
 */
export function validateAndEscapeColumnNames(columnNames: string[]): string[] {
  return columnNames.map(validateAndEscapeColumnName)
}

/**
 * Creates a comma-separated list of escaped column names
 */
export function createColumnList(columnNames: string[]): string {
  return validateAndEscapeColumnNames(columnNames).join(', ')
}

/**
 * Validates that a table name is not a system table
 */
export function validateNotSystemTable(tableName: string, systemTables: readonly string[]): void {
  if (systemTables.includes(tableName)) {
    throw new Error(`Cannot modify system table: ${tableName}`)
  }
}

/**
 * Validates SQL data type
 */
export function validateSQLDataType(dataType: string): boolean {
  const validTypes = [
    'TEXT',
    'INTEGER',
    'REAL',
    'BLOB',
    'NUMERIC',
    'VARCHAR',
    'CHAR',
    'BOOLEAN',
    'DATE',
    'DATETIME',
    'TIMESTAMP',
    'DECIMAL',
    'FLOAT',
    'DOUBLE',
  ]

  // Handle types with parameters like VARCHAR(255)
  const baseType = dataType.split('(')[0].toUpperCase()
  return validTypes.includes(baseType)
}

/**
 * Validates and normalizes SQL data type
 */
export function validateAndNormalizeSQLDataType(dataType: string): string {
  if (!validateSQLDataType(dataType)) {
    throw new Error(`Invalid SQL data type: "${dataType}"`)
  }
  return dataType.toUpperCase()
}
