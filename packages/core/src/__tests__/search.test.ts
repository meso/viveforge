import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TableManager } from '../lib/table-manager'
import { createMockD1Database, createMockR2Bucket, createMockExecutionContext } from './setup'
import type { MockD1Database, MockR2Bucket, MockExecutionContext } from './setup'

describe('Search Functionality', () => {
  let tableManager: TableManager
  let mockDb: MockD1Database
  let mockStorage: MockR2Bucket
  let mockCtx: MockExecutionContext

  beforeEach(async () => {
    mockDb = createMockD1Database()
    mockStorage = createMockR2Bucket()
    mockCtx = createMockExecutionContext()
    tableManager = new TableManager(
      mockDb as any, 
      mockStorage as any, 
      mockCtx as any,
      { REALTIME: undefined }
    )

    // Create a test table with some indexed columns
    await tableManager.createTable('searchtable', [
      { name: 'name', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'age', type: 'INTEGER', constraints: '' },
      { name: 'email', type: 'TEXT', constraints: '' }
    ])

    // Create an index on name column
    await tableManager.createIndex('idx_searchtable_name', 'searchtable', ['name'])
    
    // Create an index on age column
    await tableManager.createIndex('idx_searchtable_age', 'searchtable', ['age'])

    // Insert test data
    await tableManager.createRecord('searchtable', {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com'
    })

    await tableManager.createRecord('searchtable', {
      name: 'Jane Smith',
      age: 25,
      email: 'jane@example.com'
    })

    await tableManager.createRecord('searchtable', {
      name: 'Bob Wilson',
      age: 35,
      email: 'bob@example.com'
    })
  })

  afterEach(async () => {
    // Clean up - Note: deleteTable method doesn't exist, 
    // but in tests we can rely on the mock DB being reset
    // try {
    //   await tableManager.deleteTable('searchtable')
    // } catch (error) {
    //   // Table might not exist, ignore
    // }
  })

  describe('getSearchableColumns', () => {
    it('should return indexed TEXT and INTEGER columns', async () => {
      const searchableColumns = await tableManager.getSearchableColumns('searchtable')
      
      expect(searchableColumns).toHaveLength(2) // name, age (excluding primary key)
      expect(searchableColumns.map(col => col.name)).toContain('name')
      expect(searchableColumns.map(col => col.name)).toContain('age')
      
      const nameColumn = searchableColumns.find(col => col.name === 'name')
      expect(nameColumn?.type).toBe('TEXT')
      
      const ageColumn = searchableColumns.find(col => col.name === 'age')
      expect(ageColumn?.type).toBe('INTEGER')
    })

    it('should not include non-indexed columns', async () => {
      const searchableColumns = await tableManager.getSearchableColumns('searchtable')
      
      // email column is not indexed, so it should not be searchable
      expect(searchableColumns.map(col => col.name)).not.toContain('email')
    })
  })

  describe('searchRecords', () => {
    it('should find exact matches for TEXT columns', async () => {
      const result = await tableManager.searchRecords('searchtable', {
        column: 'name',
        operator: 'eq',
        value: 'John Doe',
        offset: 0
      })

      expect(result.total).toBe(1)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('John Doe')
      expect(result.hasMore).toBe(false)
    })

    it('should support comparison operators for INTEGER columns', async () => {
      // Test greater than
      const gtResult = await tableManager.searchRecords('searchtable', {
        column: 'age',
        operator: 'gt',
        value: '30',
        offset: 0
      })

      expect(gtResult.total).toBe(1)
      expect(gtResult.data[0].name).toBe('Bob Wilson')

      // Test less than or equal
      const leResult = await tableManager.searchRecords('searchtable', {
        column: 'age',
        operator: 'le',
        value: '30',
        offset: 0
      })

      expect(leResult.total).toBe(2) // John (30) and Jane (25)
    })

    it('should support NULL checks', async () => {
      // Add a record with null age
      await tableManager.createRecord('searchtable', {
        name: 'Null Age Person',
        email: 'null@example.com'
      })

      const nullResult = await tableManager.searchRecords('searchtable', {
        column: 'age',
        operator: 'is_null',
        offset: 0
      })

      expect(nullResult.total).toBe(1)
      expect(nullResult.data[0].name).toBe('Null Age Person')

      const notNullResult = await tableManager.searchRecords('searchtable', {
        column: 'age',
        operator: 'is_not_null',
        offset: 0
      })

      expect(notNullResult.total).toBe(3) // John, Jane, Bob
    })

    it('should support pagination', async () => {
      const result = await tableManager.searchRecords('searchtable', {
        column: 'age',
        operator: 'is_not_null',
        limit: 2,
        offset: 0
      })

      expect(result.total).toBe(3)
      expect(result.data).toHaveLength(2)
      expect(result.hasMore).toBe(true)

      const result2 = await tableManager.searchRecords('searchtable', {
        column: 'age',
        operator: 'is_not_null',
        limit: 2,
        offset: 2
      })

      expect(result2.total).toBe(3)
      expect(result2.data).toHaveLength(1)
      expect(result2.hasMore).toBe(false)
    })

    it('should return empty results for no matches', async () => {
      const result = await tableManager.searchRecords('searchtable', {
        column: 'name',
        operator: 'eq',
        value: 'Nonexistent Person',
        offset: 0
      })

      expect(result.total).toBe(0)
      expect(result.data).toHaveLength(0)
      expect(result.hasMore).toBe(false)
    })
  })
})