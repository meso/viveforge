/**
 * QueryTester component
 * Handles testing custom SQL queries with parameters
 */

import type { CustomQuery, TestResult } from '../../types/custom-sql'

interface QueryTesterProps {
  selectedQuery: CustomQuery | null
  testParams: Record<string, unknown>
  testResult: TestResult | null
  testError: string | null
  testing: boolean
  onTestParamsChange: (params: Record<string, unknown>) => void
  onTest: () => void
}

export function QueryTester({
  selectedQuery,
  testParams,
  testResult,
  testError,
  testing,
  onTestParamsChange,
  onTest,
}: QueryTesterProps) {
  if (!selectedQuery) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900">Query Details</h3>
        <p className="text-gray-500 mt-4">Select a query to view details and test</p>
      </div>
    )
  }

  const handleParamChange = (paramName: string, value: string, type: string) => {
    let parsedValue: unknown = value

    // Convert value based on parameter type
    if (type === 'number') {
      parsedValue = value === '' ? undefined : Number(value)
    } else if (type === 'boolean') {
      parsedValue = value === 'true'
    } else if (type === 'date') {
      parsedValue = value === '' ? undefined : value
    }

    onTestParamsChange({
      ...testParams,
      [paramName]: parsedValue,
    })
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">{selectedQuery.name}</h3>
          {selectedQuery.description && (
            <p className="text-gray-600 mt-1">{selectedQuery.description}</p>
          )}
          <p className="text-sm text-gray-500 mt-2">
            Endpoint:{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded">
              {selectedQuery.method} /api/custom/{selectedQuery.slug}
            </code>
          </p>
        </div>

        {/* SQL Query */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">SQL Query</h4>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
            {selectedQuery.sql_query}
          </pre>
        </div>

        {/* Parameters */}
        {selectedQuery.parameters && selectedQuery.parameters.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Test Parameters</h4>
            <div className="space-y-3">
              {selectedQuery.parameters.map((param) => (
                <div key={param.name}>
                  <label
                    htmlFor={`param-${param.name}`}
                    className="block text-sm font-medium text-gray-700"
                  >
                    {param.name}
                    {param.required && <span className="text-red-500 ml-1">*</span>}
                    <span className="text-gray-500 ml-1">({param.type})</span>
                  </label>
                  {param.description && (
                    <p className="text-xs text-gray-500 mt-1">{param.description}</p>
                  )}
                  {param.type === 'boolean' ? (
                    <select
                      id={`param-${param.name}`}
                      value={String(testParams[param.name] ?? '')}
                      onChange={(e) =>
                        handleParamChange(
                          param.name,
                          (e.target as HTMLSelectElement).value,
                          param.type
                        )
                      }
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select...</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      id={`param-${param.name}`}
                      type={
                        param.type === 'number' ? 'number' : param.type === 'date' ? 'date' : 'text'
                      }
                      value={String(testParams[param.name] ?? '')}
                      onChange={(e) =>
                        handleParamChange(
                          param.name,
                          (e.target as HTMLInputElement).value,
                          param.type
                        )
                      }
                      placeholder={param.default ? `Default: ${param.default}` : ''}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Button */}
        <button
          type="button"
          onClick={onTest}
          disabled={testing}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Query'}
        </button>

        {/* Test Results */}
        {testError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <h4 className="font-medium">Test Error</h4>
            <p className="mt-1">{testError}</p>
          </div>
        )}

        {testResult && (
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <h4 className="font-medium text-green-800 mb-2">Test Results</h4>
            <div className="text-sm text-green-700 space-y-1">
              <p>Rows returned: {testResult.row_count}</p>
              <p>Execution time: {testResult.execution_time}ms</p>
            </div>
            {testResult.data && testResult.data.length > 0 && (
              <div className="mt-3">
                <h5 className="font-medium text-green-800 mb-2">Sample Data (first 5 rows)</h5>
                <div className="bg-white rounded border overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(testResult.data[0] as Record<string, unknown>).map((key) => (
                          <th key={key} className="px-3 py-2 text-left font-medium text-gray-700">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {testResult.data.slice(0, 5).map((row, index) => {
                        const rowData = row as Record<string, unknown>
                        const rowKey = Object.values(rowData).join('-') || `row-${index}`
                        return (
                          <tr key={rowKey}>
                            {Object.entries(rowData).map(([key, value]) => (
                              <td key={key} className="px-3 py-2 text-gray-900">
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
