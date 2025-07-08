import { describe, expect, it } from 'vitest'
import { isEditableSystemTable, isSystemTable } from '../database'

describe('Database Utils', () => {
  describe('isSystemTable', () => {
    it('should return true for all system tables', () => {
      const systemTables = [
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

      systemTables.forEach((table) => {
        expect(isSystemTable(table)).toBe(true)
      })
    })

    it('should return true for vapid_config specifically', () => {
      expect(isSystemTable('vapid_config')).toBe(true)
    })

    it('should return false for user tables', () => {
      const userTables = ['posts', 'comments', 'products', 'orders', 'my_custom_table']
      userTables.forEach((table) => {
        expect(isSystemTable(table)).toBe(false)
      })
    })

    it('should return false for empty string', () => {
      expect(isSystemTable('')).toBe(false)
    })

    it('should be case sensitive', () => {
      expect(isSystemTable('ADMINS')).toBe(false)
      expect(isSystemTable('Vapid_Config')).toBe(false)
    })
  })

  describe('isEditableSystemTable', () => {
    it('should return false for all system tables after our changes', () => {
      const systemTables = [
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
        'vapid_config',
      ]

      // After our changes, ALL system tables should be read-only in the database UI
      systemTables.forEach((table) => {
        expect(isEditableSystemTable(table)).toBe(false)
      })
    })

    it('should return false for vapid_config specifically', () => {
      expect(isEditableSystemTable('vapid_config')).toBe(false)
    })

    it('should return false for admins table (no longer editable via database UI)', () => {
      // Previously this might have been true, but after our changes admin management
      // is done through settings, so database UI should be read-only
      expect(isEditableSystemTable('admins')).toBe(false)
    })

    it('should return false for user tables (function only handles system tables)', () => {
      const userTables = ['posts', 'comments', 'products']
      userTables.forEach((table) => {
        expect(isEditableSystemTable(table)).toBe(false)
      })
    })
  })

  describe('System Tables UI Restrictions Integration', () => {
    it('should ensure vapid_config is properly restricted', () => {
      // This is the key behavior for our changes
      expect(isSystemTable('vapid_config')).toBe(true)
      expect(isEditableSystemTable('vapid_config')).toBe(false)
    })

    it('should ensure all system tables are read-only in database UI', () => {
      // This verifies our change to make ALL system tables read-only
      const allSystemTables = [
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
        'vapid_config',
      ]

      allSystemTables.forEach((table) => {
        expect(isSystemTable(table)).toBe(true)
        expect(isEditableSystemTable(table)).toBe(false)
      })
    })

    it('should maintain consistency between system table identification and editability', () => {
      // If something is a system table, it should not be editable in database UI
      const testTables = [
        'admins',
        'vapid_config',
        'users',
        'oauth_providers',
        'posts',
        'comments',
        'my_table', // Mix of system and user tables
      ]

      testTables.forEach((table) => {
        if (isSystemTable(table)) {
          expect(isEditableSystemTable(table)).toBe(false)
        }
      })
    })
  })
})
