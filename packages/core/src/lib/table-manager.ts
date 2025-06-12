// D1Database type from Cloudflare Workers

// System tables that cannot be modified by users
const SYSTEM_TABLES = ['admins', 'sessions'] as const
type SystemTable = typeof SYSTEM_TABLES[number]

export interface TableInfo {
  name: string
  type: 'system' | 'user'
  sql: string // CREATE TABLE statement
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

export class TableManager {
  constructor(private db: any) {} // D1Database type

  private async enableForeignKeys(): Promise<void> {
    try {
      await this.db.prepare('PRAGMA foreign_keys = ON').run()
    } catch (error) {
      console.warn('Failed to enable foreign keys:', error)
    }
  }

  // Get all tables with their types
  async getTables(): Promise<TableInfo[]> {
    await this.enableForeignKeys()
    const result = await this.db
      .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_cf_KV'")
      .all()

    const tables: TableInfo[] = []
    
    for (const row of result.results) {
      const name = row.name as string
      const isSystem = SYSTEM_TABLES.includes(name as SystemTable)
      
      // Get row count for each table
      let rowCount = 0
      try {
        const countResult = await this.db
          .prepare(`SELECT COUNT(*) as count FROM "${name}"`)
          .first()
        rowCount = countResult?.count as number || 0
      } catch (e) {
        console.warn(`Could not get row count for table ${name}:`, e)
      }
      
      tables.push({
        name,
        type: isSystem ? 'system' : 'user',
        sql: row.sql as string,
        rowCount
      })
    }

    return tables.sort((a, b) => {
      // System tables first, then alphabetical
      if (a.type !== b.type) return a.type === 'system' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  // Get columns for a specific table
  async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    const result = await this.db
      .prepare(`PRAGMA table_info("${tableName}")`)
      .all()

    return result.results as ColumnInfo[]
  }

  // Create a new user table
  async createTable(tableName: string, columns: { name: string; type: string; constraints?: string; foreignKey?: { table: string; column: string } }[]): Promise<void> {
    await this.enableForeignKeys()
    // Validate table name
    if (SYSTEM_TABLES.includes(tableName as SystemTable)) {
      throw new Error(`Cannot create system table: ${tableName}`)
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error('Invalid table name. Use only letters, numbers, and underscores.')
    }

    // Build CREATE TABLE statement
    const columnDefs = columns.map(col => {
      let def = `${col.name} ${col.type}`
      if (col.constraints) def += ` ${col.constraints}`
      return def
    }).join(', ')

    // Build foreign key constraints
    const foreignKeys = columns
      .filter(col => col.foreignKey)
      .map(col => `FOREIGN KEY (${col.name}) REFERENCES ${col.foreignKey!.table}(${col.foreignKey!.column})`)
      .join(', ')

    const sql = `CREATE TABLE ${tableName} (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      ${columnDefs},
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP${foreignKeys ? `, ${foreignKeys}` : ''}
    )`

    console.log('Creating table with SQL:', sql)
    await this.db.prepare(sql).run()
  }

  // Drop a user table
  async dropTable(tableName: string): Promise<void> {
    // Prevent dropping system tables
    if (SYSTEM_TABLES.includes(tableName as SystemTable)) {
      throw new Error(`Cannot drop system table: ${tableName}`)
    }

    await this.db.prepare(`DROP TABLE IF EXISTS ${tableName}`).run()
  }

  // Create a record in a table
  async createRecord(tableName: string, data: Record<string, any>): Promise<void> {
    console.log('Enabling foreign keys before insert...')
    await this.enableForeignKeys()
    
    // Verify foreign keys are enabled
    const pragmaResult = await this.db.prepare('PRAGMA foreign_keys').first()
    console.log('Foreign keys status:', pragmaResult)
    
    // Check if table is system table
    if (SYSTEM_TABLES.includes(tableName as SystemTable)) {
      throw new Error(`Cannot modify system table: ${tableName}`)
    }
    
    // Build INSERT statement
    const columns = Object.keys(data)
    const values = Object.values(data)
    const placeholders = columns.map(() => '?').join(', ')
    
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
    console.log('Executing INSERT with foreign key constraints:', sql, 'Values:', values)
    console.log('Data being inserted:', data)
    
    await this.db.prepare(sql).bind(...values).run()
  }

  // Delete a record from a table
  async deleteRecord(tableName: string, id: string): Promise<void> {
    await this.enableForeignKeys()
    
    // Check if table is system table
    if (SYSTEM_TABLES.includes(tableName as SystemTable)) {
      throw new Error(`Cannot modify system table: ${tableName}`)
    }
    
    await this.db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).bind(id).run()
  }

  // Get data from any table
  async getTableData(tableName: string, limit = 100, offset = 0): Promise<{ data: any[], total: number }> {
    const countResult = await this.db
      .prepare(`SELECT COUNT(*) as total FROM "${tableName}"`)
      .first()

    const dataResult = await this.db
      .prepare(`SELECT * FROM "${tableName}" ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(limit, offset)
      .all()

    return {
      data: dataResult.results,
      total: countResult?.total as number || 0
    }
  }

  // Execute custom SQL (with safety checks)
  async executeSQL(sql: string, params: any[] = []): Promise<any> {
    // Basic SQL injection prevention
    const normalizedSQL = sql.trim().toUpperCase()
    
    // Only allow SELECT for now
    if (!normalizedSQL.startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed in the SQL editor')
    }

    // Prevent modification of system tables
    for (const systemTable of SYSTEM_TABLES) {
      if (normalizedSQL.includes(systemTable.toUpperCase())) {
        throw new Error(`Cannot query system table: ${systemTable}`)
      }
    }

    const result = await this.db
      .prepare(sql)
      .bind(...params)
      .all()

    return result
  }
}