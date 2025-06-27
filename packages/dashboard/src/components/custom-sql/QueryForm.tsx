/**
 * QueryForm component
 * Modal form for creating and editing custom SQL queries
 */

import type { Parameter, QueryFormData, ValidationErrors } from '../../types/custom-sql'
import {
  determineMethodAndReadonly,
  extractParametersFromSQL,
  generateSlugFromName,
} from '../../utils/sql-utils'

interface QueryFormProps {
  isCreating: boolean
  isEditing: boolean
  formData: QueryFormData
  validationErrors: ValidationErrors
  error: string | null
  onFormDataChange: (data: QueryFormData) => void
  onValidationErrorsChange: (errors: ValidationErrors) => void
  onCreate: () => void
  onUpdate: () => void
  onClose: () => void
}

export function QueryForm({
  isCreating,
  isEditing,
  formData,
  validationErrors,
  error,
  onFormDataChange,
  onValidationErrorsChange,
  onCreate,
  onUpdate,
  onClose,
}: QueryFormProps) {
  if (!isCreating && !isEditing) {
    return null
  }

  const addParameter = () => {
    onFormDataChange({
      ...formData,
      parameters: [...formData.parameters, { name: '', type: 'string', required: false }],
    })
  }

  const removeParameter = (index: number) => {
    onFormDataChange({
      ...formData,
      parameters: formData.parameters.filter((_, i) => i !== index),
    })
  }

  const updateParameter = (index: number, param: Partial<Parameter>) => {
    onFormDataChange({
      ...formData,
      parameters: formData.parameters.map((p, i) => (i === index ? { ...p, ...param } : p)),
    })

    // Clear validation error for this parameter name field
    if (param.name !== undefined) {
      const errorKey = `parameter_${index}_name`
      if (validationErrors[errorKey]) {
        const newErrors = { ...validationErrors }
        delete newErrors[errorKey]
        onValidationErrorsChange(newErrors)
      }
    }
  }

  const clearValidationError = (field: string) => {
    if (validationErrors[field]) {
      const newErrors = { ...validationErrors }
      delete newErrors[field]
      onValidationErrorsChange(newErrors)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {isCreating ? 'Create Custom Query' : 'Edit Custom Query'}
        </h3>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="query-name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="query-name"
              type="text"
              value={formData.name}
              onChange={(e) => {
                const newName = (e.target as HTMLInputElement).value
                onFormDataChange({
                  ...formData,
                  name: newName,
                  // Auto-generate slug when creating new query, but preserve manual changes when editing
                  slug: isCreating ? generateSlugFromName(newName) : formData.slug,
                })
                // Clear validation errors for name and slug (if slug is auto-generated)
                clearValidationError('name')
                if (isCreating) {
                  clearValidationError('slug')
                }
              }}
              className={`mt-1 w-full px-3 py-2 border rounded-md ${
                validationErrors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            />
            {validationErrors.name && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label htmlFor="query-slug" className="block text-sm font-medium text-gray-700">
                Slug
                <span className="text-xs text-gray-500">(auto-generated, but editable)</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  onFormDataChange({ ...formData, slug: generateSlugFromName(formData.name) })
                  clearValidationError('slug')
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Re-generate from name
              </button>
            </div>
            <input
              id="query-slug"
              type="text"
              value={formData.slug}
              onChange={(e) => {
                onFormDataChange({ ...formData, slug: (e.target as HTMLInputElement).value })
                clearValidationError('slug')
              }}
              placeholder="lowercase-with-hyphens"
              className={`mt-1 w-full px-3 py-2 border rounded-md ${
                validationErrors.slug ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            />
            {validationErrors.slug && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.slug}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              This will be the API endpoint: /api/custom/{formData.slug || 'a1b2c3d4'}
            </p>
          </div>

          <div>
            <label htmlFor="query-description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <input
              id="query-description"
              type="text"
              value={formData.description}
              onChange={(e) =>
                onFormDataChange({ ...formData, description: (e.target as HTMLInputElement).value })
              }
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="query-sql" className="block text-sm font-medium text-gray-700">
              SQL Query
            </label>
            <textarea
              id="query-sql"
              value={formData.sql_query}
              onChange={(e) => {
                const newSql = (e.target as HTMLTextAreaElement).value
                const extractedParams = extractParametersFromSQL(newSql)

                // Merge with existing parameters, preserving manual edits
                const existingParamNames = new Set(formData.parameters.map((p) => p.name))
                const newParams = [
                  ...formData.parameters.filter((p) => newSql.includes(`:${p.name}`)), // Keep params still used in SQL
                  ...extractedParams.filter((p) => !existingParamNames.has(p.name)), // Add new params
                ]

                onFormDataChange({
                  ...formData,
                  sql_query: newSql,
                  parameters: newParams,
                })
                clearValidationError('sql_query')
              }}
              rows={6}
              placeholder="SELECT * FROM users WHERE created_at > :start_date"
              className={`mt-1 w-full px-3 py-2 border rounded-md font-mono text-sm ${
                validationErrors.sql_query ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            />
            {validationErrors.sql_query && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.sql_query}</p>
            )}
            <div className="mt-2 flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Use :parameter_name for parameters (will be auto-detected)
              </p>
              {formData.sql_query && (
                <div className="flex gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      determineMethodAndReadonly(formData.sql_query).method === 'GET'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {determineMethodAndReadonly(formData.sql_query).method}
                  </span>
                  {determineMethodAndReadonly(formData.sql_query).readonly && (
                    <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                      Read-only
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="block text-sm font-medium text-gray-700">
                Parameters
                {(formData.parameters || []).length > 0 && (
                  <span className="text-xs text-gray-500 ml-1">
                    ({(formData.parameters || []).length} detected)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={addParameter}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                Add Parameter
              </button>
            </div>

            {(formData.parameters || []).length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded border-2 border-dashed border-gray-200">
                No parameters detected. Use :param_name in your SQL query to automatically add
                parameters here.
              </div>
            ) : (
              (formData.parameters || []).map((param, index) => (
                <div key={`param-${param.name}-${index}`} className="mb-3">
                  <div className="flex gap-2 mb-1">
                    <input
                      id={`param-name-${index}`}
                      type="text"
                      value={param.name}
                      onChange={(e) =>
                        updateParameter(index, { name: (e.target as HTMLInputElement).value })
                      }
                      placeholder="param_name"
                      className={`flex-1 px-3 py-1 border rounded-md text-sm ${
                        validationErrors[`parameter_${index}_name`]
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    />
                    <select
                      id={`param-type-${index}`}
                      value={param.type}
                      onChange={(e) =>
                        updateParameter(index, {
                          type: (e.target as HTMLSelectElement).value as Parameter['type'],
                        })
                      }
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="date">Date</option>
                    </select>
                    <label htmlFor={`param-required-${index}`} className="flex items-center">
                      <input
                        id={`param-required-${index}`}
                        type="checkbox"
                        checked={param.required}
                        onChange={(e) =>
                          updateParameter(index, {
                            required: (e.target as HTMLInputElement).checked,
                          })
                        }
                        className="mr-1"
                      />
                      <span className="text-sm">Required</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeParameter(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  {validationErrors[`parameter_${index}_name`] && (
                    <p className="text-xs text-red-600 ml-1">
                      {validationErrors[`parameter_${index}_name`]}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <div>
            <label htmlFor="query-cache-ttl" className="block text-sm font-medium text-gray-700">
              Cache TTL (seconds)
            </label>
            <input
              id="query-cache-ttl"
              type="number"
              value={formData.cache_ttl}
              onChange={(e) =>
                onFormDataChange({
                  ...formData,
                  cache_ttl: parseInt((e.target as HTMLInputElement).value) || 0,
                })
              }
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="query-enabled" className="flex items-center">
              <input
                id="query-enabled"
                type="checkbox"
                checked={formData.is_enabled}
                onChange={(e) =>
                  onFormDataChange({ ...formData, is_enabled: (e.target as HTMLInputElement).checked })
                }
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Enabled</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={isCreating ? onCreate : onUpdate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {isCreating ? 'Create' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  )
}
