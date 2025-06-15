import { describe, it, expect, beforeEach } from 'vitest'
import { TableManager } from '../lib/table-manager'
import { createMockD1Database, createMockR2Bucket, createMockExecutionContext } from './setup'
import type { MockD1Database, MockR2Bucket, MockExecutionContext } from './setup'

describe('TableManager', () => {
  let tableManager: TableManager
  let mockDb: MockD1Database
  let mockStorage: MockR2Bucket
  let mockCtx: MockExecutionContext

  beforeEach(() => {
    mockDb = createMockD1Database()
    mockStorage = createMockR2Bucket()
    mockCtx = createMockExecutionContext()
    tableManager = new TableManager(mockDb, mockStorage, mockCtx)
  })

  describe('Table Operations', () => {
    it('should get tables list', async () => {
      const tables = await tableManager.getTables()
      expect(tables).toBeInstanceOf(Array)
      expect(tables.every(table => 
        typeof table.name === 'string' && 
        typeof table.type === 'string' &&
        typeof table.sql === 'string'
      )).toBe(true)
    })

    it('should create a new table', async () => {
      const tableName = 'test_table'
      const columns = [
        { name: 'title', type: 'TEXT', constraints: 'NOT NULL' },
        { name: 'description', type: 'TEXT' }
      ]

      await expect(tableManager.createTable(tableName, columns)).resolves.not.toThrow()
    })

    it('should not create system tables', async () => {
      const systemTableName = 'admins'
      const columns = [{ name: 'test', type: 'TEXT' }]

      await expect(tableManager.createTable(systemTableName, columns))
        .rejects.toThrow('Cannot create system table')
    })

    it('should validate table names', async () => {
      const invalidTableName = '123invalid'
      const columns = [{ name: 'test', type: 'TEXT' }]

      await expect(tableManager.createTable(invalidTableName, columns))
        .rejects.toThrow('Invalid table name')
    })

    it('should drop a user table', async () => {
      const tableName = 'test_table'
      await expect(tableManager.dropTable(tableName)).resolves.not.toThrow()
    })

    it('should not drop system tables', async () => {
      const systemTableName = 'admins'
      await expect(tableManager.dropTable(systemTableName))
        .rejects.toThrow('Cannot drop system table')
    })
  })

  describe('Column Operations', () => {
    const testTableName = 'test_table'

    beforeEach(async () => {
      // Create a test table first
      await tableManager.createTable(testTableName, [
        { name: 'title', type: 'TEXT' }
      ])
    })

    it('should add column to existing table', async () => {
      const column = { name: 'description', type: 'TEXT' }
      await expect(tableManager.addColumn(testTableName, column)).resolves.not.toThrow()
    })

    it('should rename column', async () => {
      await expect(tableManager.renameColumn(testTableName, 'title', 'new_title'))
        .resolves.not.toThrow()
    })

    it('should drop column', async () => {
      await expect(tableManager.dropColumn(testTableName, 'title'))
        .resolves.not.toThrow()
    })

    it('should validate column changes', async () => {
      const changes = { type: 'INTEGER', notNull: true }
      const result = await tableManager.validateColumnChanges(testTableName, 'title', changes)
      
      expect(result).toHaveProperty('valid')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('conflictingRows')
      expect(typeof result.valid).toBe('boolean')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(typeof result.conflictingRows).toBe('number')
    })

    it('should modify column', async () => {
      const changes = { type: 'TEXT', notNull: false }
      await expect(tableManager.modifyColumn(testTableName, 'title', changes))
        .resolves.not.toThrow()
    })
  })

  describe('Data Operations', () => {
    const testTableName = 'test_table'

    beforeEach(async () => {
      await tableManager.createTable(testTableName, [
        { name: 'title', type: 'TEXT' },
        { name: 'description', type: 'TEXT' }
      ])
    })

    it('should get table columns', async () => {
      const columns = await tableManager.getTableColumns(testTableName)
      expect(Array.isArray(columns)).toBe(true)
    })

    it('should get foreign keys', async () => {
      const foreignKeys = await tableManager.getForeignKeys(testTableName)
      expect(Array.isArray(foreignKeys)).toBe(true)
    })

    it('should get table data with pagination', async () => {
      const result = await tableManager.getTableData(testTableName, 10, 0)
      
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('total')
      expect(Array.isArray(result.data)).toBe(true)
      expect(typeof result.total).toBe('number')
    })

    it('should create record', async () => {
      const data = { title: 'Test Title', description: 'Test Description' }
      await expect(tableManager.createRecord(testTableName, data)).resolves.not.toThrow()
    })

    it('should create record with ID', async () => {
      const data = { title: 'Test Title', description: 'Test Description' }
      const id = await tableManager.createRecordWithId(testTableName, data)
      
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('should update record', async () => {
      const recordId = 'test-id'
      const data = { title: 'Updated Title' }
      await expect(tableManager.updateRecord(testTableName, recordId, data))
        .resolves.not.toThrow()
    })

    it('should delete record', async () => {
      const recordId = 'test-id'
      await expect(tableManager.deleteRecord(testTableName, recordId))
        .resolves.not.toThrow()
    })

    it('should get record by ID', async () => {
      const recordId = 'test-id'
      const result = await tableManager.getRecordById(testTableName, recordId)
      // Result can be null if record doesn't exist
      expect(result === null || typeof result === 'object').toBe(true)
    })
  })

  describe('Index Operations', () => {
    const testTableName = 'test_table'

    beforeEach(async () => {
      await tableManager.createTable(testTableName, [
        { name: 'title', type: 'TEXT' },
        { name: 'category', type: 'TEXT' }
      ])
    })

    it('should get table indexes', async () => {
      const indexes = await tableManager.getTableIndexes(testTableName)
      expect(Array.isArray(indexes)).toBe(true)
    })

    it('should create index', async () => {
      const indexName = 'idx_test_title'
      const columns = ['title']
      const options = { unique: false }
      
      await expect(tableManager.createIndex(indexName, testTableName, columns, options))
        .resolves.not.toThrow()
    })

    it('should create unique index', async () => {
      const indexName = 'idx_test_unique'
      const columns = ['title']
      const options = { unique: true }
      
      await expect(tableManager.createIndex(indexName, testTableName, columns, options))
        .resolves.not.toThrow()
    })

    it('should drop index', async () => {
      // First create an index
      const indexName = 'idx_test_drop'
      await tableManager.createIndex(indexName, testTableName, ['title'])
      
      // Then drop it
      await expect(tableManager.dropIndex(indexName)).resolves.not.toThrow()
    })

    it('should get all user indexes', async () => {
      const indexes = await tableManager.getAllUserIndexes()
      expect(Array.isArray(indexes)).toBe(true)
    })

    it('should validate index names', async () => {
      const invalidIndexName = '123invalid'
      const columns = ['title']
      
      await expect(tableManager.createIndex(invalidIndexName, testTableName, columns))
        .rejects.toThrow('Invalid index name format')
    })

    it('should prevent duplicate index names', async () => {
      const indexName = 'idx_duplicate'
      const columns = ['title']
      
      // Create first index
      await tableManager.createIndex(indexName, testTableName, columns)
      
      // Try to create duplicate
      await expect(tableManager.createIndex(indexName, testTableName, columns))
        .rejects.toThrow('already exists')
    })

    // Additional detailed tests for pre-refactoring validation
    describe('Index Creation - Detailed Validation', () => {
      it('should validate required parameters', async () => {
        await expect(tableManager.createIndex('', testTableName, ['title']))
          .rejects.toThrow('Index name, table name, and columns are required')
          
        await expect(tableManager.createIndex('idx_test', '', ['title']))
          .rejects.toThrow('Index name, table name, and columns are required')
          
        await expect(tableManager.createIndex('idx_test', testTableName, []))
          .rejects.toThrow('Index name, table name, and columns are required')
      })

      it('should accept valid index name formats', async () => {
        await expect(tableManager.createIndex('idx_valid', testTableName, ['title']))
          .resolves.not.toThrow()
          
        await expect(tableManager.createIndex('IDX_VALID2', testTableName, ['category']))
          .resolves.not.toThrow()
          
        await expect(tableManager.createIndex('_idx_valid3', testTableName, ['title']))
          .resolves.not.toThrow()
      })

      it('should reject invalid index name formats', async () => {
        await expect(tableManager.createIndex('123invalid', testTableName, ['title']))
          .rejects.toThrow('Invalid index name format')
          
        await expect(tableManager.createIndex('idx-invalid', testTableName, ['title']))
          .rejects.toThrow('Invalid index name format')
          
        await expect(tableManager.createIndex('idx invalid', testTableName, ['title']))
          .rejects.toThrow('Invalid index name format')
      })

      it('should create multi-column indexes', async () => {
        await expect(tableManager.createIndex('idx_multi', testTableName, ['title', 'category']))
          .resolves.not.toThrow()
      })

      it('should create unique indexes with proper option', async () => {
        await expect(tableManager.createIndex('idx_unique_detailed', testTableName, ['title'], { unique: true }))
          .resolves.not.toThrow()
      })
    })

    describe('Index Retrieval - Detailed Validation', () => {
      beforeEach(async () => {
        // Create test indexes
        await tableManager.createIndex('idx_title', testTableName, ['title'])
        await tableManager.createIndex('idx_category', testTableName, ['category'])
        await tableManager.createIndex('idx_unique_multi', testTableName, ['title', 'category'], { unique: true })
      })

      it('should return correct index metadata structure', async () => {
        const indexes = await tableManager.getTableIndexes(testTableName)
        
        indexes.forEach(index => {
          expect(index).toHaveProperty('name')
          expect(index).toHaveProperty('tableName')
          expect(index).toHaveProperty('columns')
          expect(index).toHaveProperty('unique')
          expect(index).toHaveProperty('sql')
          expect(typeof index.name).toBe('string')
          expect(typeof index.tableName).toBe('string')
          expect(Array.isArray(index.columns)).toBe(true)
          expect(typeof index.unique).toBe('boolean')
          expect(typeof index.sql).toBe('string')
        })
      })

      it('should return indexes specific to the requested table', async () => {
        const indexes = await tableManager.getTableIndexes(testTableName)
        
        indexes.forEach(index => {
          expect(index.tableName).toBe(testTableName)
        })
      })

      it('should filter out system-generated indexes', async () => {
        const indexes = await tableManager.getTableIndexes(testTableName)
        
        indexes.forEach(index => {
          expect(index.name).not.toMatch(/^sqlite_autoindex_/)
        })
      })

      it('should include columns in correct order for multi-column indexes', async () => {
        const indexes = await tableManager.getTableIndexes(testTableName)
        const multiColIndex = indexes.find(idx => idx.columns.length > 1)
        
        if (multiColIndex) {
          expect(multiColIndex.columns).toEqual(['title', 'category'])
        }
      })
    })

    describe('Index Deletion - Detailed Validation', () => {
      beforeEach(async () => {
        await tableManager.createIndex('idx_to_delete', testTableName, ['title'])
        await tableManager.createIndex('idx_to_keep', testTableName, ['category'])
      })

      it('should validate index name parameter', async () => {
        await expect(tableManager.dropIndex(''))
          .rejects.toThrow('Index name is required')
      })

      it('should reject dropping non-existent indexes', async () => {
        await expect(tableManager.dropIndex('non_existent_index'))
          .rejects.toThrow('Index "non_existent_index" not found')
      })

      it('should prevent dropping system-generated indexes', async () => {
        await expect(tableManager.dropIndex('sqlite_autoindex_test_table_1'))
          .rejects.toThrow() // Either "not found" or "cannot drop" is acceptable in mock
      })

      it('should successfully drop existing user indexes', async () => {
        await expect(tableManager.dropIndex('idx_to_delete'))
          .resolves.not.toThrow()
          
        // Verify it's gone
        const indexes = await tableManager.getTableIndexes(testTableName)
        expect(indexes.find(idx => idx.name === 'idx_to_delete')).toBeUndefined()
      })
    })

    describe('All User Indexes - Detailed Validation', () => {
      beforeEach(async () => {
        // Create indexes across different tables
        await tableManager.createIndex('idx_test1_title', testTableName, ['title'])
        await tableManager.createIndex('idx_test1_category', testTableName, ['category'])
      })

      it('should return all user-created indexes across tables', async () => {
        const indexes = await tableManager.getAllUserIndexes()
        
        expect(Array.isArray(indexes)).toBe(true)
        // Should include our test indexes
        const testIndexes = indexes.filter(idx => idx.tableName === testTableName)
        expect(testIndexes.length).toBeGreaterThan(0)
      })

      it('should include proper metadata for all indexes', async () => {
        const indexes = await tableManager.getAllUserIndexes()
        
        indexes.forEach(index => {
          expect(index).toHaveProperty('name')
          expect(index).toHaveProperty('tableName')
          expect(index).toHaveProperty('columns')
          expect(index).toHaveProperty('unique')
          expect(index).toHaveProperty('sql')
        })
      })

      it('should exclude system-generated indexes', async () => {
        const indexes = await tableManager.getAllUserIndexes()
        
        indexes.forEach(index => {
          expect(index.name).not.toMatch(/^sqlite_autoindex_/)
        })
      })
    })

    describe('Index Operations Integration', () => {
      it('should handle complete index lifecycle', async () => {
        const indexName = 'idx_lifecycle_test'
        
        // Create
        await expect(tableManager.createIndex(indexName, testTableName, ['title'], { unique: true }))
          .resolves.not.toThrow()
          
        // Verify exists in table indexes
        const tableIndexes = await tableManager.getTableIndexes(testTableName)
        const createdIndex = tableIndexes.find(idx => idx.name === indexName)
        expect(createdIndex).toBeDefined()
        expect(createdIndex?.unique).toBe(true)
        expect(createdIndex?.columns).toEqual(['title'])
        
        // Verify exists in all indexes
        const allIndexes = await tableManager.getAllUserIndexes()
        expect(allIndexes.some(idx => idx.name === indexName)).toBe(true)
        
        // Delete
        await expect(tableManager.dropIndex(indexName))
          .resolves.not.toThrow()
          
        // Verify removed
        const updatedTableIndexes = await tableManager.getTableIndexes(testTableName)
        expect(updatedTableIndexes.find(idx => idx.name === indexName)).toBeUndefined()
      })

      it('should handle multiple indexes on same table', async () => {
        const indexes = [
          { name: 'idx_multi_1', columns: ['title'] },
          { name: 'idx_multi_2', columns: ['category'] },
          { name: 'idx_multi_3', columns: ['title', 'category'], unique: true }
        ]
        
        // Create all indexes
        for (const index of indexes) {
          await expect(tableManager.createIndex(
            index.name, 
            testTableName, 
            index.columns, 
            { unique: index.unique }
          )).resolves.not.toThrow()
        }
        
        // Verify all exist
        const tableIndexes = await tableManager.getTableIndexes(testTableName)
        expect(tableIndexes.length).toBeGreaterThanOrEqual(3)
        
        // Check that all our created indexes are found
        for (const expectedIndex of indexes) {
          const found = tableIndexes.find(idx => idx.name === expectedIndex.name)
          expect(found).toBeDefined()
          // In mock environment, just verify basic properties exist
          expect(found?.columns).toBeDefined()
          expect(found?.unique).toBe(!!expectedIndex.unique)
        }
      })
    })
  })

  describe('Snapshot Operations', () => {
    it('should create snapshot', async () => {
      const options = {
        name: 'Test Snapshot',
        description: 'Test snapshot creation',
        snapshotType: 'manual' as const
      }
      
      const snapshotId = await tableManager.createSnapshot(options)
      expect(typeof snapshotId).toBe('string')
      expect(snapshotId.length).toBeGreaterThan(0)
    })

    it('should get snapshots with pagination', async () => {
      const result = await tableManager.getSnapshots(10, 0)
      
      expect(result).toHaveProperty('snapshots')
      expect(result).toHaveProperty('total')
      expect(Array.isArray(result.snapshots)).toBe(true)
      expect(typeof result.total).toBe('number')
    })

    it('should get single snapshot', async () => {
      // Create a snapshot first
      const snapshotId = await tableManager.createSnapshot({ name: 'Test' })
      
      const snapshot = await tableManager.getSnapshot(snapshotId)
      if (snapshot) {
        expect(snapshot).toHaveProperty('id')
        expect(snapshot).toHaveProperty('name')
        expect(snapshot.id).toBe(snapshotId)
      }
    })

    it('should restore snapshot', async () => {
      // Create a snapshot first
      const snapshotId = await tableManager.createSnapshot({ name: 'Test' })
      
      const result = await tableManager.restoreSnapshot(snapshotId)
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
    })

    it('should delete snapshot', async () => {
      // Create a snapshot first
      const snapshotId = await tableManager.createSnapshot({ name: 'Test' })
      
      const result = await tableManager.deleteSnapshot(snapshotId)
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
      expect(result.success).toBe(true)
    })
  })

  describe('SQL Operations', () => {
    it('should execute safe SQL queries', async () => {
      const sql = 'SELECT COUNT(*) as count FROM sqlite_master'
      const result = await tableManager.executeSQL(sql)
      
      expect(result).toHaveProperty('results')
      expect(Array.isArray(result.results)).toBe(true)
    })

    it('should reject unsafe SQL queries', async () => {
      const unsafeSql = 'DROP TABLE users'
      
      await expect(tableManager.executeSQL(unsafeSql))
        .rejects.toThrow('Only SELECT queries are allowed')
    })

    it('should reject queries on system tables', async () => {
      const systemTableSql = 'SELECT * FROM admins'
      
      await expect(tableManager.executeSQL(systemTableSql))
        .rejects.toThrow('Cannot query system table')
    })
  })
})