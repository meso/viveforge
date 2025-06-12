const API_BASE = window.location.origin

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
}

export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: any
  pk: number
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}

// API client functions
export const api = {
  // Health check
  async health() {
    const response = await fetch(`${API_BASE}/api/health`)
    return response.json()
  },

  // Items
  async getItems(): Promise<{ items: Item[]; total: number; page: number; pageSize: number }> {
    const response = await fetch(`${API_BASE}/api/items`)
    if (!response.ok) {
      throw new Error('Failed to fetch items')
    }
    return response.json()
  },

  async createItem(data: { name: string; description?: string }): Promise<Item> {
    const response = await fetch(`${API_BASE}/api/items`, {
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
    const response = await fetch(`${API_BASE}/api/items/${id}`, {
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
    const response = await fetch(`${API_BASE}/api/items/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to delete item')
    }
    return response.json()
  },

  // Tables management
  async getTables(): Promise<{ tables: TableInfo[] }> {
    const response = await fetch(`${API_BASE}/api/tables`)
    if (!response.ok) {
      throw new Error('Failed to fetch tables')
    }
    return response.json()
  },

  async getTableSchema(tableName: string): Promise<{ tableName: string; columns: ColumnInfo[] }> {
    const response = await fetch(`${API_BASE}/api/tables/${tableName}/schema`)
    if (!response.ok) {
      throw new Error('Failed to fetch table schema')
    }
    return response.json()
  },

  async getTableData(tableName: string, limit = 100, offset = 0): Promise<{ data: any[]; total: number }> {
    const response = await fetch(`${API_BASE}/api/tables/${tableName}/data?limit=${limit}&offset=${offset}`)
    if (!response.ok) {
      throw new Error('Failed to fetch table data')
    }
    return response.json()
  },

  async createTable(name: string, columns: { name: string; type: string; constraints?: string; foreignKey?: { table: string; column: string } }[]): Promise<{ success: boolean; table: string }> {
    const response = await fetch(`${API_BASE}/api/tables`, {
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
    const response = await fetch(`${API_BASE}/api/tables/${tableName}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to drop table')
    }
    return response.json()
  },

  async executeSQL(sql: string, params: any[] = []): Promise<{ result: any }> {
    const response = await fetch(`${API_BASE}/api/tables/query`, {
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
}