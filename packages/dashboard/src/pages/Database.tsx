import { useState } from 'preact/hooks'
import { DataViewer } from '../components/database/DataViewer'
import { SchemaEditor } from '../components/database/SchemaEditor'
import { TableList } from '../components/database/TableList'
import { SchemaHistory } from '../components/SchemaHistory'
import { useDatabase } from '../hooks/useDatabase'

export function DatabasePage() {
  const [showSchemaHistory, setShowSchemaHistory] = useState(false)

  const {
    tables,
    selectedTable,
    tableData,
    tableColumns,
    tableForeignKeys,
    loading,
    error,
    setSelectedTable,
    loadTables,
    loadTableData,
    loadTableSchema,
  } = useDatabase()

  const handleTableSelect = (tableName: string | null) => {
    setSelectedTable(tableName)
  }

  const handleTablesChange = () => {
    loadTables()
  }

  const handleDataChange = () => {
    loadTableData()
  }

  const handleSchemaChange = () => {
    loadTableSchema()
    loadTableData() // Refresh data as schema changes might affect display
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Database</h1>
              <p className="mt-2 text-gray-600">
                Manage your application's database tables and data
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSchemaHistory(true)}
              className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors"
            >
              Schema Snapshots
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table List - Left Column */}
          <div className="lg:col-span-1">
            <TableList
              tables={tables}
              selectedTable={selectedTable}
              onTableSelect={handleTableSelect}
              onTablesChange={handleTablesChange}
              loading={loading}
            />
          </div>

          {/* Data and Schema - Right Columns */}
          <div className="lg:col-span-2 space-y-6">
            {selectedTable ? (
              <>
                {/* Data Viewer */}
                <DataViewer
                  tableName={selectedTable}
                  tableData={tableData}
                  tableColumns={tableColumns}
                  onDataChange={handleDataChange}
                  loading={loading}
                />

                {/* Schema Editor */}
                <SchemaEditor
                  tableName={selectedTable}
                  tableColumns={tableColumns}
                  tableForeignKeys={tableForeignKeys}
                  tables={tables}
                  onSchemaChange={handleSchemaChange}
                  loading={loading}
                />
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    Select a table from the left to view and manage its data and schema
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
              setShowSchemaHistory(false)
              loadTableSchema()
              loadTables()
            }}
          />
        )}
      </div>
    </div>
  )
}
