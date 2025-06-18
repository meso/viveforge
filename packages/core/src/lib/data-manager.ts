import { SYSTEM_TABLES } from './table-manager'
import type { D1Database, TableDataResult } from '../types/cloudflare'
import type { CountResult } from '../types/database'

export class DataManager {
  constructor(private db: D1Database) {}

  private async enableForeignKeys(): Promise<void> {
    try {
      await this.db.prepare('PRAGMA foreign_keys = ON').run()
    } catch (error) {
      console.warn('Failed to enable foreign keys:', error)
    }
  }

  // Create a record in a table
  async createRecord(tableName: string, data: Record<string, any>): Promise<void> {
    console.log('Enabling foreign keys before insert...')
    await this.enableForeignKeys()
    
    // Verify foreign keys are enabled
    const pragmaResult = await this.db.prepare('PRAGMA foreign_keys').first()
    console.log('Foreign keys status:', pragmaResult)
    
    // Check if table is protected system table (admins table is allowed)
    if (SYSTEM_TABLES.includes(tableName as any)) {
      throw new Error(`Cannot modify system table: ${tableName}`)
    }
    
    // Add timestamps if not provided
    const dataWithTimestamps = { ...data }
    const now = new Date().toISOString()
    if (!dataWithTimestamps.created_at) {
      dataWithTimestamps.created_at = now
    }
    if (!dataWithTimestamps.updated_at) {
      dataWithTimestamps.updated_at = now
    }
    
    // Build INSERT statement
    const columns = Object.keys(dataWithTimestamps)
    const values = Object.values(dataWithTimestamps)
    const placeholders = columns.map(() => '?').join(', ')
    
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
    console.log('Executing INSERT with foreign key constraints:', sql, 'Values:', values)
    console.log('Data being inserted:', dataWithTimestamps)
    
    await this.db.prepare(sql).bind(...values).run()
  }

