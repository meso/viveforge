import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomQueriesClient } from '../lib/custom-queries-client'
import type { HttpClient } from '../lib/http-client'

describe('CustomQueriesClient', () => {
  let customQueriesClient: CustomQueriesClient
  let mockHttpClient: jest.Mocked<HttpClient>

  beforeEach(() => {
    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
    } as jest.Mocked<HttpClient>

    customQueriesClient = new CustomQueriesClient(mockHttpClient)
  })

  describe('create', () => {
    it('should create a custom query', async () => {
      const query = {
        name: 'Test Query',
        query: 'SELECT * FROM users WHERE status = :status',
        parameters: [
          {
            name: 'status',
            type: 'string' as const,
            required: true,
          },
        ],
        cache_ttl: 300,
        is_enabled: true,
      }
      const mockResponse = {
        success: true,
        data: {
          id: 'query-123',
          slug: 'test-query-abc123',
          ...query,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        status: 201,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.create(query)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/custom-queries', query)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('list', () => {
    it('should list all custom queries', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 'query-123',
            slug: 'test-query-abc123',
            name: 'Test Query',
            query: 'SELECT * FROM users WHERE status = :status',
            parameters: [
              {
                name: 'status',
                type: 'string',
                required: true,
              },
            ],
            cache_ttl: 300,
            is_enabled: true,
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ],
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.list()

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/custom-queries')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('get', () => {
    it('should get a specific custom query', async () => {
      const queryId = 'query-123'
      const mockResponse = {
        success: true,
        data: {
          id: queryId,
          slug: 'test-query-abc123',
          name: 'Test Query',
          query: 'SELECT * FROM users WHERE status = :status',
          parameters: [
            {
              name: 'status',
              type: 'string',
              required: true,
            },
          ],
          cache_ttl: 300,
          is_enabled: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.get(queryId)

      expect(mockHttpClient.get).toHaveBeenCalledWith(`/api/custom-queries/${queryId}`)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('update', () => {
    it('should update a custom query', async () => {
      const queryId = 'query-123'
      const updates = {
        name: 'Updated Query',
        cache_ttl: 600,
        is_enabled: false,
      }
      const mockResponse = {
        success: true,
        data: {
          id: queryId,
          slug: 'updated-query-abc123',
          name: 'Updated Query',
          query: 'SELECT * FROM users WHERE status = :status',
          parameters: [
            {
              name: 'status',
              type: 'string',
              required: true,
            },
          ],
          cache_ttl: 600,
          is_enabled: false,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:01:00Z',
        },
        status: 200,
      }
      mockHttpClient.patch.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.update(queryId, updates)

      expect(mockHttpClient.patch).toHaveBeenCalledWith(`/api/custom-queries/${queryId}`, updates)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('delete', () => {
    it('should delete a custom query', async () => {
      const queryId = 'query-123'
      const mockResponse = {
        success: true,
        status: 200,
      }
      mockHttpClient.delete.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.delete(queryId)

      expect(mockHttpClient.delete).toHaveBeenCalledWith(`/api/custom-queries/${queryId}`)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('execute', () => {
    it('should execute a custom query by ID', async () => {
      const queryId = 'query-123'
      const parameters = { status: 'active' }
      const mockResponse = {
        success: true,
        data: {
          data: [
            { id: '1', name: 'User 1', status: 'active' },
            { id: '2', name: 'User 2', status: 'active' },
          ],
          parameters,
          execution_time: 150,
          cached: false,
        },
        status: 200,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.execute(queryId, parameters)

      expect(mockHttpClient.post).toHaveBeenCalledWith(`/api/custom-queries/${queryId}/execute`, {
        parameters,
      })
      expect(result).toEqual(mockResponse)
    })

    it('should execute a custom query without parameters', async () => {
      const queryId = 'query-123'
      const mockResponse = {
        success: true,
        data: {
          data: [],
          parameters: {},
          execution_time: 50,
          cached: true,
        },
        status: 200,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.execute(queryId)

      expect(mockHttpClient.post).toHaveBeenCalledWith(`/api/custom-queries/${queryId}/execute`, {
        parameters: {},
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('executeBySlug', () => {
    it('should execute a custom query by slug', async () => {
      const slug = 'test-query-abc123'
      const parameters = { status: 'active', limit: 10 }
      const mockResponse = {
        success: true,
        data: {
          data: [{ id: '1', name: 'User 1', status: 'active' }],
          parameters,
          execution_time: 75,
          cached: false,
        },
        status: 200,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.executeBySlug(slug, parameters)

      expect(mockHttpClient.post).toHaveBeenCalledWith(`/api/custom-queries/slug/${slug}/execute`, {
        parameters,
      })
      expect(result).toEqual(mockResponse)
    })

    it('should execute a custom query by slug without parameters', async () => {
      const slug = 'simple-query-xyz789'
      const mockResponse = {
        success: true,
        data: {
          data: [{ count: 42 }],
          parameters: {},
          execution_time: 25,
          cached: true,
        },
        status: 200,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.executeBySlug(slug)

      expect(mockHttpClient.post).toHaveBeenCalledWith(`/api/custom-queries/slug/${slug}/execute`, {
        parameters: {},
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('test', () => {
    it('should test a custom query', async () => {
      const queryId = 'query-123'
      const parameters = { status: 'test' }
      const mockResponse = {
        success: true,
        data: {
          data: [{ id: 'test-1', name: 'Test User', status: 'test' }],
          parameters,
          execution_time: 100,
          cached: false,
          dry_run: true,
        },
        status: 200,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.test(queryId, parameters)

      expect(mockHttpClient.post).toHaveBeenCalledWith(`/api/custom-queries/${queryId}/test`, {
        parameters,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getExecutionHistory', () => {
    it('should get execution history for a query', async () => {
      const queryId = 'query-123'
      const options = { limit: 10, offset: 0 }
      const mockResponse = {
        success: true,
        data: {
          executions: [
            {
              id: 'exec-1',
              query_id: queryId,
              parameters: { status: 'active' },
              execution_time: 150,
              result_count: 5,
              cached: false,
              executed_at: '2023-01-01T00:00:00Z',
            },
            {
              id: 'exec-2',
              query_id: queryId,
              parameters: { status: 'inactive' },
              execution_time: 75,
              result_count: 2,
              cached: true,
              executed_at: '2023-01-01T00:01:00Z',
            },
          ],
          total: 2,
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.getExecutionHistory(queryId, options)

      expect(mockHttpClient.get).toHaveBeenCalledWith(`/api/custom-queries/${queryId}/history`, {
        limit: '10',
        offset: '0',
      })
      expect(result).toEqual(mockResponse)
    })

    it('should get execution history without options', async () => {
      const queryId = 'query-123'
      const mockResponse = {
        success: true,
        data: {
          executions: [],
          total: 0,
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.getExecutionHistory(queryId)

      expect(mockHttpClient.get).toHaveBeenCalledWith(`/api/custom-queries/${queryId}/history`, {})
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getStats', () => {
    it('should get custom queries statistics', async () => {
      const mockResponse = {
        success: true,
        data: {
          total_queries: 15,
          enabled_queries: 12,
          total_executions: 1500,
          average_execution_time: 125,
          cache_hit_rate: 0.65,
          most_used_queries: [
            {
              id: 'query-123',
              name: 'Popular Query',
              execution_count: 500,
            },
            {
              id: 'query-456',
              name: 'Another Query',
              execution_count: 300,
            },
          ],
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.getStats()

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/custom-queries/stats')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('clearCache', () => {
    it('should clear cache for a specific query', async () => {
      const queryId = 'query-123'
      const mockResponse = {
        success: true,
        data: {
          cleared_entries: 5,
          cache_size_before: 1024,
          cache_size_after: 0,
        },
        status: 200,
      }
      mockHttpClient.delete.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.clearCache(queryId)

      expect(mockHttpClient.delete).toHaveBeenCalledWith(`/api/custom-queries/${queryId}/cache`)
      expect(result).toEqual(mockResponse)
    })

    it('should clear all query caches', async () => {
      const mockResponse = {
        success: true,
        data: {
          cleared_entries: 50,
          cache_size_before: 10240,
          cache_size_after: 0,
        },
        status: 200,
      }
      mockHttpClient.delete.mockResolvedValue(mockResponse)

      const result = await customQueriesClient.clearCache()

      expect(mockHttpClient.delete).toHaveBeenCalledWith('/api/custom-queries/cache')
      expect(result).toEqual(mockResponse)
    })
  })
})
