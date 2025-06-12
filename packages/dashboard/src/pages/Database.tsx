import { useState, useEffect } from 'preact/hooks'
import { api, type TableInfo } from '../lib/api'

// Utility function to truncate IDs
const truncateId = (id: string | null): string => {
  if (!id) return '-'
  return id.length > 8 ? `${id.substring(0, 4)}...` : id
}

// Copy to clipboard utility
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const result = document.execCommand('copy')
      document.body.removeChild(textArea)
      return result
    } catch (fallbackErr) {
      console.error('Failed to copy to clipboard:', fallbackErr)
      return false
    }
  }
}

export function DatabasePage() {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableData, setTableData] = useState<any[]>([])
  const [tableColumns, setTableColumns] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showCreateTableForm, setShowCreateTableForm] = useState(false)
  const [newRecord, setNewRecord] = useState<Record<string, any>>({})
  const [newTable, setNewTable] = useState({ name: '', columns: [{ name: '', type: 'TEXT', notNull: false, foreignKey: { enabled: false, table: '', column: '' } }] })
  const [openDropdownTable, setOpenDropdownTable] = useState<string | null>(null)
  const [copiedCell, setCopiedCell] = useState<string | null>(null)

  useEffect(() => {
    loadTables()
  }, [])

  useEffect(() => {
    if (selectedTable) {
      loadTableData()
      loadTableSchema()
      // Close any open forms when switching tables
      setShowCreateForm(false)
      setShowCreateTableForm(false)
    }
  }, [selectedTable])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdownTable(null)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const loadTables = async () => {
    try {
      setLoading(true)
      const result = await api.getTables()
      setTables(result.tables)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tables')
    } finally {
      setLoading(false)
    }
  }

  const loadTableSchema = async () => {
    if (!selectedTable) return
    try {
      const result = await api.getTableSchema(selectedTable)
      setTableColumns(result.columns)
      // Initialize new record with empty values for each column
      const initialRecord: Record<string, any> = {}
      result.columns.forEach(col => {
        if (!['id', 'created_at', 'updated_at'].includes(col.name)) {
          initialRecord[col.name] = ''
        }
      })
      setNewRecord(initialRecord)
    } catch (err) {
      console.error('Failed to load table schema:', err)
    }
  }

  const loadTableData = async () => {
    if (!selectedTable) return
    try {
      setLoading(true)
      const result = await api.getTableData(selectedTable)
      setTableData(result.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRecord = async (e: Event) => {
    e.preventDefault()
    if (!selectedTable) return

    try {
      // Convert empty strings to null for proper constraint checking
      const recordToSend = Object.fromEntries(
        Object.entries(newRecord).map(([key, value]) => [
          key, 
          value === '' ? null : value
        ])
      )
      
      console.log('Sending record data:', recordToSend)
      
      const response = await fetch(`${window.location.origin}/api/tables/${selectedTable}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordToSend)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to create record`)
      }
      
      await loadTableData()
      setShowCreateForm(false)
      setError(null) // Clear any previous errors
      // Reset form will happen when schema reloads
    } catch (err) {
      console.error('Create record error:', err)
      if (err instanceof Error) {
        // Make error messages more user-friendly
        let userFriendlyMessage = err.message
        
        // Handle common constraint errors
        if (err.message.includes('FOREIGN KEY constraint failed')) {
          userFriendlyMessage = 'Foreign key constraint failed: The referenced record does not exist'
        } else if (err.message.includes('NOT NULL constraint failed')) {
          const match = err.message.match(/NOT NULL constraint failed: (\w+)\.(\w+)/)
          if (match) {
            userFriendlyMessage = `Required field "${match[2]}" cannot be empty`
          } else {
            userFriendlyMessage = 'A required field cannot be empty'
          }
        } else if (err.message.includes('UNIQUE constraint failed')) {
          const match = err.message.match(/UNIQUE constraint failed: (\w+)\.(\w+)/)
          if (match) {
            userFriendlyMessage = `Value for "${match[2]}" must be unique`
          } else {
            userFriendlyMessage = 'This value must be unique'
          }
        }
        
        setError(userFriendlyMessage)
      } else {
        setError('Failed to create record')
      }
    }
  }

  const handleDeleteRecord = async (id: string) => {
    if (!selectedTable || !confirm('Are you sure you want to delete this record?')) return

    try {
      await fetch(`${window.location.origin}/api/tables/${selectedTable}/data/${id}`, {
        method: 'DELETE'
      })
      await loadTableData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record')
    }
  }

  const handleCreateTable = async (e: Event) => {
    e.preventDefault()
    
    try {
      const columnsToCreate = newTable.columns
        .filter(col => col.name)
        .map(col => ({
          name: col.name,
          type: col.type,
          constraints: col.notNull ? 'NOT NULL' : undefined,
          ...(col.foreignKey?.enabled && col.foreignKey?.table && col.foreignKey?.column 
            ? { foreignKey: { table: col.foreignKey.table, column: col.foreignKey.column } }
            : {})
        }))
      
      console.log('Creating table:', newTable.name, 'with columns:', columnsToCreate)
      await api.createTable(newTable.name, columnsToCreate)
      await loadTables()
      setShowCreateTableForm(false)
      setNewTable({ name: '', columns: [{ name: '', type: 'TEXT', notNull: false, foreignKey: { enabled: false, table: '', column: '' } }] })
      setError(null) // Clear any previous errors
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create table')
    }
  }

  const handleDropTable = async (tableName: string) => {
    if (!confirm(`Are you sure you want to drop the table "${tableName}"? This action cannot be undone.`)) return

    try {
      await api.dropTable(tableName)
      await loadTables()
      if (selectedTable === tableName) {
        setSelectedTable(null)
        setTableData([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to drop table')
    }
  }

  const handleCopyId = async (id: string, rowIndex: number, columnName: string) => {
    const success = await copyToClipboard(id)
    if (success) {
      const cellKey = `${rowIndex}-${columnName}`
      setCopiedCell(cellKey)
      setTimeout(() => setCopiedCell(null), 2000) // Clear after 2 seconds
    }
  }

  const handleIdClick = async (event: MouseEvent, id: string, rowIndex: number, columnName: string) => {
    if (event.metaKey || event.ctrlKey) {
      // Cmd+Click (Mac) or Ctrl+Click (Windows): Jump to record with this ID
      await jumpToRecord(id, columnName)
    } else {
      // Regular click: Copy to clipboard
      await handleCopyId(id, rowIndex, columnName)
    }
  }

  const jumpToRecord = async (id: string, columnName: string) => {
    // Find which table this ID references
    const referencingTable = await findTableWithId(id, columnName)
    if (referencingTable) {
      setSelectedTable(referencingTable)
      // Scroll to the record after table loads
      setTimeout(() => {
        const element = document.querySelector(`[data-record-id="${id}"]`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Highlight the record temporarily
          element.classList.add('bg-yellow-100')
          setTimeout(() => element.classList.remove('bg-yellow-100'), 2000)
        }
      }, 500)
    }
  }

  const findTableWithId = async (id: string, columnName: string): Promise<string | null> => {
    // If the column name ends with '_id', try to find the referenced table
    if (columnName.endsWith('_id')) {
      const baseTableName = columnName.replace('_id', '') + 's' // user_id -> users
      const table = tables.find(t => t.name === baseTableName)
      if (table) return table.name
    }
    
    // Fallback: search through all tables for a record with this ID
    for (const table of tables) {
      try {
        const result = await api.getTableData(table.name, 1, 0)
        const hasRecord = result.data.some(record => record.id === id)
        if (hasRecord) return table.name
      } catch (error) {
        // Continue searching other tables
      }
    }
    
    return null
  }

  const userTables = tables.filter(t => t.type === 'user')
  const systemTables = tables.filter(t => t.type === 'system')

  return (
    <div>
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h2 class="text-2xl font-bold text-gray-900">Database</h2>
          <p class="mt-2 text-sm text-gray-700">
            Manage your D1 database tables and data
          </p>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => setShowCreateTableForm(true)}
            class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            Create Table
          </button>
        </div>
      </div>

      {error && !showCreateForm && (
        <div class="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <div class="text-sm text-red-700">{error}</div>
          <button
            onClick={() => setError(null)}
            class="mt-2 text-xs text-red-600 hover:text-red-500"
          >
            Dismiss
          </button>
        </div>
      )}

      {showCreateTableForm && (
        <div class="mt-6 bg-white shadow rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Create New Table</h3>
          <form onSubmit={handleCreateTable}>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700">Table Name</label>
              <input
                type="text"
                value={newTable.name}
                onInput={(e) => setNewTable({ ...newTable, name: (e.target as HTMLInputElement).value })}
                class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="my_table"
                pattern="[a-zA-Z_][a-zA-Z0-9_]*"
                required
              />
            </div>
            
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Columns</label>
              <div class="space-y-2">
                {newTable.columns.map((col, idx) => (
                  <div key={idx}>
                    <div class="flex space-x-2">
                    <input
                      type="text"
                      value={col.name}
                      onInput={(e) => {
                        const newColumns = [...newTable.columns]
                        newColumns[idx].name = (e.target as HTMLInputElement).value
                        setNewTable({ ...newTable, columns: newColumns })
                      }}
                      class="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="column_name"
                      pattern="[a-zA-Z_][a-zA-Z0-9_]*"
                    />
                    <select
                      value={col.type}
                      onChange={(e) => {
                        const newColumns = [...newTable.columns]
                        newColumns[idx].type = (e.target as HTMLSelectElement).value
                        setNewTable({ ...newTable, columns: newColumns })
                      }}
                      class="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="TEXT">TEXT</option>
                      <option value="INTEGER">INTEGER</option>
                      <option value="REAL">REAL</option>
                      <option value="BLOB">BLOB</option>
                      <option value="BOOLEAN">BOOLEAN</option>
                    </select>
                    
                    {/* NOT NULL Toggle */}
                    <label class="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={col.notNull || false}
                        onChange={(e) => {
                          const newColumns = [...newTable.columns]
                          newColumns[idx].notNull = (e.target as HTMLInputElement).checked
                          setNewTable({ ...newTable, columns: newColumns })
                        }}
                        class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span class="text-xs text-gray-700">NN</span>
                    </label>
                    
                    {/* Foreign Key Toggle */}
                    <label class="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={col.foreignKey?.enabled || false}
                        onChange={(e) => {
                          const newColumns = [...newTable.columns]
                          const isEnabled = (e.target as HTMLInputElement).checked
                          newColumns[idx].foreignKey = {
                            ...newColumns[idx].foreignKey,
                            enabled: isEnabled,
                            column: isEnabled ? 'id' : ''  // Set default column when enabling FK
                          }
                          setNewTable({ ...newTable, columns: newColumns })
                        }}
                        class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span class="text-xs text-gray-700">FK</span>
                    </label>
                    
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newColumns = newTable.columns.filter((_, i) => i !== idx)
                          setNewTable({ ...newTable, columns: newColumns })
                        }}
                        class="text-red-600 hover:text-red-900 text-sm"
                      >
                        Remove
                      </button>
                    )}
                    </div>
                  
                    {/* Foreign Key Settings */}
                    {col.foreignKey?.enabled && (
                    <div class="flex space-x-2 ml-4 mt-1">
                      <select
                        value={col.foreignKey?.table || ''}
                        onChange={(e) => {
                          const newColumns = [...newTable.columns]
                          newColumns[idx].foreignKey = {
                            ...newColumns[idx].foreignKey,
                            table: (e.target as HTMLSelectElement).value
                          }
                          setNewTable({ ...newTable, columns: newColumns })
                        }}
                        class="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="">Select table...</option>
                        {tables.map(table => (
                          <option key={table.name} value={table.name}>{table.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={col.foreignKey?.column || ''}
                        onChange={(e) => {
                          const newColumns = [...newTable.columns]
                          newColumns[idx].foreignKey = {
                            ...newColumns[idx].foreignKey,
                            column: (e.target as HTMLInputElement).value
                          }
                          setNewTable({ ...newTable, columns: newColumns })
                        }}
                        placeholder="id"
                        class="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setNewTable({ ...newTable, columns: [...newTable.columns, { name: '', type: 'TEXT', notNull: false, foreignKey: { enabled: false, table: '', column: '' } }] })}
                class="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
              >
                Add Column
              </button>
              <p class="mt-2 text-xs text-gray-500">
                Note: id, created_at, and updated_at columns will be added automatically
              </p>
            </div>
            
            <div class="flex space-x-3">
              <button
                type="submit"
                class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateTableForm(false)
                  setError(null) // Clear error when canceling
                }}
                class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tables List */}
        <div class="lg:col-span-1">
          <div class="bg-white shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Tables</h3>
              
              {loading && !selectedTable ? (
                <div class="text-sm text-gray-500">Loading...</div>
              ) : (
                <div class="space-y-4">
                  {/* User Tables */}
                  <div>
                    <h4 class="text-sm font-medium text-gray-700 mb-2">User Tables</h4>
                    <div class="space-y-1">
                      {userTables.map(table => (
                        <div
                          key={table.name}
                          class={`flex items-center justify-between p-2 rounded hover:bg-gray-50 ${
                            selectedTable === table.name ? 'bg-indigo-50 border border-indigo-200' : ''
                          }`}
                        >
                          <div 
                            class="flex-1 cursor-pointer"
                            onClick={() => setSelectedTable(table.name)}
                          >
                            <div class="text-sm font-medium text-gray-900">{table.name}</div>
                            <div class="text-xs text-gray-500">{table.rowCount || 0} rows</div>
                          </div>
                          {table.type === 'user' && (
                            <div class="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenDropdownTable(openDropdownTable === table.name ? null : table.name)
                                }}
                                class="p-1 text-gray-400 hover:text-gray-600 rounded"
                              >
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>
                              {openDropdownTable === table.name && (
                                <div class="absolute right-0 mt-1 w-24 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDropTable(table.name)
                                      setOpenDropdownTable(null)
                                    }}
                                    class="w-full px-3 py-2 text-xs text-left text-red-600 hover:bg-red-50"
                                  >
                                    Drop Table
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {userTables.length === 0 && (
                        <p class="text-sm text-gray-500">No user tables yet</p>
                      )}
                    </div>
                  </div>

                  {/* System Tables */}
                  <div>
                    <h4 class="text-sm font-medium text-gray-700 mb-2">System Tables</h4>
                    <div class="space-y-1">
                      {systemTables.map(table => (
                        <div
                          key={table.name}
                          class={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-gray-50 ${
                            selectedTable === table.name ? 'bg-indigo-50 border border-indigo-200' : ''
                          }`}
                          onClick={() => setSelectedTable(table.name)}
                        >
                          <div>
                            <div class="text-sm font-medium text-gray-900">{table.name}</div>
                            <div class="text-xs text-gray-500">{table.rowCount || 0} rows</div>
                          </div>
                          <span class="text-xs text-gray-400">Protected</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Data */}
        <div class="lg:col-span-2">
          {selectedTable ? (
            <div class="bg-white shadow rounded-lg">
              <div class="px-4 py-5 sm:p-6">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-lg font-medium text-gray-900">{selectedTable}</h3>
                  {tables.find(t => t.name === selectedTable)?.type === 'user' && (
                    <button
                      type="button"
                      onClick={() => {
                        // Reinitialize the form when opening
                        const initialRecord: Record<string, any> = {}
                        tableColumns.forEach(col => {
                          if (!['id', 'created_at', 'updated_at'].includes(col.name)) {
                            initialRecord[col.name] = ''
                          }
                        })
                        setNewRecord(initialRecord)
                        setError(null) // Clear any previous errors
                        setShowCreateForm(true)
                      }}
                      class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Add Record
                    </button>
                  )}
                </div>

                {showCreateForm && (
                  <div class="mb-6 p-4 border border-gray-200 rounded-lg">
                    <h4 class="text-sm font-medium text-gray-900 mb-3">Create New Record</h4>
                    <form onSubmit={handleCreateRecord}>
                      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {Object.entries(newRecord).map(([key, value]) => (
                          <div key={key}>
                            <label class="block text-xs font-medium text-gray-700">{key}</label>
                            <input
                              type="text"
                              value={value}
                              onInput={(e) => setNewRecord({ ...newRecord, [key]: (e.target as HTMLInputElement).value })}
                              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                          </div>
                        ))}
                      </div>
                      
                      {/* Error display within the form */}
                      {error && showCreateForm && (
                        <div class="mt-3 bg-red-50 border border-red-200 rounded-md p-3">
                          <div class="flex">
                            <div class="flex-shrink-0">
                              <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                              </svg>
                            </div>
                            <div class="ml-3">
                              <p class="text-sm text-red-700">{error}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div class="mt-3 flex space-x-2">
                        <button
                          type="submit"
                          class="inline-flex justify-center py-1.5 px-3 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateForm(false)
                            setError(null) // Clear error when canceling
                          }}
                          class="inline-flex justify-center py-1.5 px-3 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {loading ? (
                  <div class="text-center py-4 text-sm text-gray-500">Loading data...</div>
                ) : tableData.length === 0 ? (
                  <div class="text-center py-8">
                    <p class="text-sm text-gray-500">No data in this table</p>
                  </div>
                ) : (
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                      <thead class="bg-gray-50">
                        <tr>
                          {tableColumns.map(col => (
                            <th
                              key={col.name}
                              class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {col.name}
                            </th>
                          ))}
                          <th class="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody class="bg-white divide-y divide-gray-200">
                        {tableData.map((row, idx) => (
                          <tr key={row.id || idx} data-record-id={row.id}>
                            {tableColumns.map(col => (
                              <td key={col.name} class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {col.name.includes('_at') && row[col.name] ? (
                                  new Date(row[col.name]).toLocaleString()
                                ) : col.name === 'id' || col.name.endsWith('_id') ? (
                                  row[col.name] && row[col.name].length > 8 ? (
                                    <button
                                      onClick={(e) => handleIdClick(e, row[col.name], idx, col.name)}
                                      class="text-blue-600 hover:text-blue-800 cursor-pointer underline decoration-dotted relative"
                                      title="Click to copy • Cmd+Click to jump to record"
                                    >
                                      {truncateId(row[col.name])}
                                      {copiedCell === `${idx}-${col.name}` && (
                                        <span class="absolute -top-8 left-0 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                          Copied!
                                        </span>
                                      )}
                                    </button>
                                  ) : (
                                    row[col.name] || '-'
                                  )
                                ) : (
                                  row[col.name] || '-'
                                )}
                              </td>
                            ))}
                            <td class="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                              {tables.find(t => t.name === selectedTable)?.type === 'user' && (
                                <button
                                  onClick={() => handleDeleteRecord(row.id)}
                                  class="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div class="bg-white shadow rounded-lg">
              <div class="px-4 py-5 sm:p-6 text-center">
                <svg
                  class="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">No table selected</h3>
                <p class="mt-1 text-sm text-gray-500">
                  Select a table from the list to view its data
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}