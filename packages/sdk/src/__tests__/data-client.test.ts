/**
 * Tests for DataClient
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataClient } from '../lib/data-client'
import type { HttpClient } from '../lib/http-client'

describe('DataClient', () => {
  let dataClient: DataClient
  let mockHttpClient: HttpClient

  beforeEach(() => {
    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
    } as HttpClient

    dataClient = new DataClient(mockHttpClient)
  })

  describe('list', () => {
    it('should list records with default options', async () => {
      const mockResponse = {
        success: true,
        data: { data: [{ id: '1', title: 'Test' }], total: 1 },
      }

      vi.mocked(mockHttpClient.get).mockResolvedValueOnce(mockResponse)

      const result = await dataClient.list('todos')

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/tables/todos/data', {})
      expect(result).toEqual(mockResponse)
    })

    it('should list records with query options', async () => {
      const options = {
        limit: 10,
        offset: 20,
        orderBy: 'created_at',
        orderDirection: 'desc' as const,
        where: { completed: false },
      }

      const mockResponse = {
        success: true,
        data: { data: [], total: 0 },
      }

      vi.mocked(mockHttpClient.get).mockResolvedValueOnce(mockResponse)

      await dataClient.list('todos', options)

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/tables/todos/data', {
        limit: '10',
        offset: '20',
        order_by: 'created_at',
        order_direction: 'desc',
        where: JSON.stringify({ completed: false }),
      })
    })
  })

  describe('get', () => {
    it('should get a single record', async () => {
      const mockResponse = {
        success: true,
        data: { id: '1', title: 'Test Todo' },
      }

      vi.mocked(mockHttpClient.get).mockResolvedValueOnce(mockResponse)

      const result = await dataClient.get('todos', '1')

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/data/todos/1')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('create', () => {
    it('should create a new record', async () => {
      const data = { title: 'New Todo', completed: false }
      const mockResponse = {
        success: true,
        data: { id: '1', ...data, created_at: '2023-01-01', updated_at: '2023-01-01' },
      }

      vi.mocked(mockHttpClient.post).mockResolvedValueOnce(mockResponse)

      const result = await dataClient.create('todos', data)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/tables/todos/data', data)
      expect(result).toEqual(mockResponse)
    })

    it('should create record with select options', async () => {
      const data = { title: 'New Todo', completed: false }
      const options = { select: ['id', 'title'] }

      vi.mocked(mockHttpClient.post).mockResolvedValueOnce({ success: true, data: {} })

      await dataClient.create('todos', data, options)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/tables/todos/data', {
        ...data,
        select: ['id', 'title'],
      })
    })
  })

  describe('update', () => {
    it('should update a record', async () => {
      const data = { title: 'Updated Todo' }
      const mockResponse = {
        success: true,
        data: { id: '1', title: 'Updated Todo', completed: false },
      }

      vi.mocked(mockHttpClient.put).mockResolvedValueOnce(mockResponse)

      const result = await dataClient.update('todos', '1', data)

      expect(mockHttpClient.put).toHaveBeenCalledWith('/api/data/todos/1', data)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('delete', () => {
    it('should delete a record', async () => {
      const mockResponse = { success: true, status: 204 }

      vi.mocked(mockHttpClient.delete).mockResolvedValueOnce(mockResponse)

      const result = await dataClient.delete('todos', '1')

      expect(mockHttpClient.delete).toHaveBeenCalledWith('/api/data/todos/1')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('search', () => {
    it('should search records', async () => {
      const mockResponse = {
        success: true,
        data: { data: [{ id: '1', title: 'Important Todo' }], total: 1 },
      }

      vi.mocked(mockHttpClient.get).mockResolvedValueOnce(mockResponse)

      const result = await dataClient.search('todos', 'important')

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/tables/todos/search', {
        q: 'important',
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('bulk operations', () => {
    it('should bulk insert records', async () => {
      const records = [
        { title: 'Todo 1', completed: false },
        { title: 'Todo 2', completed: true },
      ]

      const mockResponse = {
        success: true,
        data: { inserted: 2, records: [] },
      }

      vi.mocked(mockHttpClient.post).mockResolvedValueOnce(mockResponse)

      const result = await dataClient.bulkInsert('todos', records)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/tables/todos/bulk', { records })
      expect(result).toEqual(mockResponse)
    })

    it('should bulk update records', async () => {
      const updates = [
        { id: '1', data: { completed: true } },
        { id: '2', data: { title: 'Updated' } },
      ]

      const mockResponse = {
        success: true,
        data: { updated: 2, records: [] },
      }

      vi.mocked(mockHttpClient.put).mockResolvedValueOnce(mockResponse)

      const result = await dataClient.bulkUpdate('todos', updates)

      expect(mockHttpClient.put).toHaveBeenCalledWith('/api/tables/todos/bulk', { updates })
      expect(result).toEqual(mockResponse)
    })

    it('should bulk delete records', async () => {
      const ids = ['1', '2', '3']

      const mockResponse = {
        success: true,
        data: { deleted: 3 },
      }

      vi.mocked(mockHttpClient.request).mockResolvedValueOnce(mockResponse)

      const result = await dataClient.bulkDelete('todos', ids)

      expect(mockHttpClient.request).toHaveBeenCalledWith('/api/tables/todos/bulk', {
        method: 'DELETE',
        body: JSON.stringify({ ids }),
      })
      expect(result).toEqual(mockResponse)
    })
  })
})
