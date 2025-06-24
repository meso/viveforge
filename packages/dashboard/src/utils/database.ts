import type { TableInfo } from '../lib/api'

// System tables that should not be available for FK references
// NOTE: Keep this in sync with SYSTEM_TABLES in packages/core/src/lib/table-manager.ts
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
] as const

/**
 * Utility function to truncate IDs for display
 */
export const truncateId = (id: string | null): string => {
  if (!id) return '-'
  return id.length > 8 ? `${id.substring(0, 4)}...` : id
}

/**
 * Filter out system tables for FK references
 */
export const getUserTables = (tables: TableInfo[]): TableInfo[] => {
  return tables.filter(
    (table) => !SYSTEM_TABLES.includes(table.name as (typeof SYSTEM_TABLES)[number])
  )
}

/**
 * Generate default index name
 */
export const generateIndexName = (tableName: string, columns: string[]): string => {
  const columnPart = columns.filter((col) => col.trim() !== '').join('_')
  return `idx_${tableName}_${columnPart}`.toLowerCase()
}

/**
 * Copy text to clipboard with fallback for older browsers
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (_err) {
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const result = document.execCommand('copy')
      document.body.removeChild(textArea)
      return result
    } catch (fallbackErr) {
      console.error('Failed to copy to clipboard:', fallbackErr)
      return false
    }
  }
}

/**
 * Format datetime string for display
 */
export const formatDateTime = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) {
      return dateString // Return original if invalid date
    }

    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (_err) {
    return dateString // Return original if formatting fails
  }
}

/**
 * Check if a value appears to be an ID (for copy/jump functionality)
 */
export const isIdValue = (value: unknown): boolean => {
  if (typeof value !== 'string') return false
  // Check if it's a UUID-like format or other ID patterns
  return (
    /^[a-f0-9]{8}[a-f0-9]{4}[a-f0-9]{4}[a-f0-9]{4}[a-f0-9]{12}$/i.test(value) ||
    /^[a-f0-9]{8,}$/i.test(value) ||
    (value.length >= 6 && /^[a-zA-Z0-9_-]+$/.test(value))
  )
}

/**
 * Validate table name format
 */
export const isValidTableName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false
  if (name.length > 63) return false
  if (SYSTEM_TABLES.includes(name as (typeof SYSTEM_TABLES)[number])) return false

  // Check for valid identifier format
  const validNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  return validNameRegex.test(name)
}

/**
 * Validate column name format
 */
export const isValidColumnName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false
  if (name.length > 63) return false

  // Check for valid identifier format
  const validNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  return validNameRegex.test(name)
}

/**
 * Get SQL type options for column creation
 */
export const getSQLTypes = () =>
  [
    'TEXT',
    'INTEGER',
    'REAL',
    'BLOB',
    'NUMERIC',
    'DATE',
    'DATETIME',
    'TIMESTAMP',
    'BOOLEAN',
    'VARCHAR(255)',
    'CHAR(50)',
  ] as const

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'

  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))

  return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`
}

/**
 * Debounce function for search inputs
 */
export const debounce = <T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>

  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
