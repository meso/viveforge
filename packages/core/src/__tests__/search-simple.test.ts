import { beforeEach, describe, expect, it } from 'vitest'
import { TableManager } from '../lib/table-manager'
import type { MockD1Database, MockExecutionContext, MockR2Bucket } from './setup'
import { createMockD1Database, createMockExecutionContext, createMockR2Bucket } from './setup'

describe('Search Functionality - Simple', () => {
  let tableManager: TableManager
  let mockDb: MockD1Database
  let mockStorage: MockR2Bucket
  let mockCtx: MockExecutionContext

  beforeEach(() => {
    mockDb = createMockD1Database()
    mockStorage = createMockR2Bucket()
    mockCtx = createMockExecutionContext()
    tableManager = new TableManager(mockDb as any, mockStorage as any, mockCtx as any, {
      REALTIME: undefined,
    })
  })

  it('should have getSearchableColumns method', () => {
    expect(typeof tableManager.getSearchableColumns).toBe('function')
  })

  it('should have searchRecords method', () => {
    expect(typeof tableManager.searchRecords).toBe('function')
  })
})
