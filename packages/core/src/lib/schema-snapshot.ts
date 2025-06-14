// Use Web Crypto API instead of Node.js crypto for Cloudflare Workers

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

export interface TableSchema {
  name: string
  sql: string
  columns: any[]
  foreignKeys: any[]
}

export class SchemaSnapshotManager {
  constructor(private db: any, private systemStorage?: any) {} // D1Database, R2Bucket

  // Get all table schemas excluding system tables
  async getAllTableSchemas(): Promise<TableSchema[]> {
    const result = await this.db
      .prepare(`
        SELECT name, sql 
        FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%' 
        AND name != '_cf_KV'
        AND name != 'schema_snapshots'
        AND name != 'schema_snapshot_counter'
        ORDER BY name
      `)
      .all()

    const schemas: TableSchema[] = []
    
    for (const table of result.results) {
      const columnsResult = await this.db
        .prepare(`PRAGMA table_info("${table.name}")`)
        .all()
      
      const foreignKeysResult = await this.db
        .prepare(`PRAGMA foreign_key_list("${table.name}")`)
        .all()
      
      schemas.push({
        name: table.name as string,
        sql: table.sql as string,
        columns: columnsResult.results,
        foreignKeys: foreignKeysResult.results
      })
    }
    
    return schemas
  }

  // Get all table data (excluding system tables)
  async getAllTableData(): Promise<{ [tableName: string]: any[] }> {
    const schemas = await this.getAllTableSchemas()
    const allData: { [tableName: string]: any[] } = {}
    
    for (const schema of schemas) {
      // Skip system tables
      if (['admins', 'sessions', 'schema_snapshots', 'schema_snapshot_counter'].includes(schema.name)) {
        continue
      }
      
      try {
        const result = await this.db
          .prepare(`SELECT * FROM "${schema.name}"`)
          .all()
        allData[schema.name] = result.results
      } catch (error) {
        console.warn(`Failed to get data for table ${schema.name}:`, error)
        allData[schema.name] = []
      }
    }
    
    return allData
  }

