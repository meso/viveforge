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
    tableManager = new TableManager(mockDb, mockStorage, mockCtx)

    // Create a test table with some indexed columns
    await tableManager.createTable({
      name: 'search_test_table',
      columns: [
        { name: 'name', type: 'TEXT', constraints: 'NOT NULL' },
        { name: 'age', type: 'INTEGER', constraints: '' },
        { name: 'email', type: 'TEXT', constraints: '' }
      ]
    })

    // Create an index on name column
    await tableManager.createIndex('idx_search_test_table_name', 'search_test_table', ['name'])
    
    // Create an index on age column
    await tableManager.createIndex('idx_search_test_table_age', 'search_test_table', ['age'])

    // Insert test data
    await tableManager.addRecord('search_test_table', {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com'
    })

    await tableManager.addRecord('search_test_table', {
      name: 'Jane Smith',
      age: 25,
      email: 'jane@example.com'
    })

    await tableManager.addRecord('search_test_table', {
      name: 'Bob Wilson',
      age: 35,
      email: 'bob@example.com'
    })
  })

  afterEach(async () => {
    // Clean up
    try {
      await tableManager.deleteTable('search_test_table')
    } catch (error) {
      // Table might not exist, ignore
    }
  })

  describe('getSearchableColumns', () => {
    it('should return indexed TEXT and INTEGER columns', async () => {
      const searchableColumns = await tableManager.getSearchableColumns('search_test_table')
      
      expect(searchableColumns).toHaveLength(3) // id (primary key), name, age
      expect(searchableColumns.map(col => col.name)).toContain('id')
      expect(searchableColumns.map(col => col.name)).toContain('name')
      expect(searchableColumns.map(col => col.name)).toContain('age')
      
      const nameColumn = searchableColumns.find(col => col.name === 'name')
      expect(nameColumn?.type).toBe('TEXT')
      
      const ageColumn = searchableColumns.find(col => col.name === 'age')
      expect(ageColumn?.type).toBe('INTEGER')
    })

    it('should not include non-indexed columns', async () => {
      const searchableColumns = await tableManager.getSearchableColumns('search_test_table')
      
      // email column is not indexed, so it should not be searchable
      expect(searchableColumns.map(col => col.name)).not.toContain('email')
    })
  })

  describe('searchRecords', () => {
    it('should find exact matches for TEXT columns', async () => {
      const result = await tableManager.searchRecords('search_test_table', {
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
      const gtResult = await tableManager.searchRecords('search_test_table', {
        column: 'age',
        operator: 'gt',
        value: '30',
        offset: 0
      })

      expect(gtResult.total).toBe(1)
      expect(gtResult.data[0].name).toBe('Bob Wilson')

      // Test less than or equal
      const leResult = await tableManager.searchRecords('search_test_table', {
        column: 'age',
        operator: 'le',
        value: '30',
        offset: 0
      })

      expect(leResult.total).toBe(2) // John (30) and Jane (25)
    })

    it('should support NULL checks', async () => {
      // Add a record with null age
      await tableManager.addRecord('search_test_table', {
        name: 'Null Age Person',
        email: 'null@example.com'
      })

      const nullResult = await tableManager.searchRecords('search_test_table', {
        column: 'age',
        operator: 'is_null',
        offset: 0
      })

      expect(nullResult.total).toBe(1)
      expect(nullResult.data[0].name).toBe('Null Age Person')

      const notNullResult = await tableManager.searchRecords('search_test_table', {
        column: 'age',
        operator: 'is_not_null',
        offset: 0
      })

      expect(notNullResult.total).toBe(3) // John, Jane, Bob
    })

    it('should support pagination', async () => {
      const result = await tableManager.searchRecords('search_test_table', {
        column: 'age',
        operator: 'is_not_null',
        limit: 2,
        offset: 0
      })

      expect(result.total).toBe(3)
      expect(result.data).toHaveLength(2)
      expect(result.hasMore).toBe(true)

      const result2 = await tableManager.searchRecords('search_test_table', {
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
      const result = await tableManager.searchRecords('search_test_table', {
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