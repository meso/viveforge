/**
 * QueryList component
 * Displays and manages the list of custom SQL queries
 */

import type { CustomQuery } from '../../types/custom-sql'

interface QueryListProps {
  queries: CustomQuery[]
  selectedQuery: CustomQuery | null
  onSelectQuery: (query: CustomQuery) => void
  onEditClick: (query: CustomQuery) => void
  onDeleteClick: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
  onCreateClick: () => void
}

export function QueryList({
  queries,
  selectedQuery,
  onSelectQuery,
  onEditClick,
  onDeleteClick,
  onToggleEnabled,
  onCreateClick,
}: QueryListProps) {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Queries</h3>
        <button
          type="button"
          onClick={onCreateClick}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Create Query
        </button>
      </div>

      <div className="space-y-2">
        {queries.length === 0 ? (
          <p className="text-gray-500">No custom queries yet</p>
        ) : (
          queries.map((query) => (
            <button
              type="button"
              key={query.id}
              className={`text-left w-full p-3 border rounded hover:bg-gray-50 ${
                selectedQuery?.id === query.id
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200'
              }`}
              onClick={() => {
                // Parse parameters if they're stored as JSON string
                const parsedQuery = {
                  ...query,
                  parameters:
                    typeof query.parameters === 'string'
                      ? JSON.parse(query.parameters || '[]')
                      : query.parameters || [],
                }
                onSelectQuery(parsedQuery)
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900">{query.name}</h4>
                  <p className="text-sm text-gray-500">/{query.slug}</p>
                  <div className="flex gap-2 mt-1">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        query.method === 'GET'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {query.method}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        query.is_enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {query.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    {query.is_readonly && (
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                        Read-only
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleEnabled(query.id, !query.is_enabled)
                    }}
                    className={
                      query.is_enabled
                        ? 'text-orange-600 hover:text-orange-800'
                        : 'text-green-600 hover:text-green-800'
                    }
                  >
                    {query.is_enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditClick(query)
                    }}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteClick(query.id)
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
