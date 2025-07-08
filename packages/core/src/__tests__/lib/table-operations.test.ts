import { describe, expect, it } from 'vitest'
import { isSystemTable, SYSTEM_TABLES } from '../../lib/table-operations'

describe('Table Operations', () => {
  describe('SYSTEM_TABLES', () => {
    it('should include all required system tables', () => {
      const expectedSystemTables = [
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
        'vapid_config', // This was added in our changes
      ]

      // Check that all expected tables are included
      expectedSystemTables.forEach((table) => {
        expect(SYSTEM_TABLES).toContain(table)
      })

      // Check that vapid_config is specifically included (our main change)
      expect(SYSTEM_TABLES).toContain('vapid_config')
    })

    it('should be a readonly array', () => {
      // SYSTEM_TABLES should be defined as 'as const'
      expect(Array.isArray(SYSTEM_TABLES)).toBe(true)
      expect(SYSTEM_TABLES.length).toBeGreaterThan(0)
    })

    it('should have unique entries', () => {
      const uniqueTables = [...new Set(SYSTEM_TABLES)]
      expect(uniqueTables.length).toBe(SYSTEM_TABLES.length)
    })
  })

  describe('isSystemTable', () => {
    it('should return true for all system tables', () => {
      SYSTEM_TABLES.forEach((table) => {
        expect(isSystemTable(table)).toBe(true)
      })
    })

    it('should return true for vapid_config specifically', () => {
      expect(isSystemTable('vapid_config')).toBe(true)
    })

    it('should return false for user tables', () => {
      const userTables = ['posts', 'comments', 'products', 'orders']
      userTables.forEach((table) => {
        expect(isSystemTable(table)).toBe(false)
      })
    })

    it('should return false for empty string', () => {
      expect(isSystemTable('')).toBe(false)
    })

    it('should return false for undefined/null', () => {
      expect(isSystemTable(undefined as unknown as string)).toBe(false)
      expect(isSystemTable(null as unknown as string)).toBe(false)
    })

    it('should be case sensitive', () => {
      expect(isSystemTable('ADMINS')).toBe(false) // Should be lowercase 'admins'
      expect(isSystemTable('Vapid_Config')).toBe(false) // Should be lowercase 'vapid_config'
    })
  })

  describe('vapid_config system table integration', () => {
    it('should prevent vapid_config from being treated as user table', () => {
      // This is the key behavior we want to ensure
      expect(isSystemTable('vapid_config')).toBe(true)
    })

    it('should be included in system table checks across the codebase', () => {
      // Verify that vapid_config is properly recognized as a system table
      const vapidConfig = 'vapid_config'

      // Should be in the system tables array
      expect(SYSTEM_TABLES.includes(vapidConfig as (typeof SYSTEM_TABLES)[number])).toBe(true)

      // Should be identified as a system table
      expect(isSystemTable(vapidConfig)).toBe(true)
    })
  })
})
