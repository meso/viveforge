/**
 * Generic CRUD hook for consistent data management
 * Provides standardized create, read, update, delete operations with loading states and error handling
 */

import { useEffect, useState } from 'preact/hooks'
import type { ApiConfig, BaseResource, LoadingStates, ValidationErrors } from '../types/common'

export interface CRUDOptions<T extends BaseResource> {
  apiConfig: ApiConfig
  initialData?: T[]
  autoFetch?: boolean
  validateFn?: (data: Partial<T>) => ValidationErrors
  transformResponse?: (response: unknown) => T[]
  transformItem?: (response: unknown) => T
}

export interface CRUDState<T extends BaseResource> extends LoadingStates {
  items: T[]
  selectedItem: T | null
  error: string | null
  validationErrors: ValidationErrors
}

export interface CRUDActions<T extends BaseResource> {
  // Data operations
  fetchItems: () => Promise<void>
  createItem: (data: Partial<T>) => Promise<T | null>
  updateItem: (id: string, data: Partial<T>) => Promise<T | null>
  deleteItem: (id: string) => Promise<boolean>

  // State management
  setSelectedItem: (item: T | null) => void
  setError: (error: string | null) => void
  clearValidationErrors: () => void
  setValidationErrors: (errors: ValidationErrors) => void

  // Utility actions
  refreshData: () => Promise<void>
  getItemById: (id: string) => T | undefined
}

export function useCRUD<T extends BaseResource>(
  options: CRUDOptions<T>
): CRUDState<T> & CRUDActions<T> {
  const {
    apiConfig,
    initialData = [],
    autoFetch = true,
    validateFn,
    transformResponse = (response: unknown) => (response as { data?: T[] }).data || [],
    transformItem = (response: unknown) => (response as { data?: T }).data || (response as T),
  } = options

  // State management
  const [state, setState] = useState<CRUDState<T>>({
    items: initialData,
    selectedItem: null,
    loading: false,
    creating: false,
    updating: false,
    deleting: false,
    error: null,
    validationErrors: {},
  })

  // Initialize on mount
  useEffect(() => {
    if (autoFetch) {
      fetchItems()
    }
  }, [autoFetch])

  // Helper function for API calls
  const makeApiCall = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const defaultOptions: RequestInit = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    const response = await fetch(url, defaultOptions)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`)
    }

    return response
  }

  // Data operations
  const fetchItems = async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const response = await makeApiCall(apiConfig.listEndpoint)
      const data = await response.json()
      const items = transformResponse(data)

      setState((prev) => ({
        ...prev,
        items,
        loading: false,
      }))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch items'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
    }
  }

  const createItem = async (data: Partial<T>): Promise<T | null> => {
    // Clear previous errors
    setState((prev) => ({ ...prev, error: null, validationErrors: {} }))

    // Validate if validation function provided
    if (validateFn) {
      const errors = validateFn(data)
      if (Object.keys(errors).length > 0) {
        setState((prev) => ({ ...prev, validationErrors: errors }))
        return null
      }
    }

    setState((prev) => ({ ...prev, creating: true }))

    try {
      const response = await makeApiCall(apiConfig.createEndpoint, {
        method: 'POST',
        body: JSON.stringify(data),
      })

      const responseData = await response.json()
      const newItem = transformItem(responseData)

      setState((prev) => ({
        ...prev,
        items: [...prev.items, newItem],
        creating: false,
      }))

      return newItem
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create item'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        creating: false,
      }))
      return null
    }
  }

  const updateItem = async (id: string, data: Partial<T>): Promise<T | null> => {
    // Clear previous errors
    setState((prev) => ({ ...prev, error: null, validationErrors: {} }))

    // Validate if validation function provided
    if (validateFn) {
      const errors = validateFn(data)
      if (Object.keys(errors).length > 0) {
        setState((prev) => ({ ...prev, validationErrors: errors }))
        return null
      }
    }

    setState((prev) => ({ ...prev, updating: true }))

    try {
      const response = await makeApiCall(apiConfig.updateEndpoint(id), {
        method: 'PUT',
        body: JSON.stringify(data),
      })

      const responseData = await response.json()
      const updatedItem = transformItem(responseData)

      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === id ? updatedItem : item)),
        selectedItem: prev.selectedItem?.id === id ? updatedItem : prev.selectedItem,
        updating: false,
      }))

      return updatedItem
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        updating: false,
      }))
      return null
    }
  }

  const deleteItem = async (id: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, deleting: true, error: null }))

    try {
      await makeApiCall(apiConfig.deleteEndpoint(id), {
        method: 'DELETE',
      })

      setState((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== id),
        selectedItem: prev.selectedItem?.id === id ? null : prev.selectedItem,
        deleting: false,
      }))

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete item'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        deleting: false,
      }))
      return false
    }
  }

  // State management actions
  const setSelectedItem = (item: T | null): void => {
    setState((prev) => ({ ...prev, selectedItem: item }))
  }

  const setError = (error: string | null): void => {
    setState((prev) => ({ ...prev, error }))
  }

  const clearValidationErrors = (): void => {
    setState((prev) => ({ ...prev, validationErrors: {} }))
  }

  const setValidationErrors = (validationErrors: ValidationErrors): void => {
    setState((prev) => ({ ...prev, validationErrors }))
  }

  // Utility actions
  const refreshData = async (): Promise<void> => {
    await fetchItems()
  }

  const getItemById = (id: string): T | undefined => {
    return state.items.find((item) => item.id === id)
  }

  return {
    // State
    ...state,

    // Actions
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    setSelectedItem,
    setError,
    clearValidationErrors,
    setValidationErrors,
    refreshData,
    getItemById,
  }
}