  // Delete a record from a table
  async deleteRecord(tableName: string, id: string): Promise<void> {
    await this.enableForeignKeys()
    
    // Check if table is protected system table (admins table is allowed)
    if (SYSTEM_TABLES.includes(tableName as any)) {
      throw new Error(`Cannot modify system table: ${tableName}`)
    }
    
    await this.db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).bind(id).run()
  }

  // Get data from any table
  async getTableData(tableName: string, limit = 100, offset = 0): Promise<TableDataResult> {
    const countResult = await this.db
      .prepare(`SELECT COUNT(*) as total FROM "${tableName}"`)
      .first()

    // Check if table has created_at column for ordering
    const columns = await this.getTableColumns(tableName)
    const hasCreatedAt = columns.some(col => col.name === 'created_at')
    
    let orderClause = ''
    if (hasCreatedAt) {
      orderClause = 'ORDER BY created_at DESC'
    } else {
      // For tables without created_at, use ROWID if available
      orderClause = 'ORDER BY ROWID'
    }

    const dataResult = await this.db
      .prepare(`SELECT * FROM "${tableName}" ${orderClause} LIMIT ? OFFSET ?`)
      .bind(limit, offset)
      .all()

    return {
      data: dataResult.results,
      total: (countResult as any)?.total as number || 0
    }
  }

  // Get data from table with custom sorting
  async getTableDataWithSort(
    tableName: string, 
    limit = 100, 
    offset = 0, 
    sortBy?: string, 
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<TableDataResult> {
    const countResult = await this.db
      .prepare(`SELECT COUNT(*) as total FROM "${tableName}"`)
      .first()

    // Determine sortBy if not provided
    if (!sortBy) {
      const columns = await this.getTableColumns(tableName)
      const hasCreatedAt = columns.some(col => col.name === 'created_at')
      sortBy = hasCreatedAt ? 'created_at' : 'ROWID'
    }

    const dataResult = await this.db
      .prepare(`SELECT * FROM "${tableName}" ORDER BY "${sortBy}" ${sortOrder} LIMIT ? OFFSET ?`)
      .bind(limit, offset)
      .all()

    return {
      data: dataResult.results,
      total: (countResult as any)?.total as number || 0
    }
  }

  // Get table data with access control for user tables
  async getTableDataWithAccessControl(
    tableName: string,
    accessPolicy: 'public' | 'private',
    userId?: string,
    limit = 100,
    offset = 0,
    sortBy?: string,
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<TableDataResult> {
    // Build WHERE clause for private tables
    let whereClause = ''
    let countWhereClause = ''
    const bindings: any[] = []
    
    if (accessPolicy === 'private' && userId) {
      whereClause = ' WHERE owner_id = ?'
      countWhereClause = ' WHERE owner_id = ?'
      bindings.push(userId)
    }

    // Get total count with access control
    const countSql = `SELECT COUNT(*) as total FROM "${tableName}"${countWhereClause}`
    const countResult = await this.db
      .prepare(countSql)
      .bind(...bindings)
      .first()

    // Determine sortBy if not provided
    if (!sortBy) {
      const columns = await this.getTableColumns(tableName)
      const hasCreatedAt = columns.some(col => col.name === 'created_at')
      sortBy = hasCreatedAt ? 'created_at' : 'ROWID'
    }

    // Get data with access control and sorting
    const dataSql = `SELECT * FROM "${tableName}"${whereClause} ORDER BY "${sortBy}" ${sortOrder} LIMIT ? OFFSET ?`
    const dataBindings = [...bindings, limit, offset]
    
    const dataResult = await this.db
      .prepare(dataSql)
      .bind(...dataBindings)
      .all()

    return {
      data: dataResult.results,
      total: (countResult as any)?.total as number || 0
    }
  }

  // Get single record by ID
  async getRecordById(tableName: string, id: string): Promise<Record<string, any> | null> {
    const result = await this.db
      .prepare(`SELECT * FROM "${tableName}" WHERE id = ? LIMIT 1`)
      .bind(id)
      .first()

    return result || null
  }

  // Get single record by ID with access control
  async getRecordByIdWithAccessControl(
    tableName: string, 
    id: string, 
    accessPolicy: 'public' | 'private',
    userId?: string
  ): Promise<Record<string, any> | null> {
    let whereClause = 'WHERE id = ?'
    const bindings: any[] = [id]

    if (accessPolicy === 'private' && userId) {
      whereClause += ' AND owner_id = ?'
      bindings.push(userId)
    }

    const result = await this.db
      .prepare(`SELECT * FROM "${tableName}" ${whereClause} LIMIT 1`)
      .bind(...bindings)
      .first()

    return result || null
  }

  // Create record and return the generated ID
  async createRecordWithId(tableName: string, data: Record<string, any>): Promise<string> {
    await this.enableForeignKeys()
    
    // Check if table is protected system table (admins table is allowed)
    if (SYSTEM_TABLES.includes(tableName as any)) {
      throw new Error(`Cannot modify system table: ${tableName}`)
    }
    
    // Generate ID if not provided
    const id = data.id || this.generateId()
    const dataWithId = { ...data, id }
    
    // Add timestamps if not provided
    const now = new Date().toISOString()
    if (!(dataWithId as any).created_at) {
      (dataWithId as any).created_at = now
    }
    if (!(dataWithId as any).updated_at) {
      (dataWithId as any).updated_at = now
    }
    
    // Build INSERT statement
    const columns = Object.keys(dataWithId)
    const values = Object.values(dataWithId)
    const placeholders = columns.map(() => '?').join(', ')
    
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
    
    await this.db.prepare(sql).bind(...values).run()
    return id
  }

  // Create record with access control (auto-set owner_id for private tables)
  async createRecordWithAccessControl(
    tableName: string, 
    data: Record<string, any>,
    accessPolicy: 'public' | 'private',
    userId?: string
  ): Promise<string> {
    await this.enableForeignKeys()
    
    // Check if table is protected system table
    if (SYSTEM_TABLES.includes(tableName as any)) {
      throw new Error(`Cannot modify system table: ${tableName}`)
    }
    
    // Generate ID if not provided
    const id = data.id || this.generateId()
    const dataWithId = { ...data, id }
    
    // Add owner_id for private tables
    if (accessPolicy === 'private' && userId) {
      (dataWithId as any).owner_id = userId
    }
    
    // Add timestamps if not provided
    const now = new Date().toISOString()
    if (!(dataWithId as any).created_at) {
      (dataWithId as any).created_at = now
    }
    if (!(dataWithId as any).updated_at) {
      (dataWithId as any).updated_at = now
    }
    
    // Build INSERT statement
    const columns = Object.keys(dataWithId)
    const values = Object.values(dataWithId)
    const placeholders = columns.map(() => '?').join(', ')
    
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
    
    await this.db.prepare(sql).bind(...values).run()
    return id
  }

  // Update record
  async updateRecord(tableName: string, id: string, data: Record<string, any>): Promise<void> {
    await this.enableForeignKeys()
    
    // Check if table is protected system table (admins table is allowed)
    if (SYSTEM_TABLES.includes(tableName as any)) {
      throw new Error(`Cannot modify system table: ${tableName}`)
    }
    
    // Remove system fields from update data
    const updateData = { ...data }
    delete updateData.id
    delete updateData.created_at
    
    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString()
    
    const columns = Object.keys(updateData)
    const values = Object.values(updateData)
    const setClause = columns.map(col => `${col} = ?`).join(', ')
    
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`
    
    await this.db.prepare(sql).bind(...values, id).run()
  }

  // Generate unique ID (similar to what SQLite's randomblob would generate)
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }

  // Helper method to get table columns (simplified version)
  private async getTableColumns(tableName: string): Promise<{ name: string }[]> {
    const result = await this.db
      .prepare(`PRAGMA table_info("${tableName}")`)
      .all()

    return result.results.map((col: any) => ({ name: col.name }))
  }
}