  // Calculate schema hash for comparison using Web Crypto API
  async calculateSchemaHash(schemas: TableSchema[]): Promise<string> {
    const schemaString = schemas
      .map(s => s.sql)
      .sort()
      .join('|')
    
    const encoder = new TextEncoder()
    const data = encoder.encode(schemaString)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // Check if schema has changed
  async hasSchemaChanged(): Promise<boolean> {
    const currentSchemas = await this.getAllTableSchemas()
    const currentHash = await this.calculateSchemaHash(currentSchemas)
    
    // Get latest snapshot
    const latestSnapshot = await this.db
      .prepare(`
        SELECT schema_hash 
        FROM schema_snapshots 
        ORDER BY version DESC 
        LIMIT 1
      `)
      .first()
    
    if (!latestSnapshot) {
      return true // No snapshots yet
    }
    
    return currentHash !== latestSnapshot.schema_hash
  }

  // Get next version number
  async getNextVersion(): Promise<number> {
    // Try to get current version
    const counter = await this.db
      .prepare('SELECT current_version FROM schema_snapshot_counter WHERE id = 1')
      .first()
    
    if (!counter) {
      // Initialize counter
      await this.db
        .prepare('INSERT INTO schema_snapshot_counter (id, current_version) VALUES (1, 0)')
        .run()
      return 1
    }
    
    const nextVersion = (counter.current_version as number) + 1
    
    // Update counter
    await this.db
      .prepare('UPDATE schema_snapshot_counter SET current_version = ? WHERE id = 1')
      .bind(nextVersion)
      .run()
    
    return nextVersion
  }

  // Create a new snapshot
  async createSnapshot(options: {
    name?: string
    description?: string
    createdBy?: string
    snapshotType?: 'manual' | 'auto' | 'pre_change'
    d1BookmarkId?: string
  } = {}): Promise<string> {
    const schemas = await this.getAllTableSchemas()
    const fullSchema = schemas.map(s => s.sql).join(';\n')
    const schemaHash = await this.calculateSchemaHash(schemas)
    const version = await this.getNextVersion()
    const id = crypto.randomUUID()
    
    // Save schema and data to R2 if available
    if (this.systemStorage) {
      try {
        // Get all table data
        const allData = await this.getAllTableData()
        
        // Save data to R2
        const dataKey = `snapshots/${id}/data.json`
        await this.systemStorage.put(dataKey, JSON.stringify(allData))
        
        // Save schema info to R2
        const schemaKey = `snapshots/${id}/schema.json`
        await this.systemStorage.put(schemaKey, JSON.stringify(schemas))
      } catch (error) {
        console.warn('Failed to save data to R2, continuing with schema-only snapshot:', error)
      }
    }
    
    await this.db
      .prepare(`
        INSERT INTO schema_snapshots (
          id, version, name, description, full_schema, tables_json, 
          schema_hash, created_by, snapshot_type, d1_bookmark_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        version,
        options.name || `Snapshot v${version}`,
        options.description || null,
        fullSchema,
        JSON.stringify(schemas),
        schemaHash,
        options.createdBy || null,
        options.snapshotType || 'manual',
        options.d1BookmarkId || null
      )
      .run()
    
    return id
  }

  // Get all snapshots
  async getSnapshots(limit = 20, offset = 0): Promise<{
    snapshots: SchemaSnapshot[]
    total: number
  }> {
    const countResult = await this.db
      .prepare('SELECT COUNT(*) as total FROM schema_snapshots')
      .first()
    
    const result = await this.db
      .prepare(`
        SELECT 
          id, version, name, description, full_schema, tables_json,
          schema_hash, created_at, created_by, snapshot_type, d1_bookmark_id
        FROM schema_snapshots 
        ORDER BY version DESC 
        LIMIT ? OFFSET ?
      `)
      .bind(limit, offset)
      .all()
    
    const snapshots = result.results.map((row: any) => ({
      id: row.id,
      version: row.version,
      name: row.name,
      description: row.description,
      fullSchema: row.full_schema,
      tablesJson: row.tables_json,
      schemaHash: row.schema_hash,
      createdAt: row.created_at,
      createdBy: row.created_by,
      snapshotType: row.snapshot_type,
      d1BookmarkId: row.d1_bookmark_id
    }))
    
    return {
      snapshots,
      total: countResult?.total as number || 0
    }
  }

  // Get single snapshot
  async getSnapshot(id: string): Promise<SchemaSnapshot | null> {
    const result = await this.db
      .prepare(`
        SELECT 
          id, version, name, description, full_schema, tables_json,
          schema_hash, created_at, created_by, snapshot_type, d1_bookmark_id
        FROM schema_snapshots 
        WHERE id = ?
      `)
      .bind(id)
      .first()
    
    if (!result) return null
    
    return {
      id: result.id,
      version: result.version,
      name: result.name,
      description: result.description,
      fullSchema: result.full_schema,
      tablesJson: result.tables_json,
      schemaHash: result.schema_hash,
      createdAt: result.created_at,
      createdBy: result.created_by,
      snapshotType: result.snapshot_type,
      d1BookmarkId: result.d1_bookmark_id
    }
  }

  // Restore from snapshot
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snapshot = await this.getSnapshot(snapshotId)
    if (!snapshot) {
      throw new Error('Snapshot not found')
    }
    
    const schemas: TableSchema[] = JSON.parse(snapshot.tablesJson)
    
    // Try to get data from R2
    let snapshotData: { [tableName: string]: any[] } = {}
    if (this.systemStorage) {
      try {
        const dataKey = `snapshots/${snapshotId}/data.json`
        const dataObject = await this.systemStorage.get(dataKey)
        if (dataObject) {
          const dataText = await dataObject.text()
          snapshotData = JSON.parse(dataText)
        }
      } catch (error) {
        console.warn('Failed to get data from R2, restoring schema only:', error)
      }
    }
    
    // Begin restoration
    // 1. Drop all user tables (exclude system tables)
    const currentTables = await this.db
      .prepare(`
        SELECT name 
        FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%' 
        AND name != '_cf_KV'
        AND name NOT IN ('admins', 'sessions', 'schema_snapshots', 'schema_snapshot_counter')
      `)
      .all()
    
    // Drop tables in reverse dependency order (simplified - may need improvement)
    for (const table of currentTables.results) {
      await this.db.prepare(`DROP TABLE IF EXISTS "${table.name}"`).run()
    }
    
    // 2. Recreate tables from snapshot
    for (const schema of schemas) {
      // Skip system tables
      if (['admins', 'sessions', 'schema_snapshots', 'schema_snapshot_counter'].includes(schema.name)) {
        continue
      }
      
      await this.db.prepare(schema.sql).run()
    }
    
    // 3. Restore data if available
    for (const [tableName, tableData] of Object.entries(snapshotData)) {
      if (tableData.length === 0) continue
      
      try {
        // Get column names from the first record
        const columns = Object.keys(tableData[0])
        const placeholders = columns.map(() => '?').join(', ')
        const insertSQL = `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${placeholders})`
        
        // Insert each record
        for (const record of tableData) {
          const values = columns.map(col => record[col])
          await this.db.prepare(insertSQL).bind(...values).run()
        }
      } catch (error) {
        console.warn(`Failed to restore data for table ${tableName}:`, error)
      }
    }
    
    // 4. Create a post-restore snapshot
    await this.createSnapshot({
      name: `Restored from v${snapshot.version}`,
      description: `Restored from snapshot: ${snapshot.name}`,
      snapshotType: 'auto'
    })
  }

  // Delete old snapshots (keep N most recent)
  async pruneSnapshots(keepCount: number): Promise<number> {
    const result = await this.db
      .prepare(`
        DELETE FROM schema_snapshots 
        WHERE id NOT IN (
          SELECT id FROM schema_snapshots 
          ORDER BY version DESC 
          LIMIT ?
        )
      `)
      .bind(keepCount)
      .run()
    
    return result.meta.changes || 0
  }
}