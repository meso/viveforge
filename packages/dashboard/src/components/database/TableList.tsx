import { useState } from 'preact/hooks'
import { type NewTableData, useTableOperations } from '../../hooks/useTableOperations'
import type { TableInfo } from '../../lib/api'
import { getSQLTypes, getUserTables, SYSTEM_TABLES } from '../../utils/database'

interface TableListProps {
  tables: TableInfo[]
  selectedTable: string | null
  onTableSelect: (tableName: string | null) => void
  onTablesChange: () => void // Callback when tables are modified
  loading: boolean
}

export function TableList({
  tables,
  selectedTable,
  onTableSelect,
  onTablesChange,
  loading,
}: TableListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTable, setNewTable] = useState<NewTableData>({
    name: '',
    columns: [
      {
        name: '',
        type: 'TEXT',
        notNull: false,
        foreignKey: { enabled: false, table: '', column: '' },
      },
    ],
    indexes: [],
  })
  const [openDropdownTable, setOpenDropdownTable] = useState<string | null>(null)

  const {
    createTable,
    dropTable,
    changeAccessPolicy,
    validateTableName,
    validateColumnName,
    loading: operationsLoading,
    error: operationsError,
    clearError,
  } = useTableOperations()

  // Handle create table form submission
  const handleCreateTable = async (e: Event) => {
    e.preventDefault()
    clearError()

    const success = await createTable(newTable)
    if (success) {
      // Reset form
      setNewTable({
        name: '',
        columns: [
          {
            name: '',
            type: 'TEXT',
            notNull: false,
            foreignKey: { enabled: false, table: '', column: '' },
          },
        ],
        indexes: [],
      })
      setShowCreateForm(false)
      onTablesChange()
    }
  }

  // Handle drop table
  const handleDropTable = async (tableName: string) => {
    if (
      !confirm(`Are you sure you want to drop table "${tableName}"? This action cannot be undone.`)
    ) {
      return
    }

    const success = await dropTable(tableName)
    if (success) {
      if (selectedTable === tableName) {
        onTableSelect(null)
      }
      onTablesChange()
    }
    setOpenDropdownTable(null)
  }

  // Handle access policy change
  const handleChangeAccessPolicy = async (tableName: string, newPolicy: 'public' | 'private') => {
    const success = await changeAccessPolicy(tableName, newPolicy)
    if (success) {
      onTablesChange()
    }
    setOpenDropdownTable(null)
  }

  // Add new column to table creation form
  const addColumn = () => {
    setNewTable((prev) => ({
      ...prev,
      columns: [
        ...prev.columns,
        {
          name: '',
          type: 'TEXT',
          notNull: false,
          foreignKey: { enabled: false, table: '', column: '' },
        },
      ],
    }))
  }

  // Remove column from table creation form
  const removeColumn = (index: number) => {
    setNewTable((prev) => ({
      ...prev,
      columns: prev.columns.filter((_, i) => i !== index),
    }))
  }

  // Update column in table creation form
  const updateColumn = (index: number, field: string, value: unknown) => {
    setNewTable((prev) => ({
      ...prev,
      columns: prev.columns.map((col, i) => (i === index ? { ...col, [field]: value } : col)),
    }))
  }

  const userTables = getUserTables(tables)
  const systemTables = tables.filter((table) =>
    SYSTEM_TABLES.includes(table.name as (typeof SYSTEM_TABLES)[number])
  )

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Tables</h2>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          disabled={loading || operationsLoading}
        >
          Create Table
        </button>
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
          {/* User Tables */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">User Tables</h3>
            {userTables.length === 0 ? (
              <p className="text-gray-500 italic">No user tables created yet.</p>
            ) : (
              <div className="grid gap-2">
                {userTables.map((table) => (
                  <div
                    key={table.name}
                    className={`p-3 border rounded-md cursor-pointer transition-colors relative ${
                      selectedTable === table.name
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => onTableSelect(table.name)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{table.name}</span>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              table.access_policy === 'public'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {table.access_policy || 'public'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{table.rowCount} rows</p>
                      </button>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenDropdownTable(
                              openDropdownTable === table.name ? null : table.name
                            )
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <title>Table options menu</title>
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>

                        {openDropdownTable === table.name && (
                          <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                            <button
                              type="button"
                              onClick={() =>
                                handleChangeAccessPolicy(
                                  table.name,
                                  table.access_policy === 'public' ? 'private' : 'public'
                                )
                              }
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                              disabled={operationsLoading}
                            >
                              Make {table.access_policy === 'public' ? 'Private' : 'Public'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDropTable(table.name)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                              disabled={operationsLoading}
                            >
                              Drop Table
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* System Tables */}
          <div>
            <h3 className="text-lg font-medium text-gray-500 mb-3">System Tables</h3>
            <div className="grid gap-2">
              {systemTables.map((table) => (
                <button
                  key={table.name}
                  type="button"
                  onClick={() => onTableSelect(table.name)}
                  className={`p-3 border rounded-md cursor-pointer transition-colors text-left w-full ${
                    selectedTable === table.name
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">{table.name}</span>
                    <span className="text-sm text-gray-500">{table.rowCount} rows</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Table Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Create New Table</h3>

            <form onSubmit={handleCreateTable} className="space-y-4">
              <div>
                <label
                  htmlFor="table-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Table Name
                </label>
                <input
                  id="table-name"
                  type="text"
                  value={newTable.name}
                  onChange={(e) =>
                    setNewTable((prev) => ({ ...prev, name: e.currentTarget.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter table name"
                  required
                />
                {newTable.name && validateTableName(newTable.name) && (
                  <p className="text-red-600 text-sm mt-1">{validateTableName(newTable.name)}</p>
                )}
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Columns</div>
                <div className="space-y-3">
                  {newTable.columns.map((column, index) => (
                    <div
                      key={`column-${column.name || index}`}
                      className="border border-gray-200 rounded-md p-3"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <input
                            type="text"
                            placeholder="Column name"
                            value={column.name}
                            onChange={(e) => updateColumn(index, 'name', e.currentTarget.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {column.name && validateColumnName(column.name) && (
                            <p className="text-red-600 text-xs mt-1">
                              {validateColumnName(column.name)}
                            </p>
                          )}
                        </div>

                        <div>
                          <select
                            value={column.type}
                            onChange={(e) => updateColumn(index, 'type', e.currentTarget.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {getSQLTypes().map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={column.notNull}
                              onChange={(e) =>
                                updateColumn(index, 'notNull', e.currentTarget.checked)
                              }
                              className="mr-1"
                            />
                            NOT NULL
                          </label>

                          {newTable.columns.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeColumn(index)}
                              className="p-1 text-red-600 hover:text-red-800"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <title>Remove column</title>
                                <path
                                  fillRule="evenodd"
                                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addColumn}
                  className="mt-3 px-3 py-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  + Add Column
                </button>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
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
                  {operationsLoading ? 'Creating...' : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
