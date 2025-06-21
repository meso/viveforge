/**
 * Unified error handling types for Vibebase
 */

export enum ErrorCode {
  // Database errors
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_OPERATION_FAILED = 'DATABASE_OPERATION_FAILED',

  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',

  // Permission errors
  SYSTEM_TABLE_MODIFICATION = 'SYSTEM_TABLE_MODIFICATION',
  UNAUTHORIZED_OPERATION = 'UNAUTHORIZED_OPERATION',

  // Not found errors
  TABLE_NOT_FOUND = 'TABLE_NOT_FOUND',
  COLUMN_NOT_FOUND = 'COLUMN_NOT_FOUND',
  INDEX_NOT_FOUND = 'INDEX_NOT_FOUND',
  SNAPSHOT_NOT_FOUND = 'SNAPSHOT_NOT_FOUND',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',

  // Format errors
  INVALID_NAME_FORMAT = 'INVALID_NAME_FORMAT',
  INVALID_SQL_QUERY = 'INVALID_SQL_QUERY',

  // Operation errors
  DUPLICATE_ENTITY = 'DUPLICATE_ENTITY',
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION',

  // External service errors
  STORAGE_OPERATION_FAILED = 'STORAGE_OPERATION_FAILED',
  SNAPSHOT_CREATION_FAILED = 'SNAPSHOT_CREATION_FAILED',

  // Unknown errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ErrorDetails {
  code: ErrorCode
  message: string
  context?: {
    tableName?: string
    columnName?: string
    indexName?: string
    snapshotId?: string
    operation?: string
    originalError?: Error | unknown
  }
  userMessage?: string // User-friendly message
  suggestions?: string[] // Suggested solutions
}

export class VibebaseError extends Error {
  public readonly code: ErrorCode
  public readonly context?: ErrorDetails['context']
  public readonly userMessage?: string
  public readonly suggestions?: string[]

  constructor(details: ErrorDetails) {
    super(details.message)
    this.name = 'VibebaseError'
    this.code = details.code
    this.context = details.context
    this.userMessage = details.userMessage
    this.suggestions = details.suggestions
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      context: this.context,
      suggestions: this.suggestions,
      stack: this.stack,
    }
  }

  public static fromError(
    error: unknown,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR
  ): VibebaseError {
    if (error instanceof VibebaseError) {
      return error
    }

    if (error instanceof Error) {
      return new VibebaseError({
        code,
        message: error.message,
        context: { originalError: error },
      })
    }

    return new VibebaseError({
      code,
      message: String(error),
      context: { originalError: error },
    })
  }
}

export interface ErrorResult {
  success: false
  error: VibebaseError
}

export interface SuccessResult<T = unknown> {
  success: true
  data: T
}

export type Result<T = unknown> = SuccessResult<T> | ErrorResult

// Error factory functions for common error types
export const createSystemTableError = (tableName: string): VibebaseError =>
  new VibebaseError({
    code: ErrorCode.SYSTEM_TABLE_MODIFICATION,
    message: `Cannot modify system table: ${tableName}`,
    userMessage: `System table "${tableName}" cannot be modified for security reasons.`,
    context: { tableName, operation: 'modification' },
    suggestions: ['Use a different table name', 'Only modify user-created tables'],
  })

export const createInvalidNameError = (
  name: string,
  type: 'table' | 'column' | 'index'
): VibebaseError =>
  new VibebaseError({
    code: ErrorCode.INVALID_NAME_FORMAT,
    message: `Invalid ${type} name format: ${name}`,
    userMessage: `The ${type} name "${name}" contains invalid characters.`,
    context: { operation: `${type}_creation` },
    suggestions: [
      'Use only letters, numbers, and underscores',
      'Start with a letter or underscore',
      'Avoid spaces and special characters',
    ],
  })

export const createNotFoundError = (entityType: string, identifier: string): VibebaseError =>
  new VibebaseError({
    code: ErrorCode.TABLE_NOT_FOUND, // Will be refined based on entity type
    message: `${entityType} not found: ${identifier}`,
    userMessage: `The ${entityType.toLowerCase()} "${identifier}" does not exist.`,
    context: { operation: 'lookup' },
    suggestions: ['Check the spelling', 'Verify the entity exists'],
  })

export const createDuplicateError = (entityType: string, name: string): VibebaseError =>
  new VibebaseError({
    code: ErrorCode.DUPLICATE_ENTITY,
    message: `${entityType} "${name}" already exists`,
    userMessage: `A ${entityType.toLowerCase()} with the name "${name}" already exists.`,
    context: { operation: 'creation' },
    suggestions: ['Use a different name', 'Delete the existing entity first'],
  })

export const createValidationError = (errors: string[]): VibebaseError =>
  new VibebaseError({
    code: ErrorCode.VALIDATION_FAILED,
    message: `Validation failed: ${errors.join('; ')}`,
    userMessage: 'The operation cannot be completed due to validation errors.',
    context: { operation: 'validation' },
    suggestions: ['Fix the validation errors and try again'],
  })
