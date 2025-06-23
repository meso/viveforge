const API_BASE = window.location.origin

// Helper function to handle authentication errors
function handleAuthError() {
  // Prevent redirect loop
  if (window.location.pathname === '/auth/login') {
    return
  }

  console.warn('Authentication required, redirecting to login...')
  window.location.href = '/auth/login'
}

// Enhanced fetch with authentication error handling
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, options)

  // Check for authentication errors
  if (response.status === 401) {
    handleAuthError()
    // Throw error to prevent further processing
    throw new Error('Authentication required')
  }

  return response
}

export interface Item {
  id: string
  name: string
  description?: string
  userId?: string
  createdAt: string
  updatedAt: string
}

export interface TableInfo {
  name: string
  type: 'system' | 'user'
  sql: string
  rowCount?: number
  access_policy?: 'public' | 'private'
}

export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: any
  pk: number
}

export interface ForeignKeyInfo {
  from: string
  table: string
  to: string
}

export interface IndexInfo {
  name: string
  tableName: string
  columns: string[]
  unique: boolean
  sql: string
}

export interface OAuthProvider {
  id: string
  provider: string
  client_id: string
  client_secret: string
  is_enabled: boolean
  scopes: string[]
  redirect_uri?: string
  created_at: string
  updated_at: string
}

export interface SupportedProvider {
  provider: string
  name: string
  default_scopes: string[]
  setup_instructions: string
  note?: string
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface SchemaSnapshot {
  id: string
  version: number
  name?: string
  description?: string
  fullSchema: string
  tablesJson: string
  schemaHash: string
  createdAt: string
  createdBy?: string
  snapshotType: 'manual' | 'auto' | 'pre_change'
  d1BookmarkId?: string
}

// API client functions
export const api = {
  // Health check
  async health() {
    const response = await fetchWithAuth(`${API_BASE}/api/health`)
    return response.json()
  },

  // Items
  async getItems(): Promise<{ items: Item[]; total: number; page: number; pageSize: number }> {
    const response = await fetchWithAuth(`${API_BASE}/api/items`)
    if (!response.ok) {
      throw new Error('Failed to fetch items')
    }
    return response.json()
  },

  async createItem(data: { name: string; description?: string }): Promise<Item> {
    const response = await fetchWithAuth(`${API_BASE}/api/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to create item')
    }
    return response.json()
  },

  async updateItem(id: string, data: { name?: string; description?: string }): Promise<Item> {
    const response = await fetchWithAuth(`${API_BASE}/api/items/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to update item')
    }
    return response.json()
  },

  async deleteItem(id: string): Promise<{ success: boolean; id: string }> {
    const response = await fetchWithAuth(`${API_BASE}/api/items/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to delete item')
    }
    return response.json()
  },

  // Tables management
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
  ): Promise<{ data: any[]; total: number }> {
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

  async executeSQL(sql: string, params: any[] = []): Promise<{ result: any }> {
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
  ): Promise<{ success: boolean; column: string; changes: any }> {
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
  async updateRecord(
    tableName: string,
    id: string,
    data: Record<string, any>
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

  async compareSnapshots(id1: string, id2: string): Promise<any> {
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

  // OAuth Provider management
  async getOAuthProviders(): Promise<{ providers: OAuthProvider[] }> {
    const response = await fetchWithAuth(`${API_BASE}/api/admin/oauth/providers`)
    if (!response.ok) {
      let errorMessage = 'Failed to fetch OAuth providers'
      try {
        const error = await response.json()
        if (error.error === 'Authentication required') {
          errorMessage = 'Admin authentication required. Please log in to access OAuth settings.'
        } else {
          errorMessage = error.error || errorMessage
        }
      } catch {
        // If JSON parsing fails, use default message
      }
      throw new Error(errorMessage)
    }
    return response.json()
  },

  async getOAuthProvider(provider: string): Promise<{ provider: OAuthProvider }> {
    const response = await fetchWithAuth(`${API_BASE}/api/admin/oauth/providers/${provider}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch OAuth provider')
    }
    return response.json()
  },

  async updateOAuthProvider(
    provider: string,
    data: {
      client_id: string
      client_secret: string
      is_enabled?: boolean
      scopes?: string[]
      redirect_uri?: string
    }
  ): Promise<{ success: boolean; message: string; provider: any }> {
    const response = await fetchWithAuth(`${API_BASE}/api/admin/oauth/providers/${provider}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update OAuth provider')
    }
    return response.json()
  },

  async toggleOAuthProvider(
    provider: string,
    enabled: boolean
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetchWithAuth(
      `${API_BASE}/api/admin/oauth/providers/${provider}/toggle`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_enabled: enabled }),
      }
    )
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to toggle OAuth provider')
    }
    return response.json()
  },

  async deleteOAuthProvider(provider: string): Promise<{ success: boolean; message: string }> {
    const response = await fetchWithAuth(`${API_BASE}/api/admin/oauth/providers/${provider}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete OAuth provider')
    }
    return response.json()
  },

  async getSupportedProviders(): Promise<{ supported_providers: SupportedProvider[] }> {
    const response = await fetchWithAuth(`${API_BASE}/api/admin/oauth/supported-providers`)
    if (!response.ok) {
      let errorMessage = 'Failed to fetch supported providers'
      try {
        const error = await response.json()
        if (error.error === 'Authentication required') {
          errorMessage = 'Admin authentication required. Please log in to access OAuth settings.'
        } else {
          errorMessage = error.error || errorMessage
        }
      } catch {
        // If JSON parsing fails, use default message
      }
      throw new Error(errorMessage)
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
