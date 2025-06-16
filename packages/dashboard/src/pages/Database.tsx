import { useState, useEffect, useRef } from 'preact/hooks'
import { api, type TableInfo, type ForeignKeyInfo, type IndexInfo } from '../lib/api'
import { SchemaHistory } from '../components/SchemaHistory'

// Utility function to truncate IDs
const truncateId = (id: string | null): string => {
  if (!id) return '-'
  return id.length > 8 ? `${id.substring(0, 4)}...` : id
}

// System tables that should not be available for FK references
const SYSTEM_TABLES = ['admins', 'sessions', 'schema_snapshots', 'schema_snapshot_counter', 'd1_migrations']

// Filter out system tables for FK references
const getUserTables = (tables: TableInfo[]): TableInfo[] => {
  return tables.filter(table => !SYSTEM_TABLES.includes(table.name))
}

// Generate default index name
const generateIndexName = (tableName: string, columns: string[]): string => {
  const columnPart = columns.filter(col => col.trim() !== '').join('_')
  return `idx_${tableName}_${columnPart}`.toLowerCase()
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
  const [tableForeignKeys, setTableForeignKeys] = useState<ForeignKeyInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showCreateTableForm, setShowCreateTableForm] = useState(false)
  const [newRecord, setNewRecord] = useState<Record<string, any>>({})
  const [newTable, setNewTable] = useState({ 
    name: '', 
    columns: [{ name: '', type: 'TEXT', notNull: false, foreignKey: { enabled: false, table: '', column: '' } }],
    indexes: [] as { name: string; columns: string[]; unique: boolean }[]
  })
  const [openDropdownTable, setOpenDropdownTable] = useState<string | null>(null)
  const [copiedCell, setCopiedCell] = useState<string | null>(null)
  const [showSchemaEditor, setShowSchemaEditor] = useState(false)
  const [newColumn, setNewColumn] = useState({ name: '', type: 'TEXT', notNull: false, foreignKey: { enabled: false, table: '', column: '' } })
  const [editingColumn, setEditingColumn] = useState<{ oldName: string; newName: string } | null>(null)
  const [modifyingColumn, setModifyingColumn] = useState<{ name: string; type: string; notNull: boolean; foreignKey: { enabled: boolean; table: string; column: string } } | null>(null)
  const [validationWarning, setValidationWarning] = useState<{ errors: string[]; conflictingRows: number; onConfirm: () => void } | null>(null)
  const [confirmationModal, setConfirmationModal] = useState<{ title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'warning' } | null>(null)
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnName: string; value: any } | null>(null)
  const [editingRecord, setEditingRecord] = useState<{ id: string; data: Record<string, any> } | null>(null)
  const [clickCount, setClickCount] = useState<{[key: string]: { count: number; timeout: number }}>({})
  const [fkValidation, setFkValidation] = useState<{[key: string]: { isValid: boolean; isChecking: boolean; displayName?: string }}>({})
  const editInputRef = useRef<HTMLInputElement | null>(null)
  const hasInitializedFocus = useRef(false)
  const [showSchemaHistory, setShowSchemaHistory] = useState(false)
  const [tableIndexes, setTableIndexes] = useState<IndexInfo[]>([])
  const [showIndexManager, setShowIndexManager] = useState(false)
  const [newIndex, setNewIndex] = useState({ 
    name: '', 
    columns: [''], 
    unique: false 
  })

  // Update index name when columns change
  useEffect(() => {
    if (selectedTable && newIndex.columns.some(col => col.trim() !== '')) {
      const defaultName = generateIndexName(selectedTable, newIndex.columns)
      setNewIndex(prev => ({ ...prev, name: defaultName }))
    }
  }, [selectedTable, newIndex.columns])

  // Format date from SQLite DATETIME to user timezone
  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-'
    const utcDate = new Date(dateString + 'Z') // Add 'Z' to interpret as UTC
    return utcDate.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short'
    })
  }

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
      setShowSchemaEditor(false)
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
      setTableForeignKeys(result.foreignKeys || [])
      
      // Load table indexes
      const indexResult = await api.getTableIndexes(selectedTable)
      setTableIndexes(indexResult.indexes)
      
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
    if (!selectedTable) return

    setConfirmationModal({
      title: 'Delete Record',
      message: 'Are you sure you want to delete this record? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmationModal(null)
        try {
          await fetch(`${window.location.origin}/api/tables/${selectedTable}/data/${id}`, {
            method: 'DELETE'
          })
          await loadTableData()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to delete record')
        }
      }
    })
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
      
      // Create indexes if specified
      for (const index of newTable.indexes) {
        if (index.name && index.columns.length > 0 && index.columns.some(col => col.trim() !== '')) {
          try {
            await api.createIndex(newTable.name, {
              name: index.name,
              columns: index.columns.filter(col => col.trim() !== ''),
              unique: index.unique
            })
          } catch (indexError) {
            console.warn('Failed to create index:', indexError)
            // Continue with other indexes
          }
        }
      }
      
      await loadTables()
      setShowCreateTableForm(false)
      setNewTable({ 
        name: '', 
        columns: [{ name: '', type: 'TEXT', notNull: false, foreignKey: { enabled: false, table: '', column: '' } }],
        indexes: []
      })
      setError(null) // Clear any previous errors
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create table')
    }
  }

  const handleDropTable = async (tableName: string) => {
    setConfirmationModal({
      title: 'Drop Table',
      message: `Are you sure you want to drop the table "${tableName}"? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmationModal(null)
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
    })
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

  const handleAddColumn = async (e: Event) => {
    e.preventDefault()
    if (!selectedTable) return

    try {
      const columnData = {
        name: newColumn.name,
        type: newColumn.type,
        constraints: newColumn.notNull ? 'NOT NULL' : undefined,
        ...(newColumn.foreignKey?.enabled && newColumn.foreignKey?.table && newColumn.foreignKey?.column 
          ? { foreignKey: { table: newColumn.foreignKey.table, column: newColumn.foreignKey.column } }
          : {})
      }
      
      await api.addColumn(selectedTable, columnData)
      await loadTableSchema()
      setNewColumn({ name: '', type: 'TEXT', notNull: false, foreignKey: { enabled: false, table: '', column: '' } })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add column')
    }
  }

  const handleRenameColumn = async (oldName: string, newName: string) => {
    if (!selectedTable || !newName || oldName === newName) return

    try {
      await api.renameColumn(selectedTable, oldName, newName)
      await loadTableSchema()
      setEditingColumn(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename column')
    }
  }

  const handleDropColumn = async (columnName: string) => {
    if (!selectedTable) return

    setConfirmationModal({
      title: 'Drop Column',
      message: `Are you sure you want to drop the column "${columnName}"? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmationModal(null)
        try {
          await api.dropColumn(selectedTable, columnName)
          await loadTableSchema()
          setError(null)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to drop column')
        }
      }
    })
  }

  const handleModifyColumn = async (columnName: string, changes: { type?: string; notNull?: boolean; foreignKey?: { table: string; column: string } | null }) => {
    if (!selectedTable) return

    try {
      // Validate changes first
      const validation = await api.validateColumnChanges(selectedTable, columnName, changes)
      
      if (!validation.valid) {
        // Show validation warning modal instead of browser alert
        setValidationWarning({
          errors: validation.errors,
          conflictingRows: validation.conflictingRows,
          onConfirm: async () => {
            setValidationWarning(null)
            try {
              await api.modifyColumn(selectedTable, columnName, changes)
              await loadTableSchema()
              setModifyingColumn(null)
              setError(null)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to modify column')
            }
          }
        })
        return
      }

      await api.modifyColumn(selectedTable, columnName, changes)
      await loadTableSchema()
      setModifyingColumn(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to modify column')
    }
  }

  // Helper function to get foreign key info for a column
  const getForeignKeyForColumn = (columnName: string): ForeignKeyInfo | null => {
    return tableForeignKeys.find(fk => fk.from === columnName) || null
  }

  // Validate FK reference
  const validateForeignKey = async (value: string, fkInfo: ForeignKeyInfo) => {
    if (!value.trim()) return null
    
    const validationKey = `${fkInfo.table}-${value}`
    setFkValidation(prev => ({ ...prev, [validationKey]: { isValid: false, isChecking: true } }))
    
    try {
      // Check if the ID exists in the referenced table
      const result = await api.getTableData(fkInfo.table)
      const exists = result.data.some(record => record.id === value)
      
      setFkValidation(prev => ({ 
        ...prev, 
        [validationKey]: { 
          isValid: exists, 
          isChecking: false,
          displayName: exists ? `Valid ID in ${fkInfo.table}` : `ID not found in ${fkInfo.table}`
        } 
      }))
      
      return exists
    } catch (err) {
      setFkValidation(prev => ({ 
        ...prev, 
        [validationKey]: { 
          isValid: false, 
          isChecking: false,
          displayName: `Error checking ${fkInfo.table}`
        } 
      }))
      return false
    }
  }

  // Handle inline cell editing
  const handleCellDoubleClick = (rowId: string, columnName: string, currentValue: any) => {
    // Don't allow editing of system columns
    if (['id', 'created_at', 'updated_at'].includes(columnName)) {
      return
    }
    
    // Check if it's a simple field that can be edited inline
    const column = tableColumns.find(col => col.name === columnName)
    const hasFK = getForeignKeyForColumn(columnName)
    
    if (hasFK || !column) {
      // Open modal for FK references or complex fields
      const record = tableData.find(row => row.id === rowId)
      if (record) {
        setEditingRecord({ id: rowId, data: { ...record } })
      }
    } else {
      // Inline editing for simple fields
      hasInitializedFocus.current = false // Reset focus flag
      setEditingCell({ rowId, columnName, value: currentValue })
    }
  }

  // Save inline cell edit
  const handleCellSave = async (rowId: string, columnName: string, newValue: any) => {
    if (!selectedTable) return

    // 編集状態を先にクリアしてチカチカを防ぐ
    setEditingCell(null)

    // ローカルでデータを即座に更新（楽観的更新）
    setTableData(prevData => 
      prevData.map(row => 
        row.id === rowId 
          ? { ...row, [columnName]: newValue }
          : row
      )
    )

    try {
      await api.updateRecord(selectedTable, rowId, { [columnName]: newValue })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update record')
      // エラーの場合は編集状態を復元し、データを元に戻す
      setEditingCell({ rowId, columnName, value: newValue })
      // データも元に戻す
      await loadTableData()
    }
  }

  // Cancel inline cell edit
  const handleCellCancel = () => {
    setEditingCell(null)
  }

  // Handle record edit via modal
  const handleRecordSave = async () => {
    if (!selectedTable || !editingRecord) return

    try {
      // Remove system fields from update data
      const updateData = { ...editingRecord.data }
      delete updateData.id
      delete updateData.created_at
      delete updateData.updated_at

      await api.updateRecord(selectedTable, editingRecord.id, updateData)
      await loadTableData()
      setEditingRecord(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update record')
    }
  }

  // Index management functions
  const handleCreateIndex = async (e: Event) => {
    e.preventDefault()
    if (!selectedTable) return

    try {
      const columnsToIndex = newIndex.columns.filter(col => col.trim() !== '')
      if (columnsToIndex.length === 0) {
        setError('At least one column is required for the index')
        return
      }

      await api.createIndex(selectedTable, {
        name: newIndex.name,
        columns: columnsToIndex,
        unique: newIndex.unique
      })

      await loadTableSchema()
      setNewIndex({ name: '', columns: [''], unique: false })
      setShowIndexManager(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create index')
    }
  }

  const handleDropIndex = async (indexName: string) => {
    if (!selectedTable) return

    setConfirmationModal({
      title: 'Drop Index',
      message: `Are you sure you want to drop the index "${indexName}"? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmationModal(null)
        try {
          await api.dropIndex(selectedTable, indexName)
          await loadTableSchema()
          setError(null)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to drop index')
        }
      }
    })
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
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex space-x-3">
          <button
            type="button"
            onClick={() => setShowSchemaHistory(true)}
            class="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </button>
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
                        {getUserTables(tables).map(table => (
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

            {/* Index Settings Section */}
            <div class="mb-4">
              <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-medium text-gray-700">Indexes (Optional)</label>
                <button
                  type="button"
                  onClick={() => {
                    const defaultColumns = newTable.columns.filter(col => col.name.trim() !== '').map(col => col.name)
                    const defaultName = newTable.name ? generateIndexName(newTable.name, defaultColumns.slice(0, 1)) : ''
                    setNewTable({ 
                      ...newTable, 
                      indexes: [...newTable.indexes, { 
                        name: defaultName, 
                        columns: defaultColumns.slice(0, 1), 
                        unique: false 
                      }] 
                    })
                  }}
                  class="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Add Index
                </button>
              </div>
              
              <div class="space-y-3">
                {newTable.indexes.map((index, idx) => (
                  <div key={idx} class="p-3 bg-gray-50 rounded-md">
                    <div class="flex space-x-2 mb-2">
                      <input
                        type="text"
                        value={index.name}
                        onInput={(e) => {
                          const newIndexes = [...newTable.indexes]
                          newIndexes[idx].name = (e.target as HTMLInputElement).value
                          setNewTable({ ...newTable, indexes: newIndexes })
                        }}
                        placeholder="index_name"
                        class="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      />
                      <label class="flex items-center space-x-1">
                        <input
                          type="checkbox"
                          checked={index.unique}
                          onChange={(e) => {
                            const newIndexes = [...newTable.indexes]
                            newIndexes[idx].unique = (e.target as HTMLInputElement).checked
                            setNewTable({ ...newTable, indexes: newIndexes })
                          }}
                          class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span class="text-xs text-gray-700">Unique</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const newIndexes = newTable.indexes.filter((_, i) => i !== idx)
                          setNewTable({ ...newTable, indexes: newIndexes })
                        }}
                        class="text-red-600 hover:text-red-900 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    
                    <div class="space-y-1">
                      <label class="text-xs text-gray-700">Columns:</label>
                      {index.columns.map((column, colIdx) => (
                        <div key={colIdx} class="flex space-x-2">
                          <select
                            value={column}
                            onChange={(e) => {
                              const newIndexes = [...newTable.indexes]
                              newIndexes[idx].columns[colIdx] = (e.target as HTMLSelectElement).value
                              // Update index name when columns change
                              if (newTable.name) {
                                newIndexes[idx].name = generateIndexName(newTable.name, newIndexes[idx].columns.filter(c => c.trim() !== ''))
                              }
                              setNewTable({ ...newTable, indexes: newIndexes })
                            }}
                            class="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          >
                            <option value="">Select column...</option>
                            {newTable.columns.filter(col => col.name.trim() !== '').map(col => (
                              <option key={col.name} value={col.name}>{col.name}</option>
                            ))}
                          </select>
                          {index.columns.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newIndexes = [...newTable.indexes]
                                newIndexes[idx].columns = newIndexes[idx].columns.filter((_, i) => i !== colIdx)
                                setNewTable({ ...newTable, indexes: newIndexes })
                              }}
                              class="text-red-600 hover:text-red-500 text-sm"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const newIndexes = [...newTable.indexes]
                          newIndexes[idx].columns.push('')
                          setNewTable({ ...newTable, indexes: newIndexes })
                        }}
                        class="text-xs text-indigo-600 hover:text-indigo-500"
                      >
                        Add Column
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
                  setNewTable({ 
                    name: '', 
                    columns: [{ name: '', type: 'TEXT', notNull: false, foreignKey: { enabled: false, table: '', column: '' } }],
                    indexes: []
                  })
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
                    <div class="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowSchemaEditor(!showSchemaEditor)}
                        class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Edit Schema
                      </button>
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
                    </div>
                  )}
                </div>

                {showSchemaEditor && (
                  <div class="mb-6 p-4 border border-gray-200 rounded-lg">
                    <h4 class="text-sm font-medium text-gray-900 mb-3">Table Schema</h4>
                    
                    {/* Existing columns */}
                    <div class="mb-4">
                      <h5 class="text-xs font-medium text-gray-700 mb-2">Columns</h5>
                      <div class="space-y-2">
                        {tableColumns.map(col => (
                          <div key={col.name} class="flex items-center justify-between p-2 bg-gray-50 rounded">
                            {editingColumn?.oldName === col.name ? (
                              <input
                                type="text"
                                value={editingColumn?.newName || ''}
                                onInput={(e) => {
                                  if (editingColumn) {
                                    setEditingColumn({ ...editingColumn, newName: (e.target as HTMLInputElement).value })
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (editingColumn) {
                                    if (e.key === 'Enter') handleRenameColumn(editingColumn.oldName, editingColumn.newName)
                                    if (e.key === 'Escape') setEditingColumn(null)
                                  }
                                }}
                                onBlur={() => {
                                  if (editingColumn) {
                                    handleRenameColumn(editingColumn.oldName, editingColumn.newName)
                                  }
                                }}
                                class="flex-1 text-sm border-gray-300 rounded px-2 py-1"
                                autoFocus
                              />
                            ) : (
                              <div class="flex-1">
                                <span class="text-sm font-medium text-gray-900">{col.name}</span>
                                <span class="ml-2 text-xs text-gray-500">{col.type}</span>
                                {col.notnull ? <span class="ml-1 text-xs text-red-500">NOT NULL</span> : null}
                                {col.pk ? <span class="ml-1 text-xs text-blue-500">PRIMARY KEY</span> : null}
                                {getForeignKeyForColumn(col.name) && (
                                  <span class="ml-1 text-xs text-green-600">
                                    FK → {getForeignKeyForColumn(col.name)!.table}.{getForeignKeyForColumn(col.name)!.to}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {!['id', 'created_at', 'updated_at'].includes(col.name) && (
                              <div class="flex space-x-2">
                                <button
                                  onClick={() => setEditingColumn({ oldName: col.name, newName: col.name })}
                                  class="text-xs text-indigo-600 hover:text-indigo-500"
                                >
                                  Rename
                                </button>
                                <button
                                  onClick={() => {
                                    const fkInfo = getForeignKeyForColumn(col.name)
                                    setModifyingColumn({ 
                                      name: col.name, 
                                      type: col.type, 
                                      notNull: col.notnull === 1,
                                      foreignKey: { 
                                        enabled: !!fkInfo, 
                                        table: fkInfo?.table || '', 
                                        column: fkInfo?.to || '' 
                                      }
                                    })
                                  }}
                                  class="text-xs text-blue-600 hover:text-blue-500"
                                >
                                  Modify
                                </button>
                                <button
                                  onClick={() => handleDropColumn(col.name)}
                                  class="text-xs text-red-600 hover:text-red-500"
                                >
                                  Drop
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Add new column form */}
                    <div class="border-t pt-4">
                      <h5 class="text-xs font-medium text-gray-700 mb-2">Add Column</h5>
                      <form onSubmit={handleAddColumn}>
                        <div class="flex space-x-2">
                          <input
                            type="text"
                            value={newColumn.name}
                            onInput={(e) => setNewColumn({ ...newColumn, name: (e.target as HTMLInputElement).value })}
                            placeholder="column_name"
                            pattern="[a-zA-Z_][a-zA-Z0-9_]*"
                            class="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            required
                          />
                          <select
                            value={newColumn.type}
                            onChange={(e) => setNewColumn({ ...newColumn, type: (e.target as HTMLSelectElement).value })}
                            class="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          >
                            <option value="TEXT">TEXT</option>
                            <option value="INTEGER">INTEGER</option>
                            <option value="REAL">REAL</option>
                            <option value="BLOB">BLOB</option>
                            <option value="BOOLEAN">BOOLEAN</option>
                          </select>
                          
                          <label class="flex items-center space-x-1">
                            <input
                              type="checkbox"
                              checked={newColumn.notNull}
                              onChange={(e) => setNewColumn({ ...newColumn, notNull: (e.target as HTMLInputElement).checked })}
                              class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span class="text-xs text-gray-700">NN</span>
                          </label>
                          
                          <label class="flex items-center space-x-1">
                            <input
                              type="checkbox"
                              checked={newColumn.foreignKey?.enabled}
                              onChange={(e) => setNewColumn({ 
                                ...newColumn, 
                                foreignKey: { 
                                  ...newColumn.foreignKey, 
                                  enabled: (e.target as HTMLInputElement).checked,
                                  column: (e.target as HTMLInputElement).checked ? 'id' : ''
                                } 
                              })}
                              class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span class="text-xs text-gray-700">FK</span>
                          </label>
                          
                          <button
                            type="submit"
                            class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Add
                          </button>
                        </div>
                        
                        {/* Foreign Key Settings */}
                        {newColumn.foreignKey?.enabled && (
                          <div class="flex space-x-2 mt-2">
                            <select
                              value={newColumn.foreignKey?.table || ''}
                              onChange={(e) => setNewColumn({ 
                                ...newColumn, 
                                foreignKey: { 
                                  ...newColumn.foreignKey, 
                                  table: (e.target as HTMLSelectElement).value 
                                } 
                              })}
                              class="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            >
                              <option value="">Select table...</option>
                              {getUserTables(tables).map(table => (
                                <option key={table.name} value={table.name}>{table.name}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={newColumn.foreignKey?.column || ''}
                              onChange={(e) => setNewColumn({ 
                                ...newColumn, 
                                foreignKey: { 
                                  ...newColumn.foreignKey, 
                                  column: (e.target as HTMLInputElement).value 
                                } 
                              })}
                              placeholder="id"
                              class="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                          </div>
                        )}
                      </form>
                    </div>

                    {/* Index Management Section */}
                    <div class="border-t pt-4">
                      <div class="flex items-center justify-between mb-3">
                        <h5 class="text-xs font-medium text-gray-700">Indexes</h5>
                        <button
                          type="button"
                          onClick={() => setShowIndexManager(!showIndexManager)}
                          class="text-xs text-indigo-600 hover:text-indigo-500"
                        >
                          {showIndexManager ? 'Hide' : 'Manage Indexes'}
                        </button>
                      </div>

                      {/* Existing Indexes */}
                      <div class="space-y-2 mb-3">
                        {tableIndexes.map(index => (
                          <div key={index.name} class="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div class="flex-1">
                              <div class="flex items-center space-x-2">
                                <span class="text-sm font-medium text-gray-900">{index.name}</span>
                                {index.unique && (
                                  <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">UNIQUE</span>
                                )}
                              </div>
                              <div class="text-xs text-gray-500">
                                Columns: {index.columns.join(', ')}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDropIndex(index.name)}
                              class="text-xs text-red-600 hover:text-red-500"
                            >
                              Drop
                            </button>
                          </div>
                        ))}
                        {tableIndexes.length === 0 && (
                          <p class="text-xs text-gray-500">No custom indexes</p>
                        )}
                      </div>

                      {/* Create Index Form */}
                      {showIndexManager && (
                        <form onSubmit={handleCreateIndex} class="space-y-3 p-3 bg-blue-50 rounded-md">
                          <h6 class="text-xs font-medium text-gray-700">Create New Index</h6>
                          
                          <div>
                            <input
                              type="text"
                              value={newIndex.name}
                              onInput={(e) => setNewIndex({ ...newIndex, name: (e.target as HTMLInputElement).value })}
                              placeholder="index_name"
                              pattern="[a-zA-Z_][a-zA-Z0-9_]*"
                              class="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                              required
                            />
                          </div>

                          <div class="space-y-2">
                            <label class="text-xs text-gray-700">Columns:</label>
                            {newIndex.columns.map((column, idx) => (
                              <div key={idx} class="flex space-x-2">
                                <select
                                  value={column}
                                  onChange={(e) => {
                                    const newColumns = [...newIndex.columns]
                                    newColumns[idx] = (e.target as HTMLSelectElement).value
                                    setNewIndex({ ...newIndex, columns: newColumns })
                                  }}
                                  class="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                >
                                  <option value="">Select column...</option>
                                  {tableColumns.map(col => (
                                    <option key={col.name} value={col.name}>{col.name}</option>
                                  ))}
                                </select>
                                {newIndex.columns.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newColumns = newIndex.columns.filter((_, i) => i !== idx)
                                      setNewIndex({ ...newIndex, columns: newColumns })
                                    }}
                                    class="text-red-600 hover:text-red-500 text-sm"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setNewIndex({ ...newIndex, columns: [...newIndex.columns, ''] })}
                              class="text-xs text-indigo-600 hover:text-indigo-500"
                            >
                              Add Column
                            </button>
                          </div>

                          <div>
                            <label class="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={newIndex.unique}
                                onChange={(e) => setNewIndex({ ...newIndex, unique: (e.target as HTMLInputElement).checked })}
                                class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              <span class="text-sm text-gray-700">Unique Index</span>
                            </label>
                          </div>

                          <div class="flex space-x-2">
                            <button
                              type="submit"
                              class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              Create Index
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowIndexManager(false)
                                setNewIndex({ name: '', columns: [''], unique: false })
                              }}
                              class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                )}

                {/* Column Modification Modal */}
                {modifyingColumn && (
                  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                      <h4 class="text-lg font-medium text-gray-900 mb-4">Modify Column: {modifyingColumn.name}</h4>
                      
                      <div class="space-y-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-700">Type</label>
                          <select
                            value={modifyingColumn.type}
                            onChange={(e) => setModifyingColumn({ 
                              ...modifyingColumn, 
                              type: (e.target as HTMLSelectElement).value 
                            })}
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          >
                            <option value="TEXT">TEXT</option>
                            <option value="INTEGER">INTEGER</option>
                            <option value="REAL">REAL</option>
                            <option value="BLOB">BLOB</option>
                            <option value="BOOLEAN">BOOLEAN</option>
                          </select>
                        </div>
                        
                        <div>
                          <label class="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={modifyingColumn.notNull}
                              onChange={(e) => setModifyingColumn({ 
                                ...modifyingColumn, 
                                notNull: (e.target as HTMLInputElement).checked 
                              })}
                              class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span class="text-sm text-gray-700">NOT NULL</span>
                          </label>
                        </div>
                        
                        <div>
                          <label class="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={modifyingColumn.foreignKey.enabled}
                              onChange={(e) => setModifyingColumn({ 
                                ...modifyingColumn, 
                                foreignKey: { 
                                  ...modifyingColumn.foreignKey, 
                                  enabled: (e.target as HTMLInputElement).checked,
                                  column: (e.target as HTMLInputElement).checked ? 'id' : ''
                                } 
                              })}
                              class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span class="text-sm text-gray-700">Foreign Key</span>
                          </label>
                        </div>
                        
                        {modifyingColumn.foreignKey.enabled && (
                          <div class="space-y-2">
                            <select
                              value={modifyingColumn.foreignKey.table}
                              onChange={(e) => setModifyingColumn({ 
                                ...modifyingColumn, 
                                foreignKey: { 
                                  ...modifyingColumn.foreignKey, 
                                  table: (e.target as HTMLSelectElement).value 
                                } 
                              })}
                              class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                              <option value="">Select table...</option>
                              {getUserTables(tables).map(table => (
                                <option key={table.name} value={table.name}>{table.name}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={modifyingColumn.foreignKey.column}
                              onChange={(e) => setModifyingColumn({ 
                                ...modifyingColumn, 
                                foreignKey: { 
                                  ...modifyingColumn.foreignKey, 
                                  column: (e.target as HTMLInputElement).value 
                                } 
                              })}
                              placeholder="id"
                              class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                          </div>
                        )}
                      </div>
                      
                      <div class="mt-6 flex space-x-3">
                        <button
                          onClick={() => {
                            const changes: any = {}
                            if (modifyingColumn.type !== tableColumns.find(c => c.name === modifyingColumn.name)?.type) {
                              changes.type = modifyingColumn.type
                            }
                            const currentNotNull = tableColumns.find(c => c.name === modifyingColumn.name)?.notnull === 1
                            if (modifyingColumn.notNull !== currentNotNull) {
                              changes.notNull = modifyingColumn.notNull
                            }
                            if (modifyingColumn.foreignKey.enabled && modifyingColumn.foreignKey.table && modifyingColumn.foreignKey.column) {
                              changes.foreignKey = { table: modifyingColumn.foreignKey.table, column: modifyingColumn.foreignKey.column }
                            } else if (!modifyingColumn.foreignKey.enabled) {
                              changes.foreignKey = null
                            }
                            handleModifyColumn(modifyingColumn.name, changes)
                          }}
                          class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Apply Changes
                        </button>
                        <button
                          onClick={() => setModifyingColumn(null)}
                          class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Validation Warning Modal */}
                {validationWarning && (
                  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div class="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                      <div class="flex items-center mb-4">
                        <div class="flex-shrink-0">
                          <svg class="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <div class="ml-3">
                          <h3 class="text-lg font-medium text-gray-900">Validation Warning</h3>
                        </div>
                      </div>
                      
                      <div class="mb-4">
                        <p class="text-sm text-gray-700 mb-3">
                          The following issues were found with your changes:
                        </p>
                        <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                          <ul class="list-disc list-inside space-y-1">
                            {validationWarning.errors.map((error, idx) => (
                              <li key={idx} class="text-sm text-yellow-800">{error}</li>
                            ))}
                          </ul>
                          {validationWarning.conflictingRows > 0 && (
                            <p class="text-sm text-yellow-800 mt-2 font-medium">
                              {validationWarning.conflictingRows} rows will be affected.
                            </p>
                          )}
                        </div>
                        <p class="text-sm text-gray-600 mt-3">
                          Proceeding may result in data loss or corruption. Are you sure you want to continue?
                        </p>
                      </div>
                      
                      <div class="flex space-x-3">
                        <button
                          onClick={validationWarning.onConfirm}
                          class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Proceed Anyway
                        </button>
                        <button
                          onClick={() => setValidationWarning(null)}
                          class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confirmation Modal */}
                {confirmationModal && (
                  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                      <div class="flex items-center mb-4">
                        <div class="flex-shrink-0">
                          {confirmationModal.variant === 'danger' ? (
                            <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          ) : (
                            <svg class="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <div class="ml-3">
                          <h3 class="text-lg font-medium text-gray-900">{confirmationModal.title}</h3>
                        </div>
                      </div>
                      
                      <div class="mb-6">
                        <p class="text-sm text-gray-700">{confirmationModal.message}</p>
                      </div>
                      
                      <div class="flex space-x-3">
                        <button
                          onClick={confirmationModal.onConfirm}
                          class={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            confirmationModal.variant === 'danger' 
                              ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                              : 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                          }`}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmationModal(null)}
                          class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Record Edit Modal */}
                {editingRecord && (
                  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                      <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">Edit Record</h3>
                        <button
                          onClick={() => setEditingRecord(null)}
                          class="text-gray-400 hover:text-gray-600"
                        >
                          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {tableColumns.map(col => {
                          if (['id', 'created_at', 'updated_at'].includes(col.name)) {
                            return (
                              <div key={col.name} class="sm:col-span-2">
                                <label class="block text-sm font-medium text-gray-500">{col.name} (read-only)</label>
                                <div class="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-500">
                                  {col.name.includes('_at') && editingRecord.data[col.name] 
                                    ? formatDateTime(editingRecord.data[col.name])
                                    : editingRecord.data[col.name] || '-'
                                  }
                                </div>
                              </div>
                            )
                          }

                          const fkInfo = getForeignKeyForColumn(col.name)
                          
                          return (
                            <div key={col.name}>
                              <label class="block text-sm font-medium text-gray-700">
                                {col.name}
                                {col.notnull ? <span class="text-red-500 ml-1">*</span> : null}
                                {fkInfo && <span class="text-green-600 ml-1 text-xs">FK → {fkInfo.table}.{fkInfo.to}</span>}
                              </label>
                              {fkInfo ? (
                                <div class="relative">
                                  <input
                                    type="text"
                                    value={editingRecord.data[col.name] || ''}
                                    onInput={(e) => {
                                      const newValue = (e.target as HTMLInputElement).value
                                      setEditingRecord({
                                        ...editingRecord,
                                        data: { ...editingRecord.data, [col.name]: newValue }
                                      })
                                      
                                      // FK validation
                                      if (newValue.trim()) {
                                        validateForeignKey(newValue, fkInfo)
                                      }
                                    }}
                                    class={`mt-1 block w-full border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                                      editingRecord.data[col.name] && fkValidation[`${fkInfo.table}-${editingRecord.data[col.name]}`]
                                        ? fkValidation[`${fkInfo.table}-${editingRecord.data[col.name]}`].isValid
                                          ? 'border-green-300 bg-green-50'
                                          : 'border-red-300 bg-red-50'
                                        : 'border-gray-300'
                                    }`}
                                    placeholder={`Enter ${fkInfo.table} ID`}
                                    required={col.notnull === 1}
                                  />
                                  {editingRecord.data[col.name] && fkValidation[`${fkInfo.table}-${editingRecord.data[col.name]}`] && (
                                    <div class={`absolute left-0 top-full mt-1 text-xs px-2 py-1 rounded ${
                                      fkValidation[`${fkInfo.table}-${editingRecord.data[col.name]}`].isValid
                                        ? 'text-green-700 bg-green-100'
                                        : 'text-red-700 bg-red-100'
                                    }`}>
                                      {fkValidation[`${fkInfo.table}-${editingRecord.data[col.name]}`].isChecking
                                        ? 'Checking...'
                                        : fkValidation[`${fkInfo.table}-${editingRecord.data[col.name]}`].displayName
                                      }
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <input
                                  type={col.type === 'INTEGER' || col.type === 'REAL' ? 'number' : 'text'}
                                  value={editingRecord.data[col.name] || ''}
                                  onInput={(e) => setEditingRecord({
                                    ...editingRecord,
                                    data: { ...editingRecord.data, [col.name]: (e.target as HTMLInputElement).value }
                                  })}
                                  class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                  required={col.notnull === 1}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                      
                      <div class="mt-6 flex space-x-3">
                        <button
                          onClick={handleRecordSave}
                          class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingRecord(null)}
                          class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

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
                              <td 
                                key={col.name} 
                                class={`px-3 py-2 whitespace-nowrap text-sm text-gray-900 select-text ${
                                  !['id', 'created_at', 'updated_at'].includes(col.name) && tables.find(t => t.name === selectedTable)?.type === 'user'
                                    ? 'cursor-pointer hover:bg-gray-50' 
                                    : ''
                                }`}
                                onClick={(e) => {
                                  const cellKey = `${row.id}-${col.name}`
                                  
                                  // Skip if not editable
                                  if (['id', 'created_at', 'updated_at'].includes(col.name) || tables.find(t => t.name === selectedTable)?.type !== 'user') {
                                    return
                                  }
                                  
                                  const current = clickCount[cellKey]
                                  
                                  if (current) {
                                    // This is a second click within the timeout period
                                    clearTimeout(current.timeout)
                                    setClickCount(prev => {
                                      const newState = { ...prev }
                                      delete newState[cellKey]
                                      return newState
                                    })
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleCellDoubleClick(row.id, col.name, row[col.name])
                                  } else {
                                    // This is the first click
                                    const timeout = setTimeout(() => {
                                      setClickCount(prev => {
                                        const newState = { ...prev }
                                        delete newState[cellKey]
                                        return newState
                                      })
                                    }, 400) // 400ms window for double-click
                                    
                                    setClickCount(prev => ({
                                      ...prev,
                                      [cellKey]: { count: 1, timeout }
                                    }))
                                  }
                                }}
                                title={!['id', 'created_at', 'updated_at'].includes(col.name) && tables.find(t => t.name === selectedTable)?.type === 'user' ? 'Double-click to edit' : ''}
                              >
                                {editingCell?.rowId === row.id && editingCell?.columnName === col.name ? (
                                  <div class="relative">
                                    <input
                                      type={col.type === 'INTEGER' || col.type === 'REAL' ? 'number' : 'text'}
                                      value={editingCell?.value || ''}
                                      onInput={(e) => {
                                        if (editingCell) {
                                          const newValue = (e.target as HTMLInputElement).value
                                          setEditingCell({ ...editingCell, value: newValue })
                                          
                                          // FK validation for foreign key columns
                                          const fkInfo = getForeignKeyForColumn(col.name)
                                          if (fkInfo && newValue.trim()) {
                                            validateForeignKey(newValue, fkInfo)
                                          }
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (editingCell) {
                                          if (e.key === 'Enter' && !e.isComposing) handleCellSave(row.id, col.name, editingCell.value)
                                          if (e.key === 'Escape') handleCellCancel()
                                        }
                                      }}
                                      onBlur={() => {
                                        if (editingCell) {
                                          handleCellSave(row.id, col.name, editingCell.value)
                                        }
                                      }}
                                      class={`w-full px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                                        getForeignKeyForColumn(col.name) && editingCell?.value && fkValidation[`${getForeignKeyForColumn(col.name)?.table}-${editingCell.value}`]
                                          ? fkValidation[`${getForeignKeyForColumn(col.name)?.table}-${editingCell.value}`].isValid
                                            ? 'border-green-300 bg-green-50'
                                            : 'border-red-300 bg-red-50'
                                          : 'border-indigo-300'
                                      }`}
                                      ref={(input) => {
                                        editInputRef.current = input
                                        if (input && !hasInitializedFocus.current) {
                                          hasInitializedFocus.current = true
                                          setTimeout(() => {
                                            input.focus()
                                            // カーソルを末尾に移動（全選択はしない）
                                            const length = input.value.length
                                            input.setSelectionRange(length, length)
                                          }, 0)
                                        }
                                      }}
                                    />
                                    {getForeignKeyForColumn(col.name) && editingCell?.value && fkValidation[`${getForeignKeyForColumn(col.name)?.table}-${editingCell.value}`] && (
                                      <div class={`absolute left-0 -bottom-6 text-xs px-2 py-1 rounded ${
                                        fkValidation[`${getForeignKeyForColumn(col.name)?.table}-${editingCell.value}`].isValid
                                          ? 'text-green-700 bg-green-100'
                                          : 'text-red-700 bg-red-100'
                                      }`}>
                                        {fkValidation[`${getForeignKeyForColumn(col.name)?.table}-${editingCell.value}`].isChecking
                                          ? 'Checking...'
                                          : fkValidation[`${getForeignKeyForColumn(col.name)?.table}-${editingCell.value}`].displayName
                                        }
                                      </div>
                                    )}
                                  </div>
                                ) : col.name.includes('_at') && row[col.name] ? (
                                  formatDateTime(row[col.name])
                                ) : col.name === 'id' || col.name.endsWith('_id') ? (
                                  row[col.name] && row[col.name].length > 8 ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleIdClick(e, row[col.name], idx, col.name)
                                      }}
                                      onDblClick={(e: MouseEvent) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                      }}
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
                                <div class="flex space-x-2">
                                  <button
                                    onClick={() => {
                                      const record = tableData.find(r => r.id === row.id)
                                      if (record) {
                                        setEditingRecord({ id: row.id, data: { ...record } })
                                      }
                                    }}
                                    class="text-indigo-600 hover:text-indigo-900"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRecord(row.id)}
                                    class="text-red-600 hover:text-red-900"
                                  >
                                    Delete
                                  </button>
                                </div>
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
      
      {/* Schema History Modal */}
      {showSchemaHistory && (
        <SchemaHistory 
          onClose={() => setShowSchemaHistory(false)}
          onRestore={() => {
            loadTables()
            if (selectedTable) {
              loadTableData()
              loadTableSchema()
            }
          }}
        />
      )}
    </div>
  )
}