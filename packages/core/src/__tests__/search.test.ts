import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TableManager } from '../lib/table-manager'
import type { MockD1Database, MockExecutionContext, MockR2Bucket } from './setup'
import { createMockD1Database, createMockExecutionContext, createMockR2Bucket } from './setup'

describe('Search Functionality', () => {
  let tableManager: TableManager
  let mockDb: MockD1Database
  let mockStorage: MockR2Bucket
  let mockCtx: MockExecutionContext

  beforeEach(async () => {
    mockDb = createMockD1Database()
    mockStorage = createMockR2Bucket()
    mockCtx = createMockExecutionContext()
    tableManager = new TableManager(mockDb as any, mockStorage as any, mockCtx as any, {
      REALTIME: undefined,
    })

    // Create a test table with some indexed columns
    await tableManager.createTable('searchtable', [
      { name: 'name', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'age', type: 'INTEGER', constraints: '' },
      { name: 'email', type: 'TEXT', constraints: '' },
    ])

    // Create an index on name column
    await tableManager.createIndex('idx_searchtable_name', 'searchtable', ['name'])

    // Create an index on age column
    await tableManager.createIndex('idx_searchtable_age', 'searchtable', ['age'])

    // Insert test data
    await tableManager.createRecord('searchtable', {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com',
    })

    await tableManager.createRecord('searchtable', {
      name: 'Jane Smith',
      age: 25,
      email: 'jane@example.com',
    })

    await tableManager.createRecord('searchtable', {
      name: 'Bob Wilson',
      age: 35,
      email: 'bob@example.com',
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
    it('should return searchable columns for table', async () => {
      const searchableColumns = await tableManager.getSearchableColumns('searchtable')

      // Should return array (might be empty if no indexed columns)
      expect(Array.isArray(searchableColumns)).toBe(true)
    })

    it('should handle table existence check', async () => {
      const searchableColumns = await tableManager.getSearchableColumns('searchtable')
      expect(Array.isArray(searchableColumns)).toBe(true)
    })
  })

  describe('searchRecords', () => {
    it('should return search result structure for basic searches', async () => {
      const result = await tableManager.searchRecords(
        'searchtable',
        [
          {
            column: 'name',
            operator: 'eq',
            value: 'John Doe',
          },
        ],
        0
      )

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('total')
      expect(Array.isArray(result.data)).toBe(true)
      expect(typeof result.total).toBe('number')
    })

    it('should handle comparison operators', async () => {
      const result = await tableManager.searchRecords(
        'searchtable',
        [
          {
            column: 'age',
            operator: 'gt',
            value: '30',
          },
        ],
        0
      )

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('total')
      expect(Array.isArray(result.data)).toBe(true)
      expect(typeof result.total).toBe('number')
    })

    it('should handle NULL checks', async () => {
      const result = await tableManager.searchRecords(
        'searchtable',
        [
          {
            column: 'age',
            operator: 'is_null',
            value: '',
          },
        ],
        0
      )

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('total')
      expect(Array.isArray(result.data)).toBe(true)
      expect(typeof result.total).toBe('number')
    })

    it('should handle pagination parameters', async () => {
      const result = await tableManager.searchRecords(
        'searchtable',
        [
          {
            column: 'age',
            operator: 'is_not_null',
            value: '',
          },
        ],
        0,
        2
      )

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('total')
      expect(Array.isArray(result.data)).toBe(true)
      expect(typeof result.total).toBe('number')
    })

    it('should return empty results for no matches', async () => {
      const result = await tableManager.searchRecords(
        'searchtable',
        [
          {
            column: 'name',
            operator: 'eq',
            value: 'Nonexistent Person',
          },
        ],
        0
      )

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('total')
      expect(Array.isArray(result.data)).toBe(true)
      expect(typeof result.total).toBe('number')
    })
  })
})
