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
      
      // Wait a bit for async snapshot creation to complete
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const result = await tableManager.restoreSnapshot(snapshotId)
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
    })

    it('should delete snapshot', async () => {
      // Create a snapshot first
      const snapshotId = await tableManager.createSnapshot({ name: 'Test' })
      
      // Wait a bit for async snapshot creation to complete
      await new Promise(resolve => setTimeout(resolve, 10))
      
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