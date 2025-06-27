/**
 * Custom queries hook - refactored to use useCRUD
 * Handles state management and API calls for custom SQL queries
 */

import { useState } from 'preact/hooks'
import type { ApiConfig } from '../types/common'
import type { CustomQuery, Parameter, QueryFormData, TestResult } from '../types/custom-sql'
import { validateForm } from '../utils/sql-utils'
import { useCRUD } from './useCRUD'

// API configuration for custom queries
const customQueriesApiConfig: ApiConfig = {
  baseUrl: window.location.origin,
  listEndpoint: '/api/custom-queries',
  getEndpoint: (id: string) => `/api/custom-queries/${id}`,
  createEndpoint: '/api/custom-queries',
  updateEndpoint: (id: string) => `/api/custom-queries/${id}`,
  deleteEndpoint: (id: string) => `/api/custom-queries/${id}`,
}

export function useCustomQueries() {
  // Use the generic CRUD hook for basic operations
  const crud = useCRUD<CustomQuery>({
    apiConfig: customQueriesApiConfig,
    validateFn: (data: Partial<CustomQuery>) => {
      // Convert CustomQuery partial to QueryFormData for validation
      const formData: QueryFormData = {
        slug: (data as Partial<QueryFormData>).slug || '',
        name: (data as Partial<QueryFormData>).name || '',
        description: (data as Partial<QueryFormData>).description || '',
        sql_query: (data as Partial<QueryFormData>).sql_query || '',
        parameters: (data as Partial<QueryFormData>).parameters || [],
        cache_ttl: (data as Partial<QueryFormData>).cache_ttl || 0,
        is_enabled: (data as Partial<QueryFormData>).is_enabled ?? false,
      }
      return validateForm(formData)
    },
    transformResponse: (response: unknown) =>
      (response as { queries?: CustomQuery[] }).queries || [],
    transformItem: (response: unknown) => {
      // Handle both { query: CustomQuery } and CustomQuery formats
      if (response && typeof response === 'object' && 'query' in response) {
        return (response as { query: CustomQuery }).query
      }
      return response as CustomQuery
    },
  })

  // Additional state specific to custom queries
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<QueryFormData>({
    slug: '',
    name: '',
    description: '',
    sql_query: '',
    parameters: [],
    cache_ttl: 0,
    is_enabled: false,
  })

  // Test execution state
  const [testParams, setTestParams] = useState<Record<string, unknown>>({})
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  // Custom create operation that handles form data
  const handleCreate = async (): Promise<void> => {
    try {
      const result = await crud.createItem(formData)
      if (result) {
        resetForm()
      }
    } finally {
      setIsCreating(false)
    }
  }

  // Custom update operation that handles form data
  const handleUpdate = async (): Promise<void> => {
    if (!crud.selectedItem) return

    try {
      const result = await crud.updateItem(crud.selectedItem.id, formData)
      if (result) {
        crud.setSelectedItem(null)
        resetForm()
      }
    } finally {
      setIsEditing(false)
    }
  }

  // Custom delete operation with confirmation
  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this query?')) return

    const success = await crud.deleteItem(id)
    if (success && crud.selectedItem?.id === id) {
      crud.setSelectedItem(null)
    }
  }

  // Test query execution
  const handleTest = async (): Promise<void> => {
    if (!crud.selectedItem) return

    setTesting(true)
    setTestResult(null)
    setTestError(null)

    try {
      const response = await fetch(`/api/custom-queries/${crud.selectedItem.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ parameters: testParams }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to test query' }))
        throw new Error(data.error || 'Failed to test query')
      }

      const data = await response.json()
      setTestResult(data)
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Failed to test query')
    } finally {
      setTesting(false)
    }
  }

  // Toggle enabled status
  const handleToggleEnabled = async (id: string, enabled: boolean): Promise<void> => {
    try {
      const response = await fetch(`/api/custom-queries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_enabled: enabled }),
      })

      if (!response.ok) throw new Error('Failed to toggle query')

      await crud.refreshData()
    } catch (err) {
      crud.setError(err instanceof Error ? err.message : 'Failed to toggle query')
    }
  }

  // Form helpers
  const resetForm = (): void => {
    setFormData({
      slug: '',
      name: '',
      description: '',
      sql_query: '',
      parameters: [],
      cache_ttl: 0,
      is_enabled: false,
    })
    crud.clearValidationErrors()
  }

  const loadQueryToForm = (query: CustomQuery): void => {
    // Safely parse parameters - handle both string and array formats
    let parameters: Parameter[] = []
    if (query.parameters) {
      if (typeof query.parameters === 'string') {
        try {
          parameters = JSON.parse(query.parameters)
        } catch {
          parameters = []
        }
      } else if (Array.isArray(query.parameters)) {
        parameters = query.parameters
      }
    }

    setFormData({
      slug: query.slug,
      name: query.name,
      description: query.description || '',
      sql_query: query.sql_query,
      parameters,
      cache_ttl: query.cache_ttl,
      is_enabled: query.is_enabled,
    })
    crud.clearValidationErrors()
  }

  return {
    // State from CRUD hook
    queries: crud.items,
    selectedQuery: crud.selectedItem,
    loading: crud.loading,
    error: crud.error,
    validationErrors: crud.validationErrors,

    // Custom state
    isCreating,
    isEditing,
    formData,
    testParams,
    testResult,
    testError,
    testing,

    // Setters from CRUD hook
    setSelectedQuery: crud.setSelectedItem,
    setError: crud.setError,
    setValidationErrors: crud.setValidationErrors,

    // Custom setters
    setIsCreating,
    setIsEditing,
    setFormData,
    setTestParams,
    setTestResult,
    setTestError,

    // Actions from CRUD hook (renamed for compatibility)
    fetchQueries: crud.refreshData,

    // Custom actions
    handleCreate,
    handleUpdate,
    handleDelete,
    handleTest,
    handleToggleEnabled,
    resetForm,
    loadQueryToForm,
  }
}
