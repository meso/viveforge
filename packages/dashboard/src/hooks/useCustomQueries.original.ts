/**
 * Custom queries hook
 * Handles state management and API calls for custom SQL queries
 */

import { useEffect, useState } from 'preact/hooks'
import type { CustomQuery, QueryFormData, TestResult, ValidationErrors } from '../types/custom-sql'
import { validateForm } from '../utils/sql-utils'

export function useCustomQueries() {
  // State management
  const [queries, setQueries] = useState<CustomQuery[]>([])
  const [selectedQuery, setSelectedQuery] = useState<CustomQuery | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  // Form state
  const [formData, setFormData] = useState<QueryFormData>({
    slug: '',
    name: '',
    description: '',
    sql_query: '',
    parameters: [],
    cache_ttl: 0,
    enabled: true,
  })

  // Test execution state
  const [testParams, setTestParams] = useState<Record<string, unknown>>({})
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  // Initialize on component mount
  useEffect(() => {
    fetchQueries()
  }, [])

  // API calls
  const fetchQueries = async () => {
    try {
      const res = await fetch('/api/custom-queries')
      if (!res.ok) throw new Error('Failed to fetch queries')
      const data = await res.json()
      setQueries(data.queries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch queries')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    // Clear previous errors
    setError(null)
    setValidationErrors({})

    // Validate form
    const errors = validateForm(formData)
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }

    try {
      const res = await fetch('/api/custom-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        const errorMessage = data.error || 'Failed to create query'

        // Handle specific validation errors from server
        if (errorMessage.includes('slug already exists')) {
          setValidationErrors({ slug: 'このスラッグは既に使用されています' })
          return
        }

        throw new Error(errorMessage)
      }

      await fetchQueries()
      setIsCreating(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create query')
    }
  }

  const handleUpdate = async () => {
    if (!selectedQuery) return

    // Clear previous errors
    setError(null)
    setValidationErrors({})

    // Validate form
    const errors = validateForm(formData)
    setValidationErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }

    try {
      const res = await fetch(`/api/custom-queries/${selectedQuery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        const errorMessage = data.error || 'Failed to update query'

        // Handle specific validation errors from server
        if (errorMessage.includes('slug already exists')) {
          setValidationErrors({ slug: 'このスラッグは既に使用されています' })
          return
        }

        throw new Error(errorMessage)
      }

      await fetchQueries()
      setIsEditing(false)
      setSelectedQuery(null)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update query')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this query?')) return

    try {
      const res = await fetch(`/api/custom-queries/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete query')

      await fetchQueries()
      if (selectedQuery?.id === id) {
        setSelectedQuery(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete query')
    }
  }

  const handleTest = async () => {
    if (!selectedQuery) return

    setTesting(true)
    setTestResult(null)
    setTestError(null)

    try {
      const res = await fetch(`/api/custom-queries/${selectedQuery.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: testParams }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to test query')
      }

      setTestResult(data)
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Failed to test query')
    } finally {
      setTesting(false)
    }
  }

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/custom-queries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })

      if (!res.ok) throw new Error('Failed to toggle query')

      await fetchQueries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle query')
    }
  }

  // Form helpers
  const resetForm = () => {
    setFormData({
      slug: '',
      name: '',
      description: '',
      sql_query: '',
      parameters: [],
      cache_ttl: 0,
      enabled: true,
    })
    setValidationErrors({})
  }

  const loadQueryToForm = (query: CustomQuery) => {
    setFormData({
      slug: query.slug,
      name: query.name,
      description: query.description || '',
      sql_query: query.sql_query,
      parameters: query.parameters,
      cache_ttl: query.cache_ttl,
      enabled: query.enabled,
    })
    setValidationErrors({})
  }

  return {
    // State
    queries,
    selectedQuery,
    isCreating,
    isEditing,
    loading,
    error,
    validationErrors,
    formData,
    testParams,
    testResult,
    testError,
    testing,

    // Setters
    setSelectedQuery,
    setIsCreating,
    setIsEditing,
    setError,
    setFormData,
    setTestParams,
    setTestResult,
    setTestError,
    setValidationErrors,

    // Actions
    handleCreate,
    handleUpdate,
    handleDelete,
    handleTest,
    handleToggleEnabled,
    resetForm,
    loadQueryToForm,
    fetchQueries,
  }
}
