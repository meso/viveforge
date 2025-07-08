import { useState } from 'preact/hooks'
import { type NewTableColumn, useTableOperations } from '../../hooks/useTableOperations'
import type { ColumnInfo, ForeignKeyInfo, IndexInfo, TableInfo } from '../../lib/api'
import { generateIndexName, getSQLTypes, getUserTables, isSystemTable } from '../../utils/database'

interface SchemaEditorProps {
  tableName: string | null
  tableColumns: ColumnInfo[]
  tableForeignKeys: ForeignKeyInfo[]
  tables: TableInfo[]
  onSchemaChange: () => void // Callback when schema is modified
  loading: boolean
}

export function SchemaEditor({
  tableName,
  tableColumns,
  tableForeignKeys,
  tables,
  onSchemaChange,
  loading,
}: SchemaEditorProps) {
  const [showSchemaEditor, setShowSchemaEditor] = useState(false)
  const [showIndexManager, setShowIndexManager] = useState(false)
  const [newColumn, setNewColumn] = useState<NewTableColumn>({
    name: '',
    type: 'TEXT',
    notNull: false,
    foreignKey: { enabled: false, table: '', column: '' },
  })
  const [newIndex, setNewIndex] = useState({
    name: '',
    columns: [''] as string[],
    unique: false,
  })
  const [tableIndexes] = useState<IndexInfo[]>([])

  const {
    addColumn,
    validateColumnName,
    loading: operationsLoading,
    error: operationsError,
    clearError,
  } = useTableOperations()

  // Check if current table allows schema modifications
  const canEditSchema = tableName ? !isSystemTable(tableName) : false

  // Handle add column
  const handleAddColumn = async (e: Event) => {
    e.preventDefault()
    if (!tableName) return

    clearError()
    const success = await addColumn(tableName, newColumn)
    if (success) {
      setNewColumn({
        name: '',
        type: 'TEXT',
        notNull: false,
        foreignKey: { enabled: false, table: '', column: '' },
      })
      setShowSchemaEditor(false)
      onSchemaChange()
    }
  }

  // Handle create index
  const handleCreateIndex = async (e: Event) => {
    e.preventDefault()
    if (!tableName) return

    try {
      const columnsToIndex = newIndex.columns.filter((col) => col.trim() !== '')
      if (columnsToIndex.length === 0) {
        alert('At least one column is required for the index')
        return
      }

      // TODO: Replace with actual API call
      console.log('Create index:', {
        tableName,
        name: newIndex.name,
        columns: columnsToIndex,
        unique: newIndex.unique,
      })

      setNewIndex({ name: '', columns: [''], unique: false })
      setShowIndexManager(false)
      onSchemaChange()
    } catch (err) {
      console.error('Failed to create index:', err)
    }
  }

  // Handle drop index
  const handleDropIndex = async (indexName: string) => {
    if (!tableName) return

    if (
      !confirm(
        `Are you sure you want to drop the index "${indexName}"? This action cannot be undone.`
      )
    ) {
      return
    }

    try {
      // TODO: Replace with actual API call
      console.log('Drop index:', indexName)
      onSchemaChange()
    } catch (err) {
      console.error('Failed to drop index:', err)
    }
  }

  if (!tableName) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">Select a table to view its schema</p>
        </div>
      </div>
    )
  }

  const userTables = getUserTables(tables)

  return (
    <div className="space-y-6">
      {/* Schema Overview */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{tableName} Schema</h2>
            {!canEditSchema && (
              <p className="text-sm text-gray-500 mt-1">System table - schema is read-only</p>
            )}
          </div>
          {canEditSchema && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSchemaEditor(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                disabled={loading || operationsLoading}
              >
                Add Column
              </button>
              <button
                type="button"
                onClick={() => setShowIndexManager(true)}
                className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
                disabled={loading || operationsLoading}
              >
                Manage Indexes
              </button>
            </div>
          )}
        </div>

        {operationsError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{operationsError}</p>
            <button
              type="button"
              onClick={clearError}
              className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Columns */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Columns</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-200 rounded-md">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                        Constraints
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                        Default
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {tableColumns.map((column) => (
                      <tr key={column.name} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {column.name}
                          {column.pk === 1 && (
                            <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                              PK
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">{column.type}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {column.notnull === 1 && (
                            <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded mr-1">
                              NOT NULL
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {column.dflt_value || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Foreign Keys */}
            {tableForeignKeys.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Foreign Keys</h3>
                <div className="space-y-2">
                  {tableForeignKeys.map((fk, index) => (
                    <div
                      key={`${fk.from}-${fk.table}-${fk.to}-${index}`}
                      className="p-3 bg-gray-50 rounded-md"
                    >
                      <span className="font-medium">{fk.from}</span>
                      <span className="text-gray-500 mx-2">→</span>
                      <span className="text-blue-600">
                        {fk.table}.{fk.to}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Indexes */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Indexes</h3>
              {tableIndexes.length === 0 ? (
                <p className="text-gray-500 italic">No custom indexes created.</p>
              ) : (
                <div className="space-y-2">
                  {tableIndexes.map((index) => (
                    <div
                      key={index.name}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <div>
                        <span className="font-medium">{index.name}</span>
                        <span className="text-gray-500 ml-2">({index.columns?.join(', ')})</span>
                        {index.unique && (
                          <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            UNIQUE
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDropIndex(index.name)}
                        className="text-red-600 hover:text-red-800 text-sm"
                        disabled={operationsLoading}
                      >
                        Drop
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Column Modal */}
      {showSchemaEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Column</h3>

            <form onSubmit={handleAddColumn} className="space-y-4">
              <div>
                <label
                  htmlFor="column-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Column Name
                </label>
                <input
                  id="column-name"
                  type="text"
                  value={newColumn.name}
                  onChange={(e) =>
                    setNewColumn((prev) => ({ ...prev, name: e.currentTarget.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter column name"
                  required
                />
                {newColumn.name && validateColumnName(newColumn.name) && (
                  <p className="text-red-600 text-sm mt-1">{validateColumnName(newColumn.name)}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="column-type"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Data Type
                </label>
                <select
                  id="column-type"
                  value={newColumn.type}
                  onChange={(e) =>
                    setNewColumn((prev) => ({ ...prev, type: e.currentTarget.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {getSQLTypes().map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newColumn.notNull}
                    onChange={(e) =>
                      setNewColumn((prev) => ({ ...prev, notNull: e.currentTarget.checked }))
                    }
                    className="mr-2"
                  />
                  NOT NULL
                </label>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newColumn.foreignKey.enabled}
                    onChange={(e) =>
                      setNewColumn((prev) => ({
                        ...prev,
                        foreignKey: { ...prev.foreignKey, enabled: e.currentTarget.checked },
                      }))
                    }
                    className="mr-2"
                  />
                  Foreign Key Reference
                </label>
              </div>

              {newColumn.foreignKey.enabled && (
                <div className="space-y-3 ml-6">
                  <div>
                    <label
                      htmlFor="reference-table"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Reference Table
                    </label>
                    <select
                      id="reference-table"
                      value={newColumn.foreignKey.table}
                      onChange={(e) =>
                        setNewColumn((prev) => ({
                          ...prev,
                          foreignKey: {
                            ...prev.foreignKey,
                            table: e.currentTarget.value,
                            column: '',
                          },
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select table</option>
                      {userTables.map((table) => (
                        <option key={table.name} value={table.name}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="reference-column"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Reference Column
                    </label>
                    <input
                      id="reference-column"
                      type="text"
                      value={newColumn.foreignKey.column}
                      onChange={(e) =>
                        setNewColumn((prev) => ({
                          ...prev,
                          foreignKey: { ...prev.foreignKey, column: e.currentTarget.value },
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Usually 'id'"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSchemaEditor(false)
                    clearError()
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={operationsLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                  disabled={operationsLoading}
                >
                  {operationsLoading ? 'Adding...' : 'Add Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Index Manager Modal */}
      {showIndexManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Index</h3>

            <form onSubmit={handleCreateIndex} className="space-y-4">
              <div>
                <label
                  htmlFor="index-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Index Name
                </label>
                <input
                  id="index-name"
                  type="text"
                  value={newIndex.name}
                  onChange={(e) =>
                    setNewIndex((prev) => ({ ...prev, name: e.currentTarget.value }))
                  }
                  onFocus={() => {
                    if (!newIndex.name && tableName) {
                      const columns = newIndex.columns.filter((col) => col.trim() !== '')
                      if (columns.length > 0) {
                        setNewIndex((prev) => ({
                          ...prev,
                          name: generateIndexName(tableName, columns),
                        }))
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter index name"
                  required
                />
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Columns</div>
                <div className="space-y-2">
                  {newIndex.columns.map((column, index) => (
                    <div key={`column-${index}-${column || 'empty'}`} className="flex gap-2">
                      <select
                        value={column}
                        onChange={(e) => {
                          const newColumns = [...newIndex.columns]
                          newColumns[index] = e.currentTarget.value
                          setNewIndex((prev) => ({ ...prev, columns: newColumns }))
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select column</option>
                        {tableColumns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </select>

                      {newIndex.columns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newColumns = newIndex.columns.filter((_, i) => i !== index)
                            setNewIndex((prev) => ({ ...prev, columns: newColumns }))
                          }}
                          className="p-2 text-red-600 hover:text-red-800"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <title>Remove column from index</title>
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setNewIndex((prev) => ({ ...prev, columns: [...prev.columns, ''] }))
                  }
                  className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  + Add Column
                </button>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newIndex.unique}
                    onChange={(e) =>
                      setNewIndex((prev) => ({ ...prev, unique: e.currentTarget.checked }))
                    }
                    className="mr-2"
                  />
                  Unique Index
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowIndexManager(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
                >
                  Create Index
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
