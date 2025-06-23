import type { Admin } from '../types'
import type { D1Database } from '../types/cloudflare'

export class Database {
  constructor(private db: D1Database) {}

  // Admins (for dashboard access)
  async createAdmin(admin: Omit<Admin, 'id' | 'createdAt' | 'updatedAt'>): Promise<Admin> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const result = await this.db
      .prepare(
        'INSERT INTO admins (id, email, name, provider, provider_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(id, admin.email, admin.name, admin.provider, admin.providerId, now, now)
      .run()

    if (!result.success) {
      throw new Error('Failed to create admin')
    }

    return {
      id,
      ...admin,
      createdAt: now,
      updatedAt: now,
    }
  }

  async getAdminById(id: string): Promise<Admin | null> {
    const result = await this.db
      .prepare('SELECT * FROM admins WHERE id = ?')
      .bind(id)
      .first<AdminRecord>()

    if (!result) return null

    return {
      id: result.id,
      email: result.email,
      name: result.name,
      provider: result.provider,
      providerId: result.provider_id,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  }

  async getAdminByEmail(email: string): Promise<Admin | null> {
    const result = await this.db
      .prepare('SELECT * FROM admins WHERE email = ?')
      .bind(email)
      .first<AdminRecord>()

    if (!result) return null

    return {
      id: result.id,
      email: result.email,
      name: result.name,
      provider: result.provider,
      providerId: result.provider_id,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  }

  // Items CRUD
  async createItem(data: { name: string; description?: string; userId?: string }) {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const result = await this.db
      .prepare(
        'INSERT INTO items (id, name, description, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(id, data.name, data.description || null, data.userId || null, now, now)
      .run()

    if (!result.success) {
      throw new Error('Failed to create item')
    }

    return {
      id,
      name: data.name,
      description: data.description || null,
      userId: data.userId || null,
      createdAt: now,
      updatedAt: now,
    }
  }

  async getItems(userId?: string, limit = 20, offset = 0) {
    let query = 'SELECT * FROM items'
    const params: (string | number)[] = []

    if (userId) {
      query += ' WHERE user_id = ?'
      params.push(userId)
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<ItemRecord>()

    return {
      items: result.results.map((item: ItemRecord) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        userId: item.user_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
      total: result.results.length,
    }
  }

  async getItemById(id: string) {
    const result = await this.db
      .prepare('SELECT * FROM items WHERE id = ?')
      .bind(id)
      .first<ItemRecord>()

    if (!result) return null

    return {
      id: result.id,
      name: result.name,
      description: result.description,
      userId: result.user_id,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  }

  async updateItem(id: string, data: { name?: string; description?: string }) {
    const now = new Date().toISOString()

    const setParts: string[] = []
    const params: (string | null)[] = []

    if (data.name !== undefined) {
      setParts.push('name = ?')
      params.push(data.name)
    }
    if (data.description !== undefined) {
      setParts.push('description = ?')
      params.push(data.description)
    }

    setParts.push('updated_at = ?')
    params.push(now)
    params.push(id)

    const result = await this.db
      .prepare(`UPDATE items SET ${setParts.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run()

    if (!result.success) {
      throw new Error('Failed to update item')
    }

    return this.getItemById(id)
  }

  async deleteItem(id: string) {
    const result = await this.db.prepare('DELETE FROM items WHERE id = ?').bind(id).run()

    if (!result.success) {
      throw new Error('Failed to delete item')
    }

    return { success: true, id }
  }
}

// Database record interfaces
interface ItemRecord {
  id: string
  name: string
  description: string | null
  user_id: string | null
  created_at: string
  updated_at: string
}

interface AdminRecord {
  id: string
  email: string
  name: string
  provider: string
  provider_id: string
  created_at: string
  updated_at: string
}
