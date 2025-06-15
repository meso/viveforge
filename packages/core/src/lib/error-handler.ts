import { ViveforgeError, ErrorCode, ErrorDetails, createSystemTableError, createInvalidNameError, createNotFoundError, createDuplicateError, createValidationError } from '../types/errors'

/**
 * Centralized error handling manager for Viveforge
 * Provides consistent error handling and logging across all managers
 */
export class ErrorHandler {
  private static instance: ErrorHandler
  private errorLogger?: (error: ViveforgeError) => void

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  public setErrorLogger(logger: (error: ViveforgeError) => void): void {
    this.errorLogger = logger
  }

  /**
   * Handle and throw a ViveforgeError with proper logging
   */
  public throwError(details: ErrorDetails): never {
    const error = new ViveforgeError(details)
    this.logError(error)
    throw error
  }

  /**
   * Wrap an operation with error handling
   */
  public async handleOperation<T>(
    operation: () => Promise<T>,
    context: {
      operationName: string
      tableName?: string
      columnName?: string
      indexName?: string
    }
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof ViveforgeError) {
        this.logError(error)
        throw error
      }

      const viveforgeError = ViveforgeError.fromError(error, ErrorCode.DATABASE_OPERATION_FAILED)
      viveforgeError.context = {
        ...viveforgeError.context,
        ...context
      }
      
      this.logError(viveforgeError)
      throw viveforgeError
    }
  }

  /**
   * Validate system table operations
   */
  public validateSystemTable(tableName: string): void {
    const SYSTEM_TABLES = ['admins', 'sessions', 'schema_snapshots', 'schema_snapshot_counter', 'd1_migrations']
    if (SYSTEM_TABLES.includes(tableName)) {
      this.throwError({
        code: ErrorCode.SYSTEM_TABLE_MODIFICATION,
        message: `Cannot modify system table: ${tableName}`,
        userMessage: `System table "${tableName}" cannot be modified for security reasons.`,
        context: { tableName, operation: 'modification' },
        suggestions: ['Use a different table name', 'Only modify user-created tables']
      })
    }
  }

  /**
   * Validate name format (tables, columns, indexes)
   */
  public validateNameFormat(name: string, type: 'table' | 'column' | 'index'): void {
    if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      this.throwError({
        code: ErrorCode.INVALID_NAME_FORMAT,
        message: `Invalid ${type} name format: ${name}`,
        userMessage: `The ${type} name "${name}" contains invalid characters.`,
        context: { operation: `${type}_creation` },
        suggestions: [
          'Use only letters, numbers, and underscores',
          'Start with a letter or underscore',
          'Avoid spaces and special characters'
        ]
      })
    }
  }

  /**
   * Handle not found entities
   */
  public handleNotFound(entityType: string, identifier: string): void {
    const errorCodeMap: Record<string, ErrorCode> = {
      'Table': ErrorCode.TABLE_NOT_FOUND,
      'Column': ErrorCode.COLUMN_NOT_FOUND,
      'Index': ErrorCode.INDEX_NOT_FOUND,
      'Snapshot': ErrorCode.SNAPSHOT_NOT_FOUND,
      'Record': ErrorCode.RECORD_NOT_FOUND
    }

    this.throwError({
      code: errorCodeMap[entityType] || ErrorCode.UNKNOWN_ERROR,
      message: `${entityType} not found: ${identifier}`,
      userMessage: `The ${entityType.toLowerCase()} "${identifier}" does not exist.`,
      context: { operation: 'lookup' },
      suggestions: ['Check the spelling', 'Verify the entity exists']
    })
  }

  /**
   * Handle duplicate entity creation
   */
  public handleDuplicate(entityType: string, name: string): void {
    this.throwError({
      code: ErrorCode.DUPLICATE_ENTITY,
      message: `${entityType} "${name}" already exists`,
      userMessage: `A ${entityType.toLowerCase()} with the name "${name}" already exists.`,
      context: { operation: 'creation' },
      suggestions: ['Use a different name', 'Delete the existing entity first']
    })
  }

  /**
   * Handle validation failures
   */
  public handleValidationErrors(errors: string[]): void {
    this.throwError({
      code: ErrorCode.VALIDATION_FAILED,
      message: `Validation failed: ${errors.join('; ')}`,
      userMessage: 'The operation cannot be completed due to validation errors.',
      context: { operation: 'validation' },
      suggestions: ['Fix the validation errors and try again']
    })
  }

  /**
   * Handle SQL safety violations
   */
  public handleUnsafeSQL(sql: string): void {
    this.throwError({
      code: ErrorCode.INVALID_SQL_QUERY,
      message: 'Only SELECT queries are allowed in the SQL editor',
      userMessage: 'This SQL operation is not permitted for security reasons.',
      context: { operation: 'sql_execution' },
      suggestions: ['Use only SELECT statements', 'Use the specific table operations for modifications']
    })
  }

  /**
   * Handle storage operation failures with graceful degradation
   */
  public handleStorageWarning(operation: string, error: unknown): void {
    const warning = ViveforgeError.fromError(error, ErrorCode.STORAGE_OPERATION_FAILED)
    warning.context = { operation, originalError: error }
    
    // Log warning but don't throw - allow graceful degradation
    this.logWarning(warning)
  }

  /**
   * Log error with proper formatting
   */
  private logError(error: ViveforgeError): void {
    if (this.errorLogger) {
      this.errorLogger(error)
    } else {
      console.error('[Viveforge Error]', {
        code: error.code,
        message: error.message,
        context: error.context,
        userMessage: error.userMessage,
        suggestions: error.suggestions
      })
    }
  }

  /**
   * Log warning with proper formatting
   */
  private logWarning(error: ViveforgeError): void {
    console.warn('[Viveforge Warning]', {
      code: error.code,
      message: error.message,
      context: error.context
    })
  }

  /**
   * Create standardized error responses for API endpoints
   */
  public createErrorResponse(error: unknown): {
    success: false
    error: {
      code: string
      message: string
      userMessage?: string
      suggestions?: string[]
    }
  } {
    if (error instanceof ViveforgeError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          userMessage: error.userMessage,
          suggestions: error.suggestions
        }
      }
    }

    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }
}