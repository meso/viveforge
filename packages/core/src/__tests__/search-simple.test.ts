import { describe, it, expect, beforeEach } from 'vitest'
import { TableManager } from '../lib/table-manager'
import { createMockD1Database, createMockR2Bucket, createMockExecutionContext } from './setup'
import type { MockD1Database, MockR2Bucket, MockExecutionContext } from './setup'

describe('Search Functionality - Simple', () => {
  let tableManager: TableManager
  let mockDb: MockD1Database
  let mockStorage: MockR2Bucket
  let mockCtx: MockExecutionContext

  beforeEach(() => {
    mockDb = createMockD1Database()
    mockStorage = createMockR2Bucket()
    mockCtx = createMockExecutionContext()
    tableManager = new TableManager(mockDb as any, mockStorage as any, mockCtx as any)
  })

  it('should have getSearchableColumns method', () => {
    expect(typeof tableManager.getSearchableColumns).toBe('function')
  })

  it('should have searchRecords method', () => {
    expect(typeof tableManager.searchRecords).toBe('function')
  })
})