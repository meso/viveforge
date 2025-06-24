import { useEffect, useState } from 'preact/hooks'
import { api, type ColumnInfo, type ForeignKeyInfo, type TableInfo } from '../lib/api'

export interface DatabaseState {
  tables: TableInfo[]
  selectedTable: string | null
  tableData: Record<string, unknown>[]
  tableColumns: ColumnInfo[]
  tableForeignKeys: ForeignKeyInfo[]
  loading: boolean
  error: string | null
}

export interface DatabaseActions {
  loadTables: () => Promise<void>
  loadTableSchema: (tableName?: string) => Promise<void>
  loadTableData: (tableName?: string) => Promise<void>
  selectTable: (tableName: string | null) => void
  setSelectedTable: (tableName: string | null) => void
  setError: (error: string | null) => void
  clearError: () => void
  refreshData: () => Promise<void>
}

/**
 * Custom hook for managing database state and operations
 */
export const useDatabase = (): DatabaseState & DatabaseActions => {
  const [state, setState] = useState<DatabaseState>({
    tables: [],
    selectedTable: null,
    tableData: [],
    tableColumns: [],
    tableForeignKeys: [],
    loading: false,
    error: null,
  })

  // Load all tables
  const loadTables = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const response = await api.getTables()
      setState((prev) => ({
        ...prev,
        tables: response.tables || [],
        loading: false,
      }))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tables'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
    }
  }

  // Load table schema (columns and foreign keys)
  const loadTableSchema = async (tableName?: string) => {
    const table = tableName || state.selectedTable
    if (!table) return

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const response = await api.getTableSchema(table)

      setState((prev) => ({
        ...prev,
        tableColumns: response.columns || [],
        tableForeignKeys: response.foreignKeys || [],
        loading: false,
      }))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load table schema'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
    }
  }

  // Load table data
  const loadTableData = async (tableName?: string) => {
    const table = tableName || state.selectedTable
    if (!table) return

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const response = await api.getTableData(table)
      setState((prev) => ({
        ...prev,
        tableData: response.data || [],
        loading: false,
      }))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load table data'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }))
    }
  }

  // Select a table and load its data
  const selectTable = (tableName: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedTable: tableName,
      tableData: [],
      tableColumns: [],
      tableForeignKeys: [],
    }))

    if (tableName) {
      loadTableSchema(tableName)
      loadTableData(tableName)
    }
  }

  // Alias for selectTable for backward compatibility
  const setSelectedTable = selectTable

  // Set error state
  const setError = (error: string | null) => {
    setState((prev) => ({ ...prev, error }))
  }

  // Clear error state
  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }))
  }

  // Refresh all data
  const refreshData = async () => {
    await loadTables()
    if (state.selectedTable) {
      await Promise.all([loadTableSchema(state.selectedTable), loadTableData(state.selectedTable)])
    }
  }

  // Load tables on mount
  useEffect(() => {
    loadTables()
  }, [])

  return {
    ...state,
    loadTables,
    loadTableSchema,
    loadTableData,
    selectTable,
    setSelectedTable,
    setError,
    clearError,
    refreshData,
  }
}
