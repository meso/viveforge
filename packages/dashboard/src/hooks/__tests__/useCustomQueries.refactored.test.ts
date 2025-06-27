/**
 * Tests for refactored useCustomQueries hook
 */

import { act, renderHook, waitFor } from '@testing-library/preact'
import type { CustomQuery } from '../../types/custom-sql'
import { useCustomQueries } from '../useCustomQueries'

// Mock data
const mockQueries: CustomQuery[] = [
  {
    id: '1',
    slug: 'test-query-1',
    name: 'Test Query 1',
    description: 'First test query',
    sql_query: 'SELECT * FROM users',
    parameters: [],
    method: 'GET',
    is_readonly: true,
    cache_ttl: 0,
    is_enabled: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    slug: 'test-query-2',
    name: 'Test Query 2',
    description: 'Second test query',
    sql_query: 'INSERT INTO users (name) VALUES (:name)',
    parameters: [{ name: 'name', type: 'string', required: true }],
    method: 'POST',
    is_readonly: false,
    cache_ttl: 300,
    is_enabled: false,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
]

describe('useCustomQueries (refactored)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful responses
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ queries: mockQueries }),
    })
  })

  describe('initialization', () => {
    it('should initialize with default state', async () => {
      const { result } = renderHook(() => useCustomQueries())

      // Initial state should be loading
      expect(result.current.loading).toBe(true)
      expect(result.current.queries).toEqual([])
      expect(result.current.selectedQuery).toBeNull()
      expect(result.current.isCreating).toBe(false)
      expect(result.current.isEditing).toBe(false)
      expect(result.current.error).toBeNull()

      // Wait for auto-fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.queries).toEqual(mockQueries)
      })
    })

    it('should auto-fetch queries on mount', async () => {
      renderHook(() => useCustomQueries())

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/custom-queries', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      })
    })
  })

  describe('form management', () => {
    it('should reset form data', async () => {
      const { result } = renderHook(() => useCustomQueries())

      // Wait for initialization
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Set some form data
      result.current.setFormData({
        slug: 'test',
        name: 'Test',
        description: 'Test description',
        sql_query: 'SELECT 1',
        parameters: [],
        cache_ttl: 100,
        is_enabled: false,
      })

      // Reset form
      result.current.resetForm()

      await waitFor(() => {
        expect(result.current.formData).toEqual({
          slug: '',
          name: '',
          description: '',
          sql_query: '',
          parameters: [],
          cache_ttl: 0,
          is_enabled: false,
        })
      })
    })

    it('should load query to form', async () => {
      const { result } = renderHook(() => useCustomQueries())

      // Wait for initialization
      await waitFor(() => expect(result.current.loading).toBe(false))

      result.current.loadQueryToForm(mockQueries[0])

      await waitFor(() => {
        expect(result.current.formData).toEqual({
          slug: 'test-query-1',
          name: 'Test Query 1',
          description: 'First test query',
          sql_query: 'SELECT * FROM users',
          parameters: [],
          cache_ttl: 0,
          is_enabled: true,
        })
      })
    })
  })

  describe('CRUD operations', () => {
    it('should create a new query', async () => {
      const newQuery: CustomQuery = {
        id: '3',
        slug: 'new-query',
        name: 'New Query',
        description: 'A new query',
        sql_query: 'SELECT * FROM posts',
        parameters: [],
        method: 'GET',
        is_readonly: true,
        cache_ttl: 0,
        is_enabled: true,
        created_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z',
      }

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ queries: mockQueries }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(newQuery),
        })

      const { result } = renderHook(() => useCustomQueries())

      // Wait for initialization
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Set form data and wait for state update
      await act(async () => {
        result.current.setFormData({
          slug: 'new-query',
          name: 'New Query',
          description: 'A new query',
          sql_query: 'SELECT * FROM posts',
          parameters: [],
          cache_ttl: 0,
          is_enabled: true,
        })
        result.current.setIsCreating(true)
      })

      // Call handleCreate and wait for state to update
      await act(async () => {
        await result.current.handleCreate()
      })

      expect(result.current.isCreating).toBe(false)
      expect(result.current.queries).toHaveLength(3)
    })

    it('should delete a query', async () => {
      // Mock confirm dialog
      global.confirm = vi.fn().mockReturnValue(true)

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ queries: mockQueries }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })

      const { result } = renderHook(() => useCustomQueries())

      // Wait for initialization
      await waitFor(() => expect(result.current.loading).toBe(false))

      await waitFor(() => result.current.handleDelete('1'))

      await waitFor(() => {
        expect(result.current.queries).toHaveLength(1)
        expect(result.current.queries[0].id).toBe('2')
      })
    })

    it('should cancel delete when user declines confirmation', async () => {
      // Mock confirm dialog to return false
      global.confirm = vi.fn().mockReturnValue(false)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ queries: mockQueries }),
      })

      const { result } = renderHook(() => useCustomQueries())

      // Wait for initialization
      await waitFor(() => expect(result.current.loading).toBe(false))

      await waitFor(() => result.current.handleDelete('1'))

      // Should not have called delete API
      expect(fetch).toHaveBeenCalledTimes(1) // Only the initial fetch
      expect(result.current.queries).toHaveLength(2) // No change
    })
  })

  describe('test execution', () => {
    it('should test query successfully', async () => {
      const testResult = {
        data: [{ id: 1, name: 'John' }],
        row_count: 1,
        execution_time: 10,
      }

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ queries: mockQueries }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(testResult),
        })

      const { result } = renderHook(() => useCustomQueries())

      // Wait for initialization
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Select a query and wait for state update
      await act(async () => {
        result.current.setSelectedQuery(mockQueries[0])
      })

      // Call handleTest and wait for state to update
      await act(async () => {
        await result.current.handleTest()
      })

      expect(result.current.testResult).toEqual(testResult)
      expect(result.current.testError).toBeNull()
      expect(result.current.testing).toBe(false)
    })

    it('should handle test errors', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ queries: mockQueries }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'SQL syntax error' }),
        })

      const { result } = renderHook(() => useCustomQueries())

      // Wait for initialization
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Select a query and wait for state update
      await act(async () => {
        result.current.setSelectedQuery(mockQueries[0])
      })

      // Call handleTest and wait for state to update
      await act(async () => {
        await result.current.handleTest()
      })

      expect(result.current.testResult).toBeNull()
      expect(result.current.testError).toBe('SQL syntax error')
      expect(result.current.testing).toBe(false)
    })
  })

  describe('toggle enabled', () => {
    it('should toggle query enabled status', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ queries: mockQueries }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ queries: mockQueries }),
        })

      const { result } = renderHook(() => useCustomQueries())

      // Wait for initialization
      await waitFor(() => expect(result.current.loading).toBe(false))

      await waitFor(() => result.current.handleToggleEnabled('1', false))

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/custom-queries/1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ is_enabled: false }),
        })
      })
    })
  })
})
