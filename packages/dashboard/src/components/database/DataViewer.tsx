import { useRef, useState } from 'preact/hooks'
import { useTableOperations } from '../../hooks/useTableOperations'
import type { ColumnInfo, ForeignKeyInfo } from '../../lib/api'
import { copyToClipboard, formatDateTime, isIdValue, truncateId } from '../../utils/database'

interface DataViewerProps {
  tableName: string
  tableData: Record<string, unknown>[]
  tableColumns: ColumnInfo[]
  tableForeignKeys: ForeignKeyInfo[]
  onDataChange: () => void // Callback when data is modified
  onTableSelect: (tableName: string | null, highlightRecordId?: string) => void // Callback to switch tables
  highlightRecordId?: string // ID of record to highlight
  loading: boolean
}

interface EditingCell {
  rowId: string
  columnName: string
  value: unknown
}

interface EditingRecord {
  id: string
  data: Record<string, unknown>
}

export function DataViewer({
  tableName,
  tableData,
  tableColumns,
  tableForeignKeys,
  onDataChange,
  onTableSelect,
  highlightRecordId,
  loading,
}: DataViewerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newRecord, setNewRecord] = useState<Record<string, unknown>>({})
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [editingRecord, setEditingRecord] = useState<EditingRecord | null>(null)
  const [copiedCell, setCopiedCell] = useState<string | null>(null)
  const hasInitializedFocus = useRef(false)

  const {
    createRecord,
    updateRecord,
    deleteRecord,
    loading: operationsLoading,
    error: operationsError,
    clearError,
  } = useTableOperations()

  // Helper function to check if a column has foreign key constraint
  const hasForeignKey = (columnName: string): boolean => {
    return tableForeignKeys.some((fk) => fk.from === columnName)
  }

  // Handle create record form submission
  const handleCreateRecord = async (e: Event) => {
    e.preventDefault()
    clearError()

    const success = await createRecord(tableName, newRecord)
    if (success) {
      setNewRecord({})
      setShowCreateForm(false)
      onDataChange()
    }
  }

  // Handle delete record
  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return
    }

    const success = await deleteRecord(tableName, id)
    if (success) {
      onDataChange()
    }
  }

  // Handle cell click for inline editing
  const handleCellClick = (rowId: string, columnName: string, currentValue: unknown) => {
    // Don't edit system columns
    if (['id', 'created_at', 'updated_at'].includes(columnName)) {
      return
    }

    // Check if this field has foreign key references
    const column = tableColumns.find((col) => col.name === columnName)
    const hasFK = column && columnName.endsWith('_id') && isIdValue(currentValue)

    if (hasFK || !column) {
      // Open modal for FK references or complex fields
      const record = tableData.find((row) => row.id === rowId)
      if (record) {
        setEditingRecord({ id: rowId, data: { ...record } })
      }
    } else {
      // Inline editing for simple fields
      hasInitializedFocus.current = false
      setEditingCell({ rowId, columnName, value: currentValue })
    }
  }

  // Save inline cell edit
  const handleCellSave = async (rowId: string, columnName: string, newValue: unknown) => {
    console.log('Cell save:', { rowId, columnName, newValue })
    clearError()

    const success = await updateRecord(tableName, rowId, { [columnName]: newValue })
    if (success) {
      setEditingCell(null)
      onDataChange()
    }
  }

  // Cancel inline cell edit
  const handleCellCancel = () => {
    setEditingCell(null)
  }

  // Handle record edit via modal
  const handleRecordSave = async () => {
    if (!editingRecord) return

    console.log('Record save:', editingRecord)
    clearError()

    // Remove system fields from the update data
    const updateData = { ...editingRecord.data }
    delete updateData.id
    delete updateData.created_at
    delete updateData.updated_at

    const success = await updateRecord(tableName, editingRecord.id, updateData)
    if (success) {
      setEditingRecord(null)
      onDataChange()
    }
  }

  // Handle copy ID to clipboard
  const handleCopyId = async (id: string, rowIndex: number, columnName: string) => {
    const success = await copyToClipboard(id)
    if (success) {
      setCopiedCell(`${rowIndex}-${columnName}`)
      setTimeout(() => setCopiedCell(null), 2000)
    }
  }

  // Jump to record with specific ID using FK constraint information
  const jumpToRecord = async (id: string, columnName: string) => {
    // Find the foreign key constraint for this column
    const foreignKey = tableForeignKeys.find((fk) => fk.from === columnName)

    if (!foreignKey) {
      console.warn(`No foreign key constraint found for column: ${columnName}`)
      return
    }

    // Switch to the target table with highlighting
    onTableSelect(foreignKey.table, id)
  }

  if (!tableName) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">Select a table to view its data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">{tableName} Data</h2>
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            disabled={loading || operationsLoading}
          >
            Add Record
          </button>
        </div>

        {operationsError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : tableData.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No records found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {tableColumns.map((column) => (
                  <th
                    key={column.name}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {column.name}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tableData.map((row, rowIndex) => {
                const isHighlighted = highlightRecordId === row.id
                return (
                  <tr
                    key={row.id as string}
                    className={`${isHighlighted ? 'bg-yellow-100 border-yellow-300' : 'hover:bg-gray-50'} ${isHighlighted ? 'transition-colors duration-1000' : ''}`}
                  >
                    {tableColumns.map((column) => {
                      const value = row[column.name]
                      const cellKey = `${rowIndex}-${column.name}`
                      const isEditing =
                        editingCell?.rowId === row.id && editingCell?.columnName === column.name
                      const isCopied = copiedCell === cellKey
                      const isSystemColumn = ['id', 'created_at', 'updated_at'].includes(
                        column.name
                      )

                      return (
                        <td
                          key={column.name}
                          className={`px-4 py-3 text-sm relative ${
                            isSystemColumn ? 'text-gray-500' : 'text-gray-900'
                          } ${!isSystemColumn ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                          onClick={() =>
                            !isEditing && handleCellClick(row.id as string, column.name, value)
                          }
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && !isEditing) {
                              handleCellClick(row.id as string, column.name, value)
                            }
                          }}
                          tabIndex={!isSystemColumn ? 0 : -1}
                          role={!isSystemColumn ? 'button' : undefined}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingCell.value as string}
                              onChange={(e) =>
                                setEditingCell((prev) =>
                                  prev ? { ...prev, value: e.currentTarget.value } : null
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCellSave(row.id as string, column.name, editingCell.value)
                                } else if (e.key === 'Escape') {
                                  handleCellCancel()
                                }
                              }}
                              onBlur={() =>
                                handleCellSave(row.id as string, column.name, editingCell.value)
                              }
                              className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>
                                {['created_at', 'updated_at'].includes(column.name)
                                  ? formatDateTime(value as string)
                                  : isIdValue(value)
                                    ? truncateId(value as string)
                                    : value === null
                                      ? 'NULL'
                                      : value === ''
                                        ? '(empty)'
                                        : String(value)}
                              </span>

                              {(isIdValue(value) || hasForeignKey(column.name)) && (
                                <div className="flex gap-1">
                                  {/* Copy button: show for nanoid values */}
                                  {isIdValue(value) && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleCopyId(value as string, rowIndex, column.name)
                                      }}
                                      className={`p-1 rounded text-xs ${
                                        isCopied
                                          ? 'bg-green-100 text-green-600'
                                          : 'hover:bg-gray-100 text-gray-400'
                                      }`}
                                      title="Copy to clipboard"
                                    >
                                      {isCopied ? '✓' : '📋'}
                                    </button>
                                  )}

                                  {/* Link button: show for FK constraints */}
                                  {hasForeignKey(column.name) && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        jumpToRecord(value as string, column.name)
                                      }}
                                      className="p-1 hover:bg-gray-100 text-gray-400 rounded text-xs"
                                      title="Jump to related record"
                                    >
                                      🔗
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-sm">
                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(row.id as string)}
                        className="text-red-600 hover:text-red-800 text-sm"
                        disabled={operationsLoading}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Record Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Add New Record</h3>

            <form onSubmit={handleCreateRecord} className="space-y-4">
              {tableColumns
                .filter((col) => !['id', 'created_at', 'updated_at'].includes(col.name))
                .map((column) => (
                  <div key={column.name}>
                    <label
                      htmlFor={`new-${column.name}`}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {column.name}
                      {column.notnull === 1 && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      id={`new-${column.name}`}
                      type="text"
                      value={(newRecord[column.name] as string) || ''}
                      onChange={(e) =>
                        setNewRecord((prev) => ({
                          ...prev,
                          [column.name]: e.currentTarget.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Enter ${column.name}`}
                      required={column.notnull === 1}
                    />
                  </div>
                ))}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewRecord({})
                    clearError()
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={operationsLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
                  disabled={operationsLoading}
                >
                  {operationsLoading ? 'Creating...' : 'Create Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Edit Record</h3>

            <div className="space-y-4">
              {tableColumns.map((column) => (
                <div key={column.name}>
                  <label
                    htmlFor={`edit-${column.name}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {column.name}
                    {['id', 'created_at', 'updated_at'].includes(column.name) && (
                      <span className="text-gray-500 text-xs ml-1">(read-only)</span>
                    )}
                  </label>
                  <input
                    id={`edit-${column.name}`}
                    type="text"
                    value={(editingRecord.data[column.name] as string) || ''}
                    onChange={(e) =>
                      setEditingRecord((prev) =>
                        prev
                          ? {
                              ...prev,
                              data: { ...prev.data, [column.name]: e.currentTarget.value },
                            }
                          : null
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={['id', 'created_at', 'updated_at'].includes(column.name)}
                  />
                </div>
              ))}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRecordSave}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
