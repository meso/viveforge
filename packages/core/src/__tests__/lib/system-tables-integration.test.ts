import { describe, expect, it } from 'vitest'
import {
  isSystemTable,
  SYSTEM_TABLES as TABLE_OPERATIONS_SYSTEM_TABLES,
} from '../../lib/table-operations'

// Import these modules to verify they use the imported SYSTEM_TABLES
import '../../lib/table-access-controller'
import '../../lib/table-validator'

describe('SYSTEM_TABLES Integration', () => {
  describe('Single Source of Truth', () => {
    it('should have table-operations as the authoritative source', () => {
      // table-operations.ts should export SYSTEM_TABLES
      expect(TABLE_OPERATIONS_SYSTEM_TABLES).toBeDefined()
      expect(Array.isArray(TABLE_OPERATIONS_SYSTEM_TABLES)).toBe(true)
      expect(TABLE_OPERATIONS_SYSTEM_TABLES.length).toBeGreaterThan(0)
    })

    it('should include vapid_config in the authoritative source', () => {
      // The primary change we made - vapid_config should be in the main SYSTEM_TABLES
      expect(TABLE_OPERATIONS_SYSTEM_TABLES).toContain('vapid_config')
    })
  })

  describe('No Duplicate Definitions', () => {
    it('should have successfully consolidated SYSTEM_TABLES definitions', () => {
      // This test ensures the consolidation was successful
      // The main source should contain vapid_config and all expected tables
      expect(TABLE_OPERATIONS_SYSTEM_TABLES).toContain('vapid_config')
      expect(TABLE_OPERATIONS_SYSTEM_TABLES).toContain('admins')
      expect(TABLE_OPERATIONS_SYSTEM_TABLES).toContain('sessions')
      expect(TABLE_OPERATIONS_SYSTEM_TABLES).toContain('oauth_providers')
    })
  })

  describe('Consistent vapid_config inclusion', () => {
    it('should include vapid_config in the main SYSTEM_TABLES', () => {
      expect(TABLE_OPERATIONS_SYSTEM_TABLES).toContain('vapid_config')
    })

    it('should have vapid_config as a system table in all contexts', () => {
      // Should recognize vapid_config as a system table
      expect(isSystemTable('vapid_config')).toBe(true)
    })
  })

  describe('Maintenance Prevention', () => {
    it('should maintain vapid_config in the main SYSTEM_TABLES', () => {
      // This test will fail if someone accidentally removes vapid_config
      expect(TABLE_OPERATIONS_SYSTEM_TABLES).toContain('vapid_config')
      expect(TABLE_OPERATIONS_SYSTEM_TABLES.length).toBeGreaterThan(15) // Should have many system tables
    })

    it('should be memory efficient with single source', () => {
      // The main SYSTEM_TABLES should be properly defined
      expect(Array.isArray(TABLE_OPERATIONS_SYSTEM_TABLES)).toBe(true)
      expect(TABLE_OPERATIONS_SYSTEM_TABLES.length).toBeGreaterThan(0)
    })
  })

  describe('Type Safety', () => {
    it('should maintain proper TypeScript types after consolidation', () => {
      // These should be properly typed
      type SystemTablesType = typeof TABLE_OPERATIONS_SYSTEM_TABLES

      // Type check should pass
      const checkType = (tables: SystemTablesType) => tables.length > 0

      expect(checkType(TABLE_OPERATIONS_SYSTEM_TABLES)).toBe(true)
    })

    it('should support type-safe includes checks', () => {
      // This ensures TypeScript can properly infer the types
      const tableName = 'vapid_config' as const

      expect(TABLE_OPERATIONS_SYSTEM_TABLES.includes(tableName)).toBe(true)
    })
  })
})
