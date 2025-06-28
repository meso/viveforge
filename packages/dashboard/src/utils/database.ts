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
 * Normalize datetime string to ISO 8601 format with UTC timezone
 * If timezone info is missing, assumes UTC and adds 'Z' suffix
 */
const normalizeDateTimeToISO = (dateString: string): string => {
  try {
    // If it's already a proper ISO string with timezone, return as-is
    if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
      const date = new Date(dateString)
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString()
      }
    }

    // Handle SQLite datetime format without timezone (assume UTC)
    // "2025-06-26 16:07:43" or "2025-06-26T16:07:43"
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}$/.test(dateString)) {
      // Replace space with T if needed and add Z suffix
      const normalizedString = `${dateString.replace(' ', 'T')}Z`
      const date = new Date(normalizedString)
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString()
      }
    }

    // If all else fails, try to parse as-is and convert to ISO
    const date = new Date(dateString)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }

    // Return original if unable to parse
    return dateString
  } catch {
    return dateString
  }
}

/**
 * Format datetime string for display in browser timezone with timezone abbreviation
 */
export const formatDateTime = (dateString: string): string => {
  try {
    // First normalize the datetime string to ensure proper timezone handling
    const normalizedDateString = normalizeDateTimeToISO(dateString)
    const date = new Date(normalizedDateString)

    if (Number.isNaN(date.getTime())) {
      return dateString // Return original if invalid date
    }

    // Format date with timezone abbreviation
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    })

    return formatter.format(date)
  } catch (_err) {
    return dateString // Return original if formatting fails
  }
}

/**
 * Check if a value appears to be an ID (for copy/jump functionality)
 * Matches nanoid format: 21 characters using A-Za-z0-9_-
 */
export const isIdValue = (value: unknown): boolean => {
  if (typeof value !== 'string') return false
  // Check if it matches nanoid format (21 chars by default with URL-safe chars)
  // Also accept 32-char format used for API keys
  return /^[A-Za-z0-9_-]{21}$/.test(value) || /^[A-Za-z0-9_-]{32}$/.test(value)
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
