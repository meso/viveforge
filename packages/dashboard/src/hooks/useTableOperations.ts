import { useState } from 'preact/hooks'
import { api } from '../lib/api'
import { isValidColumnName, isValidTableName } from '../utils/database'

export interface NewTableColumn {
  name: string
  type: string
  notNull: boolean
  foreignKey: {
    enabled: boolean
    table: string
    column: string
  }
}

export interface NewTableData {
  name: string
  columns: NewTableColumn[]
  indexes: { name: string; columns: string[]; unique: boolean }[]
}

export interface TableOperationsState {
  loading: boolean
  error: string | null
}

export interface TableOperationsActions {
  createTable: (tableData: NewTableData) => Promise<boolean>
  dropTable: (tableName: string) => Promise<boolean>
  changeAccessPolicy: (tableName: string, policy: 'public' | 'private') => Promise<boolean>
  createRecord: (tableName: string, data: Record<string, unknown>) => Promise<boolean>
  updateRecord: (tableName: string, id: string, data: Record<string, unknown>) => Promise<boolean>
  deleteRecord: (tableName: string, id: string) => Promise<boolean>
  addColumn: (tableName: string, column: NewTableColumn) => Promise<boolean>
  validateTableName: (name: string) => string | null
  validateColumnName: (name: string) => string | null
  clearError: () => void
}

/**
 * Custom hook for table operations (CRUD, schema changes)
 */
export const useTableOperations = (): TableOperationsState & TableOperationsActions => {
  const [state, setState] = useState<TableOperationsState>({
    loading: false,
    error: null,
  })

  const setLoading = (loading: boolean) => {
    setState((prev) => ({ ...prev, loading }))
  }

  const setError = (error: string | null) => {
    setState((prev) => ({ ...prev, error }))
  }

  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }))
  }

  // Validate table name
  const validateTableName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Table name is required'
    }

    if (!isValidTableName(name)) {
      return 'Invalid table name format. Use letters, numbers, and underscores only.'
    }

    return null
  }

  // Validate column name
  const validateColumnName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Column name is required'
    }

    if (!isValidColumnName(name)) {
      return 'Invalid column name format. Use letters, numbers, and underscores only.'
    }

    return null
  }

  // Create a new table
  const createTable = async (tableData: NewTableData): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      // Validate table name
      const tableNameError = validateTableName(tableData.name)
      if (tableNameError) {
        setError(tableNameError)
        setLoading(false)
        return false
      }

      // Validate columns
      const validColumns = tableData.columns.filter((col) => col.name.trim() !== '')
      if (validColumns.length === 0) {
        setError('At least one column is required')
        setLoading(false)
        return false
      }

      // Check for duplicate column names
      const columnNames = validColumns.map((col) => col.name.toLowerCase())
      const duplicates = columnNames.filter((name, index) => columnNames.indexOf(name) !== index)
      if (duplicates.length > 0) {
        setError(`Duplicate column names: ${duplicates.join(', ')}`)
        setLoading(false)
        return false
      }

      // Validate each column name
      for (const column of validColumns) {
        const columnError = validateColumnName(column.name)
        if (columnError) {
          setError(`Column "${column.name}": ${columnError}`)
          setLoading(false)
          return false
        }
      }

      // Prepare columns for API
      const columns = validColumns.map((col) => ({
        name: col.name,
        type: col.type,
        constraints: col.notNull ? 'NOT NULL' : undefined,
        foreignKey: col.foreignKey.enabled
          ? { table: col.foreignKey.table, column: col.foreignKey.column }
          : undefined,
      }))

      await api.createTable(tableData.name, columns)

      // Create indexes if specified
      for (const index of tableData.indexes) {
        if (index.columns.length > 0 && index.name.trim() !== '') {
          try {
            await api.createIndex(tableData.name, {
              name: index.name,
              columns: index.columns,
              unique: index.unique,
            })
          } catch (indexErr) {
            console.warn(`Failed to create index ${index.name}:`, indexErr)
            // Don't fail the entire operation for index creation
          }
        }
      }

      setLoading(false)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create table'
      setError(errorMessage)
      setLoading(false)
      return false
    }
  }

  // Drop a table
  const dropTable = async (tableName: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      await api.dropTable(tableName)
      setLoading(false)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to drop table'
      setError(errorMessage)
      setLoading(false)
      return false
    }
  }

  // Change table access policy
  const changeAccessPolicy = async (
    tableName: string,
    policy: 'public' | 'private'
  ): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      await api.updateTablePolicy(tableName, policy)
      setLoading(false)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change access policy'
      setError(errorMessage)
      setLoading(false)
      return false
    }
  }

  // Create a new record
  const createRecord = async (
    tableName: string,
    data: Record<string, unknown>
  ): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      // Filter out empty values
      const cleanData = Object.entries(data).reduce(
        (acc, [key, value]) => {
          if (value !== '' && value !== null && value !== undefined) {
            acc[key] = value
          }
          return acc
        },
        {} as Record<string, unknown>
      )

      await api.insertRecord(tableName, cleanData)
      setLoading(false)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create record'
      setError(errorMessage)
      setLoading(false)
      return false
    }
  }

  // Delete a record
  const deleteRecord = async (tableName: string, id: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      await api.deleteRecord(tableName, { id })
      setLoading(false)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete record'
      setError(errorMessage)
      setLoading(false)
      return false
    }
  }

  // Update a record
  const updateRecord = async (
    tableName: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      await api.updateRecord(tableName, id, data)
      setLoading(false)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update record'
      setError(errorMessage)
      setLoading(false)
      return false
    }
  }

  // Add a new column to an existing table
  const addColumn = async (tableName: string, column: NewTableColumn): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      // Validate column name
      const columnError = validateColumnName(column.name)
      if (columnError) {
        setError(columnError)
        setLoading(false)
        return false
      }

      const columnData = {
        name: column.name,
        type: column.type,
        constraints: column.notNull ? 'NOT NULL' : undefined,
        foreignKey: column.foreignKey.enabled
          ? { table: column.foreignKey.table, column: column.foreignKey.column }
          : undefined,
      }

      await api.addColumn(tableName, columnData)
      setLoading(false)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add column'
      setError(errorMessage)
      setLoading(false)
      return false
    }
  }

  return {
    ...state,
    createTable,
    dropTable,
    changeAccessPolicy,
    createRecord,
    updateRecord,
    deleteRecord,
    addColumn,
    validateTableName,
    validateColumnName,
    clearError,
  }
}
