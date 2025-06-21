import { useState, useEffect } from 'preact/hooks'

interface Parameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date'
  required: boolean
  description?: string
  default?: string | number | boolean
}

interface CustomQuery {
  id: string
  slug: string
  name: string
  description?: string
  sql_query: string
  parameters: Parameter[]
  method: 'GET' | 'POST'
  is_readonly: boolean
  cache_ttl: number
  enabled: boolean
  created_at: string
  updated_at: string
}

export function CustomSQL() {
  const [queries, setQueries] = useState<CustomQuery[]>([])
  const [selectedQuery, setSelectedQuery] = useState<CustomQuery | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    description: '',
    sql_query: '',
    parameters: [] as Parameter[],
    cache_ttl: 0,
    enabled: true
  })

  // Auto-generate slug from name (proven algorithm)
  const generateSlugFromName = (name: string): string => {
    if (!name.trim()) {
      return Date.now().toString(36).slice(-8).padStart(8, '0')
    }

    // Create a seed based on the string content and length
    let seed = name.length + 1000 // Add offset to avoid small numbers
    
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i)
      seed = seed * 31 + char  // Classic polynomial rolling hash
      seed = seed & 0x7fffffff  // Keep positive
    }
    
    // Generate 8 characters using a simple PRNG approach
    let result = ''
    let rng = seed
    
    for (let i = 0; i < 8; i++) {
      // Linear congruential generator
      rng = (rng * 1664525 + 1013904223) & 0x7fffffff
      const digit = rng % 36
      result += digit.toString(36)
    }
    
    return result
  }

  // Extract parameters from SQL query
  const extractParametersFromSQL = (sql: string): Parameter[] => {
    const paramRegex = /:(\w+)/g
    const matches = new Set<string>()
    let match
    
    while ((match = paramRegex.exec(sql)) !== null) {
      matches.add(match[1])
    }
    
    return Array.from(matches).map(paramName => ({
      name: paramName,
      type: 'string' as const,
      required: true,
      description: ''
    }))
  }

  // Determine HTTP method and readonly status based on SQL
  const determineMethodAndReadonly = (sql: string) => {
    const trimmedSql = sql.trim().toLowerCase()
    const isSelect = trimmedSql.startsWith('select')
    const isPragma = trimmedSql.includes('pragma')
    
    return {
      method: isSelect ? 'GET' : 'POST',
      readonly: isSelect || isPragma
    }
  }

  // Test execution state
  const [testParams, setTestParams] = useState<Record<string, unknown>>({})
  const [testResult, setTestResult] = useState<{
    data: unknown[]
    row_count: number
    execution_time: number
  } | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    fetchQueries()
  }, [])

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
    try {
      const res = await fetch('/api/custom-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create query')
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
    
    try {
      const res = await fetch(`/api/custom-queries/${selectedQuery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update query')
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
        method: 'DELETE'
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
        body: JSON.stringify({ parameters: testParams })
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

  const resetForm = () => {
    setFormData({
      slug: '',
      name: '',
      description: '',
      sql_query: '',
      parameters: [],
      cache_ttl: 0,
      enabled: true
    })
  }

  const addParameter = () => {
    setFormData({
      ...formData,
      parameters: [
        ...formData.parameters,
        { name: '', type: 'string', required: false }
      ]
    })
  }

  const removeParameter = (index: number) => {
    setFormData({
      ...formData,
      parameters: formData.parameters.filter((_, i) => i !== index)
    })
  }

  const updateParameter = (index: number, param: Partial<Parameter>) => {
    setFormData({
      ...formData,
      parameters: formData.parameters.map((p, i) => 
        i === index ? { ...p, ...param } : p
      )
    })
  }

  if (loading) {
    return (
      <div class="flex justify-center items-center h-64">
        <div class="text-gray-500">Loading custom queries...</div>
      </div>
    )
  }

  return (
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-bold text-gray-900">Custom SQL APIs</h2>
          <button
            onClick={() => setIsCreating(true)}
            class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Create Query
          </button>
        </div>

        {error && (
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Query List */}
          <div class="bg-white shadow rounded-lg p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Queries</h3>
            <div class="space-y-2">
              {queries.length === 0 ? (
                <p class="text-gray-500">No custom queries yet</p>
              ) : (
                queries.map(query => (
                  <div
                    key={query.id}
                    class={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                      selectedQuery?.id === query.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                    }`}
                    onClick={() => {
                      // Parse parameters if they're stored as JSON string
                      const parsedQuery = {
                        ...query,
                        parameters: typeof query.parameters === 'string' 
                          ? JSON.parse(query.parameters || '[]') 
                          : (query.parameters || [])
                      }
                      setSelectedQuery(parsedQuery)
                      setTestParams({})
                      setTestResult(null)
                      setTestError(null)
                    }}
                  >
                    <div class="flex justify-between items-start">
                      <div>
                        <h4 class="font-medium text-gray-900">{query.name}</h4>
                        <p class="text-sm text-gray-500">/{query.slug}</p>
                        <div class="flex gap-2 mt-1">
                          <span class={`text-xs px-2 py-1 rounded ${
                            query.method === 'GET' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {query.method}
                          </span>
                          <span class={`text-xs px-2 py-1 rounded ${
                            query.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {query.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                          {query.is_readonly && (
                            <span class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                              Read-only
                            </span>
                          )}
                        </div>
                      </div>
                      <div class="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedQuery(query)
                            setFormData({
                              slug: query.slug,
                              name: query.name,
                              description: query.description || '',
                              sql_query: query.sql_query,
                              parameters: query.parameters || [],
                              cache_ttl: query.cache_ttl,
                              enabled: Boolean(query.enabled)
                            })
                            setIsEditing(true)
                          }}
                          class="text-indigo-600 hover:text-indigo-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(query.id)
                          }}
                          class="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Query Details / Test */}
          <div class="bg-white shadow rounded-lg p-6">
            {selectedQuery ? (
              <div class="space-y-4">
                <div>
                  <h3 class="text-lg font-medium text-gray-900">{selectedQuery.name}</h3>
                  {selectedQuery.description && (
                    <p class="text-gray-600 mt-1">{selectedQuery.description}</p>
                  )}
                  <p class="text-sm text-gray-500 mt-2">
                    Endpoint: <code class="bg-gray-100 px-1 py-0.5 rounded">
                      {selectedQuery.method} /api/custom/{selectedQuery.slug}
                    </code>
                  </p>
                </div>

                <div>
                  <h4 class="font-medium text-gray-900 mb-2">SQL Query</h4>
                  <pre class="bg-gray-50 p-3 rounded text-sm overflow-x-auto">
                    {selectedQuery.sql_query}
                  </pre>
                </div>

                {selectedQuery.parameters && Array.isArray(selectedQuery.parameters) && selectedQuery.parameters.length > 0 && (
                  <div>
                    <h4 class="font-medium text-gray-900 mb-2">Parameters</h4>
                    <div class="space-y-2">
                      {selectedQuery.parameters.map((param) => (
                        <div key={param.name} class="flex items-center gap-2">
                          <label class="text-sm font-medium text-gray-700 w-32">
                            {param.name}
                            {param.required && <span class="text-red-500">*</span>}
                          </label>
                          <input
                            type={param.type === 'number' ? 'number' : 'text'}
                            value={(testParams[param.name] as string) || ''}
                            onChange={(e) => setTestParams({
                              ...testParams,
                              [param.name]: e.currentTarget.value
                            })}
                            placeholder={param.default ? `Default: ${param.default}` : ''}
                            class="flex-1 px-3 py-1 border border-gray-300 rounded-md"
                          />
                          <span class="text-xs text-gray-500">{param.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleTest}
                  disabled={testing}
                  class="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {testing ? 'Testing...' : 'Test Query'}
                </button>

                {testError && (
                  <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {testError}
                  </div>
                )}

                {testResult && (
                  <div>
                    <h4 class="font-medium text-gray-900 mb-2">Test Results</h4>
                    <div class="text-sm text-gray-600 mb-2">
                      Rows: {testResult.row_count} | Time: {testResult.execution_time}ms
                    </div>
                    <div class="bg-gray-50 p-3 rounded overflow-x-auto">
                      <pre class="text-sm">
                        {JSON.stringify(testResult.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div class="text-center text-gray-500">
                Select a query to view details
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Modal */}
        {(isCreating || isEditing) && (
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">
                {isCreating ? 'Create Custom Query' : 'Edit Custom Query'}
              </h3>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      const newName = e.currentTarget.value
                      setFormData({ 
                        ...formData, 
                        name: newName,
                        // Auto-generate slug when creating new query, but preserve manual changes when editing
                        slug: isCreating ? generateSlugFromName(newName) : formData.slug
                      })
                    }}
                    class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <div class="flex justify-between items-center">
                    <label class="block text-sm font-medium text-gray-700">
                      Slug 
                      <span class="text-xs text-gray-500">(auto-generated, but editable)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, slug: generateSlugFromName(formData.name) })}
                      class="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Re-generate from name
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.currentTarget.value })}
                    placeholder="lowercase-with-hyphens"
                    class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <p class="mt-1 text-sm text-gray-500">
                    This will be the API endpoint: /api/custom/{formData.slug || 'a1b2c3d4'}
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
                    class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">SQL Query</label>
                  <textarea
                    value={formData.sql_query}
                    onChange={(e) => {
                      const newSql = e.currentTarget.value
                      const extractedParams = extractParametersFromSQL(newSql)
                      
                      // Merge with existing parameters, preserving manual edits
                      const existingParamNames = new Set(formData.parameters.map(p => p.name))
                      const newParams = [
                        ...formData.parameters.filter(p => newSql.includes(`:${p.name}`)), // Keep params still used in SQL
                        ...extractedParams.filter(p => !existingParamNames.has(p.name)) // Add new params
                      ]
                      
                      setFormData({ 
                        ...formData, 
                        sql_query: newSql,
                        parameters: newParams
                      })
                    }}
                    rows={6}
                    placeholder="SELECT * FROM users WHERE created_at > :start_date"
                    class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                  />
                  <div class="mt-2 flex justify-between items-center">
                    <p class="text-sm text-gray-500">
                      Use :parameter_name for parameters (will be auto-detected)
                    </p>
                    {formData.sql_query && (
                      <div class="flex gap-2">
                        <span class={`px-2 py-1 rounded text-xs ${ 
                          determineMethodAndReadonly(formData.sql_query).method === 'GET' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {determineMethodAndReadonly(formData.sql_query).method}
                        </span>
                        {determineMethodAndReadonly(formData.sql_query).readonly && (
                          <span class="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                            Read-only
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div class="flex justify-between items-center mb-2">
                    <label class="block text-sm font-medium text-gray-700">
                      Parameters 
                      {formData.parameters.length > 0 && (
                        <span class="text-xs text-gray-500 ml-1">({formData.parameters.length} detected)</span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={addParameter}
                      class="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Add Parameter
                    </button>
                  </div>
                  
                  {formData.parameters.length === 0 ? (
                    <div class="text-sm text-gray-500 bg-gray-50 p-3 rounded border-2 border-dashed border-gray-200">
                      No parameters detected. Use :param_name in your SQL query to automatically add parameters here.
                    </div>
                  ) : (
                    formData.parameters.map((param, index) => (
                    <div key={index} class="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={param.name}
                        onChange={(e) => updateParameter(index, { name: e.currentTarget.value })}
                        placeholder="param_name"
                        class="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
                      />
                      <select
                        value={param.type}
                        onChange={(e) => updateParameter(index, { type: e.currentTarget.value as Parameter['type'] })}
                        class="px-3 py-1 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="date">Date</option>
                      </select>
                      <label class="flex items-center">
                        <input
                          type="checkbox"
                          checked={param.required}
                          onChange={(e) => updateParameter(index, { required: e.currentTarget.checked })}
                          class="mr-1"
                        />
                        <span class="text-sm">Required</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeParameter(index)}
                        class="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  )))}
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">Cache TTL (seconds)</label>
                  <input
                    type="number"
                    value={formData.cache_ttl}
                    onChange={(e) => setFormData({ ...formData, cache_ttl: parseInt(e.currentTarget.value) || 0 })}
                    class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label class="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.currentTarget.checked })}
                      class="mr-2"
                    />
                    <span class="text-sm font-medium text-gray-700">Enabled</span>
                  </label>
                </div>
              </div>

              <div class="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => {
                    setIsCreating(false)
                    setIsEditing(false)
                    resetForm()
                  }}
                  class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={isCreating ? handleCreate : handleUpdate}
                  class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  {isCreating ? 'Create' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  )
}