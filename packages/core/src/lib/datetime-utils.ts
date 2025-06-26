/**
 * Centralized datetime utilities for consistent ISO 8601 format handling
 * Ensures all datetime values are stored in UTC format: YYYY-MM-DDTHH:mm:ss.sssZ
 */

/**
 * Get current datetime in ISO 8601 UTC format
 * Returns format: YYYY-MM-DDTHH:mm:ss.sssZ
 */
export function getCurrentDateTimeISO(): string {
  return new Date().toISOString()
}

/**
 * Convert a date to ISO 8601 UTC format
 * Returns format: YYYY-MM-DDTHH:mm:ss.sssZ
 */
export function toDateTimeISO(date: Date): string {
  return date.toISOString()
}

/**
 * Parse ISO 8601 string to Date object
 */
export function fromDateTimeISO(isoString: string): Date {
  return new Date(isoString)
}

/**
 * Format datetime for display in browser timezone with timezone abbreviation
 * Automatically normalizes datetime strings without timezone info
 * Returns localized datetime string with timezone info (e.g., JST, PST, etc.)
 */
export function formatDateTimeForDisplay(dateString: string, locale = 'ja-JP'): string {
  try {
    // First normalize the datetime string to ensure proper timezone handling
    const normalizedDateString = normalizeDateTimeToISO(dateString)
    const date = new Date(normalizedDateString)

    if (Number.isNaN(date.getTime())) {
      return dateString // Return original if invalid date
    }

    // Format date with timezone abbreviation
    const formatter = new Intl.DateTimeFormat(locale, {
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
 * Create timestamp data for database inserts
 */
export function createTimestamps(): { created_at: string; updated_at: string } {
  const now = getCurrentDateTimeISO()
  return {
    created_at: now,
    updated_at: now,
  }
}

/**
 * Create update timestamp for database updates
 */
export function createUpdateTimestamp(): { updated_at: string } {
  return {
    updated_at: getCurrentDateTimeISO(),
  }
}

/**
 * Validate that a string is a valid ISO 8601 datetime
 */
export function isValidDateTimeISO(dateString: string): boolean {
  try {
    const date = new Date(dateString)
    return !Number.isNaN(date.getTime()) && date.toISOString() === dateString
  } catch {
    return false
  }
}

/**
 * Normalize datetime string to ISO 8601 format with UTC timezone
 * If timezone info is missing, assumes UTC and adds 'Z' suffix
 * Supports various input formats:
 * - "2025-06-26 16:07:43" -> "2025-06-26T16:07:43Z"
 * - "2025-06-26T16:07:43" -> "2025-06-26T16:07:43Z"
 * - "2025-06-26T16:07:43Z" -> "2025-06-26T16:07:43Z" (unchanged)
 * - "2025-06-26T16:07:43+09:00" -> "2025-06-26T07:07:43Z" (converted to UTC)
 */
export function normalizeDateTimeToISO(dateString: string): string {
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
 * Get SQL expression for current timestamp in ISO 8601 format
 * Note: This generates JavaScript datetime, not SQL function
 */
export function getCurrentTimestampSQL(): string {
  return getCurrentDateTimeISO()
}
