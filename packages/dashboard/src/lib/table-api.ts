/**
 * Table API client functions
 * Handles all table-related operations including schema management, data operations, and indexing
 */

import type { ColumnInfo, ForeignKeyInfo, IndexInfo, SchemaSnapshot, TableInfo } from '../types/api'
import { fetchWithAuth } from './auth-client'

const API_BASE = window.location.origin

export const tableApi = {
  // Table management
  async getTables(): Promise<{ tables: TableInfo[] }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables`)
    if (!response.ok) {
      throw new Error('Failed to fetch tables')
    }
    return response.json()
  },

  async getTableSchema(
    tableName: string
  ): Promise<{ tableName: string; columns: ColumnInfo[]; foreignKeys: ForeignKeyInfo[] }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables/${tableName}/schema`)
    if (!response.ok) {
      throw new Error('Failed to fetch table schema')
    }
    return response.json()
  },

  async getTableData(
    tableName: string,
    limit = 100,
    offset = 0
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const response = await fetchWithAuth(
      `${API_BASE}/api/tables/${tableName}/data?limit=${limit}&offset=${offset}`
    )
    if (!response.ok) {
      throw new Error('Failed to fetch table data')
    }
    return response.json()
  },

  async createTable(
    name: string,
    columns: {
      name: string
      type: string
      constraints?: string
      foreignKey?: { table: string; column: string }
    }[]
  ): Promise<{ success: boolean; table: string }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, columns }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create table')
    }
    return response.json()
  },

  async dropTable(tableName: string): Promise<{ success: boolean; table: string }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables/${tableName}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to drop table')
    }
    return response.json()
  },

  async executeSQL(sql: string, params: unknown[] = []): Promise<{ result: unknown }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to execute SQL')
    }
    return response.json()
  },

  // Column management
  async addColumn(
    tableName: string,
    column: {
      name: string
      type: string
      constraints?: string
      foreignKey?: { table: string; column: string }
    }
  ): Promise<{ success: boolean; column: string }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables/${tableName}/columns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(column),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to add column')
    }
    return response.json()
  },

  async renameColumn(
    tableName: string,
    oldName: string,
    newName: string
  ): Promise<{ success: boolean; oldName: string; newName: string }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables/${tableName}/columns/${oldName}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ oldName, newName }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to rename column')
    }
    return response.json()
  },

  async dropColumn(
    tableName: string,
    columnName: string
  ): Promise<{ success: boolean; column: string }> {
    const response = await fetchWithAuth(
      `${API_BASE}/api/tables/${tableName}/columns/${columnName}`,
      {
        method: 'DELETE',
      }
    )
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to drop column')
    }
    return response.json()
  },

  async modifyColumn(
    tableName: string,
    columnName: string,
    changes: {
      type?: string
      notNull?: boolean
      foreignKey?: { table: string; column: string } | null
    }
  ): Promise<{ success: boolean; column: string; changes: Record<string, unknown> }> {
    const response = await fetchWithAuth(
      `${API_BASE}/api/tables/${tableName}/columns/${columnName}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(changes),
      }
    )
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to modify column')
    }
    return response.json()
  },

  async validateColumnChanges(
    tableName: string,
    columnName: string,
    changes: {
      type?: string
      notNull?: boolean
      foreignKey?: { table: string; column: string } | null
    }
  ): Promise<{ valid: boolean; errors: string[]; conflictingRows: number }> {
    const response = await fetchWithAuth(
      `${API_BASE}/api/tables/${tableName}/columns/${columnName}/validate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(changes),
      }
    )
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to validate column changes')
    }
    return response.json()
  },

  // Record management
  async insertRecord(
    tableName: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; id: string }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables/${tableName}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create record')
    }
    return response.json()
  },

  async updateRecord(
    tableName: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables/${tableName}/data/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update record')
    }
    return response.json()
  },

  async deleteRecord(tableName: string, data: { id: string }): Promise<{ success: boolean }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables/${tableName}/data/${data.id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete record')
    }
    return response.json()
  },

  // Schema snapshots
  async getSnapshots(
    limit = 20,
    offset = 0
  ): Promise<{ snapshots: SchemaSnapshot[]; total: number }> {
    const response = await fetchWithAuth(
      `${API_BASE}/api/snapshots?limit=${limit}&offset=${offset}`
    )
    if (!response.ok) {
      throw new Error('Failed to fetch snapshots')
    }
    return response.json()
  },

  async getSnapshot(id: string): Promise<SchemaSnapshot> {
    const response = await fetchWithAuth(`${API_BASE}/api/snapshots/${id}`)
    if (!response.ok) {
      throw new Error('Failed to fetch snapshot')
    }
    return response.json()
  },

  async createSnapshot(data: {
    name?: string
    description?: string
  }): Promise<{ success: boolean; id: string }> {
    const response = await fetchWithAuth(`${API_BASE}/api/snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create snapshot')
    }
    return response.json()
  },

  async restoreSnapshot(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetchWithAuth(`${API_BASE}/api/snapshots/${id}/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to restore snapshot' }))
      throw new Error(error.error || 'Failed to restore snapshot')
    }

    return response.json()
  },

  async deleteSnapshot(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetchWithAuth(`${API_BASE}/api/snapshots/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete snapshot' }))
      throw new Error(error.error || 'Failed to delete snapshot')
    }

    return response.json()
  },

  async compareSnapshots(id1: string, id2: string): Promise<Record<string, unknown>> {
    const response = await fetchWithAuth(`${API_BASE}/api/snapshots/compare/${id1}/${id2}`)
    if (!response.ok) {
      throw new Error('Failed to compare snapshots')
    }
    return response.json()
  },

  // Index management
  async getTableIndexes(tableName: string): Promise<{ indexes: IndexInfo[] }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables/${tableName}/indexes`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch table indexes')
    }
    return response.json()
  },

  async getAllIndexes(): Promise<{ indexes: IndexInfo[] }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables/indexes`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch all indexes')
    }
    return response.json()
  },

  async createIndex(
    tableName: string,
    data: { name: string; columns: string[]; unique?: boolean }
  ): Promise<{ success: boolean; index: IndexInfo }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables/${tableName}/indexes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create index')
    }
    return response.json()
  },

  async dropIndex(
    tableName: string,
    indexName: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetchWithAuth(
      `${API_BASE}/api/tables/${tableName}/indexes/${indexName}`,
      {
        method: 'DELETE',
      }
    )
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to drop index')
    }
    return response.json()
  },

  // Table access policy management
  async getTablePolicy(
    tableName: string
  ): Promise<{ table_name: string; access_policy: 'public' | 'private' | 'system' }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables/${tableName}/policy`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get table policy')
    }
    return response.json()
  },

  async updateTablePolicy(
    tableName: string,
    policy: 'public' | 'private'
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetchWithAuth(`${API_BASE}/api/tables/${tableName}/policy`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_policy: policy }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update table policy')
    }
    return response.json()
  },
}
