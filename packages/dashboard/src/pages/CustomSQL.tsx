/**
 * CustomSQL page component
 * Main page for managing custom SQL queries
 */

import { QueryForm } from '../components/custom-sql/QueryForm'
import { QueryList } from '../components/custom-sql/QueryList'
import { QueryTester } from '../components/custom-sql/QueryTester'
import { useCustomQueries } from '../hooks/useCustomQueries'
import type { CustomQuery } from '../types/custom-sql'

export function CustomSQL() {
  const {
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
  } = useCustomQueries()

  // Handle query selection
  const handleSelectQuery = (query: CustomQuery) => {
    setSelectedQuery(query)
    setTestParams({})
    setTestResult(null)
    setTestError(null)
  }

  // Handle edit click
  const handleEditClick = (query: CustomQuery) => {
    setSelectedQuery(query)
    loadQueryToForm(query)
    setIsEditing(true)
  }

  // Handle create click
  const handleCreateClick = () => {
    resetForm()
    setIsCreating(true)
  }

  // Handle close form
  const handleCloseForm = () => {
    setIsCreating(false)
    setIsEditing(false)
    resetForm()
    setError(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Custom SQL Queries</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create and manage custom SQL queries with secure parameter handling and caching
          </p>
        </div>

        {/* Global error display */}
        {error && !isCreating && !isEditing && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Query List */}
          <QueryList
            queries={queries}
            selectedQuery={selectedQuery}
            onSelectQuery={handleSelectQuery}
            onEditClick={handleEditClick}
            onDeleteClick={handleDelete}
            onToggleEnabled={handleToggleEnabled}
            onCreateClick={handleCreateClick}
          />

          {/* Query Tester */}
          <QueryTester
            selectedQuery={selectedQuery}
            testParams={testParams}
            testResult={testResult}
            testError={testError}
            testing={testing}
            onTestParamsChange={setTestParams}
            onTest={handleTest}
          />
        </div>

        {/* Query Form Modal */}
        <QueryForm
          isCreating={isCreating}
          isEditing={isEditing}
          formData={formData}
          validationErrors={validationErrors}
          error={error}
          onFormDataChange={setFormData}
          onValidationErrorsChange={setValidationErrors}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onClose={handleCloseForm}
        />
      </div>
    </div>
  )
}
