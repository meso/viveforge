/**
 * Tests for useCRUD hook
 */

import { renderHook, waitFor } from '@testing-library/preact'
import type { ApiConfig, BaseResource, ValidationErrors } from '../../types/common'
import { useCRUD } from '../useCRUD'

// Test types
interface TestItem extends BaseResource {
  name: string
  description?: string
}

// Mock API configuration
const mockApiConfig: ApiConfig = {
  baseUrl: 'http://localhost:3000',
  listEndpoint: '/api/test-items',
  getEndpoint: (id: string) => `/api/test-items/${id}`,
  createEndpoint: '/api/test-items',
  updateEndpoint: (id: string) => `/api/test-items/${id}`,
  deleteEndpoint: (id: string) => `/api/test-items/${id}`,
}

// Mock validation function
const mockValidation = (data: Partial<TestItem>): ValidationErrors => {
  const errors: ValidationErrors = {}
  if (!data.name?.trim()) {
    errors.name = 'Name is required'
  }
  return errors
}

// Mock data
const mockItems: TestItem[] = [
  {
    id: '1',
    name: 'Test Item 1',
    description: 'First test item',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Test Item 2',
    description: 'Second test item',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
]

describe('useCRUD', () => {
  beforeEach(() => {
    // Reset fetch mock
    vi.clearAllMocks()

    // Default successful response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockItems }),
    })
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          autoFetch: false,
        })
      )

      expect(result.current.items).toEqual([])
      expect(result.current.selectedItem).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.creating).toBe(false)
      expect(result.current.updating).toBe(false)
      expect(result.current.deleting).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.validationErrors).toEqual({})
    })

    it('should initialize with provided initial data', () => {
      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          initialData: mockItems,
          autoFetch: false,
        })
      )

      expect(result.current.items).toEqual(mockItems)
    })

    it('should auto-fetch data on mount when autoFetch is true', async () => {
      renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          autoFetch: true,
        })
      )

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/test-items', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      })
    })
  })

  describe('fetchItems', () => {
    it('should fetch items successfully', async () => {
      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          autoFetch: false,
        })
      )

      await waitFor(() => result.current.fetchItems())

      await waitFor(() => {
        expect(result.current.items).toEqual(mockItems)
        expect(result.current.loading).toBe(false)
        expect(result.current.error).toBeNull()
      })
    })

    it('should handle fetch errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          autoFetch: false,
        })
      )

      await waitFor(() => result.current.fetchItems())

      await waitFor(() => {
        expect(result.current.error).toBe('Network error')
        expect(result.current.loading).toBe(false)
      })
    })

    it('should handle API error responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      })

      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          autoFetch: false,
        })
      )

      await waitFor(() => result.current.fetchItems())

      await waitFor(() => {
        expect(result.current.error).toBe('Not found')
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('createItem', () => {
    it('should create item successfully', async () => {
      const newItem: TestItem = {
        id: '3',
        name: 'New Item',
        description: 'A new test item',
        created_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: newItem }),
      })

      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          initialData: mockItems,
          autoFetch: false,
        })
      )

      const createdItem = await waitFor(() =>
        result.current.createItem({ name: 'New Item', description: 'A new test item' })
      )

      await waitFor(() => {
        expect(createdItem).toEqual(newItem)
        expect(result.current.items).toHaveLength(3)
        expect(result.current.items[2]).toEqual(newItem)
        expect(result.current.creating).toBe(false)
      })
    })

    it('should handle validation errors', async () => {
      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          autoFetch: false,
          validateFn: mockValidation,
        })
      )

      const createdItem = await waitFor(() => result.current.createItem({ name: '' }))

      await waitFor(() => {
        expect(createdItem).toBeNull()
        expect(result.current.validationErrors.name).toBe('Name is required')
        expect(fetch).not.toHaveBeenCalled()
      })
    })

    it('should handle create errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Create failed'))

      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          autoFetch: false,
        })
      )

      const createdItem = await waitFor(() => result.current.createItem({ name: 'New Item' }))

      await waitFor(() => {
        expect(createdItem).toBeNull()
        expect(result.current.error).toBe('Create failed')
        expect(result.current.creating).toBe(false)
      })
    })
  })

  describe('updateItem', () => {
    it('should update item successfully', async () => {
      const updatedItem: TestItem = {
        ...mockItems[0],
        name: 'Updated Item',
        updated_at: '2024-01-04T00:00:00Z',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: updatedItem }),
      })

      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          initialData: mockItems,
          autoFetch: false,
        })
      )

      const updated = await waitFor(() => result.current.updateItem('1', { name: 'Updated Item' }))

      await waitFor(() => {
        expect(updated).toEqual(updatedItem)
        expect(result.current.items[0]).toEqual(updatedItem)
        expect(result.current.updating).toBe(false)
      })
    })

    it('should update selected item if it matches', async () => {
      const updatedItem: TestItem = {
        ...mockItems[0],
        name: 'Updated Item',
        updated_at: '2024-01-04T00:00:00Z',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: updatedItem }),
      })

      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          initialData: mockItems,
          autoFetch: false,
        })
      )

      // Set selected item
      result.current.setSelectedItem(mockItems[0])

      await waitFor(() => result.current.updateItem('1', { name: 'Updated Item' }))

      await waitFor(() => {
        expect(result.current.selectedItem).toEqual(updatedItem)
      })
    })
  })

  describe('deleteItem', () => {
    it('should delete item successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          initialData: mockItems,
          autoFetch: false,
        })
      )

      const deleted = await waitFor(() => result.current.deleteItem('1'))

      await waitFor(() => {
        expect(deleted).toBe(true)
        expect(result.current.items).toHaveLength(1)
        expect(result.current.items[0].id).toBe('2')
        expect(result.current.deleting).toBe(false)
      })
    })

    it('should clear selected item if it matches deleted item', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          initialData: mockItems,
          autoFetch: false,
        })
      )

      // Set selected item
      result.current.setSelectedItem(mockItems[0])

      await waitFor(() => result.current.deleteItem('1'))

      await waitFor(() => {
        expect(result.current.selectedItem).toBeNull()
      })
    })
  })

  describe('utility functions', () => {
    it('should get item by id', () => {
      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          initialData: mockItems,
          autoFetch: false,
        })
      )

      const item = result.current.getItemById('1')
      expect(item).toEqual(mockItems[0])

      const nonExistent = result.current.getItemById('999')
      expect(nonExistent).toBeUndefined()
    })

    it('should set and clear validation errors', async () => {
      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          autoFetch: false,
        })
      )

      const errors = { name: 'Required field' }
      result.current.setValidationErrors(errors)

      await waitFor(() => {
        expect(result.current.validationErrors).toEqual(errors)
      })

      result.current.clearValidationErrors()

      await waitFor(() => {
        expect(result.current.validationErrors).toEqual({})
      })
    })

    it('should set and clear error', async () => {
      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          autoFetch: false,
        })
      )

      result.current.setError('Test error')

      await waitFor(() => {
        expect(result.current.error).toBe('Test error')
      })

      result.current.setError(null)

      await waitFor(() => {
        expect(result.current.error).toBeNull()
      })
    })

    it('should set selected item', async () => {
      const { result } = renderHook(() =>
        useCRUD<TestItem>({
          apiConfig: mockApiConfig,
          initialData: mockItems,
          autoFetch: false,
        })
      )

      result.current.setSelectedItem(mockItems[0])

      await waitFor(() => {
        expect(result.current.selectedItem).toEqual(mockItems[0])
      })

      result.current.setSelectedItem(null)

      await waitFor(() => {
        expect(result.current.selectedItem).toBeNull()
      })
    })
  })
})
