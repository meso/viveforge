import type { Env, User } from '../types'

export class Database {
  constructor(private db: D1Database) {}

  // Users
  async createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    
    const result = await this.db
      .prepare('INSERT INTO users (id, email, name, provider, provider_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, user.email, user.name, user.provider, user.providerId, now, now)
      .run()

    if (!result.success) {
      throw new Error('Failed to create user')
    }

    return {
      id,
      ...user,
      createdAt: now,
      updatedAt: now,
    }
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first()

    if (!result) return null

    return {
      id: result.id as string,
      email: result.email as string,
      name: result.name as string,
      provider: result.provider as string,
      providerId: result.provider_id as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string,
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first()

    if (!result) return null

    return {
      id: result.id as string,
      email: result.email as string,
      name: result.name as string,
      provider: result.provider as string,
      providerId: result.provider_id as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string,
    }
  }

  // Items CRUD
  async createItem(data: { name: string; description?: string; userId?: string }) {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const result = await this.db
      .prepare('INSERT INTO items (id, name, description, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
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
    let params: any[] = []

    if (userId) {
      query += ' WHERE user_id = ?'
      params.push(userId)
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all()

    return {
      items: result.results.map((item: any) => ({
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
      .first()

    if (!result) return null

    return {
      id: result.id as string,
      name: result.name as string,
      description: result.description as string,
      userId: result.user_id as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string,
    }
  }

  async updateItem(id: string, data: { name?: string; description?: string }) {
    const now = new Date().toISOString()
    
    const setParts = []
    const params = []

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
    const result = await this.db
      .prepare('DELETE FROM items WHERE id = ?')
      .bind(id)
      .run()

    if (!result.success) {
      throw new Error('Failed to delete item')
    }

    return { success: true, id }
  }

  // Projects
  async createProject(data: { name: string; description?: string; ownerId: string }) {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const result = await this.db
      .prepare('INSERT INTO projects (id, name, description, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, data.name, data.description || null, data.ownerId, now, now)
      .run()

    if (!result.success) {
      throw new Error('Failed to create project')
    }

    return {
      id,
      name: data.name,
      description: data.description || null,
      ownerId: data.ownerId,
      createdAt: now,
      updatedAt: now,
    }
  }

  async getProjects(ownerId: string) {
    const result = await this.db
      .prepare('SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC')
      .bind(ownerId)
      .all()

    return result.results.map((project: any) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.owner_id,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    }))
  }
}