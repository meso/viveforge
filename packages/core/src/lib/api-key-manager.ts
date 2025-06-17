import { nanoid } from 'nanoid'
import { createHash } from 'node:crypto'

export interface APIKey {
  id: string
  name: string
  key_hash: string
  key_prefix: string
  scopes: string[]
  created_by: string
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
}

export interface CreateAPIKeyRequest {
  name: string
  scopes: string[]
  expires_in_days?: number
}

export interface CreateAPIKeyResponse {
  id: string
  name: string
  key: string // Only returned once during creation
  scopes: string[]
  expires_at: string | null
}

export class APIKeyManager {
  constructor(private db: D1Database) {}

  /**
   * Initialize API keys table
   */
  async initializeTable(): Promise<void> {
    // First try to create the table
    try {
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          name TEXT NOT NULL,
          key_hash TEXT UNIQUE NOT NULL,
          key_prefix TEXT NOT NULL,
          scopes TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_used_at DATETIME,
          expires_at DATETIME,
          is_active INTEGER DEFAULT 1,
          FOREIGN KEY (created_by) REFERENCES admins(id)
        )
      `).run()
    } catch (error) {
      throw error
    }

    // Then create indexes separately
    try {
      await this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`).run()
      await this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active)`).run()
      await this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by)`).run()
    } catch (error) {
      // Don't throw here as indexes are not critical
    }
  }

  /**
   * Generate a new API key
   */
  generateAPIKey(): { key: string; hash: string; prefix: string } {
    // Format: vb_live_1234567890abcdef...
    const prefix = 'vb_live'
    const secret = nanoid(32)
    const key = `${prefix}_${secret}`
    const hash = createHash('sha256').update(key).digest('hex')
    
    return {
      key,
      hash,
      prefix: `${prefix}_${secret.substring(0, 8)}...`
    }
  }

  /**
   * Create a new API key
   */
  async createAPIKey(
    request: CreateAPIKeyRequest,
    createdBy: string
  ): Promise<CreateAPIKeyResponse> {
    const { key, hash, prefix } = this.generateAPIKey()
    
    const expiresAt = request.expires_in_days 
      ? new Date(Date.now() + request.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
      : null

    // Generate ID manually since D1 might not support RETURNING
    const id = nanoid()

    await this.db.prepare(`
      INSERT INTO api_keys (id, name, key_hash, key_prefix, scopes, created_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      request.name,
      hash,
      prefix,
      JSON.stringify(request.scopes),
      createdBy,
      expiresAt
    ).run()

    return {
      id,
      name: request.name,
      key, // Only returned here!
      scopes: request.scopes,
      expires_at: expiresAt
    }
  }

  /**
   * Verify an API key and return associated information
   */
  async verifyAPIKey(key: string): Promise<APIKey | null> {
    const hash = createHash('sha256').update(key).digest('hex')
    
    const result = await this.db.prepare(`
      SELECT * FROM api_keys 
      WHERE key_hash = ? AND is_active = 1
    `).bind(hash).first<APIKey>()

    if (!result) {
      return null
    }

    // Check expiration
    if (result.expires_at && new Date(result.expires_at) < new Date()) {
      return null
    }

    // Update last used timestamp
    await this.db.prepare(`
      UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(result.id).run()

    // Parse scopes
    result.scopes = JSON.parse(result.scopes as any)
    
    // Convert is_active to boolean
    result.is_active = Boolean(result.is_active)

    return result
  }

  /**
   * List API keys for a user (without sensitive data)
   */
  async listAPIKeys(createdBy: string): Promise<Omit<APIKey, 'key_hash'>[]> {
    const results = await this.db.prepare(`
      SELECT id, name, key_prefix, scopes, created_by, created_at, last_used_at, expires_at, is_active
      FROM api_keys 
      WHERE created_by = ?
      ORDER BY created_at DESC
    `).bind(createdBy).all<Omit<APIKey, 'key_hash'>>()

    return results.results.map(key => ({
      ...key,
      scopes: JSON.parse(key.scopes as any),
      is_active: Boolean(key.is_active)
    }))
  }

  /**
   * Revoke an API key
   */
  async revokeAPIKey(id: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db.prepare(`
        UPDATE api_keys 
        SET is_active = 0 
        WHERE id = ? AND created_by = ?
      `).bind(id, userId).run()
      
      // D1 might return success property instead of changes
      if (result.success !== undefined) {
        return result.success
      }
      
      // Try to check if the row was actually updated
      if (result.meta && typeof result.meta.changes === 'number') {
        return result.meta.changes > 0
      }
      
      // Fallback: check if the operation succeeded
      return true
      
    } catch (error) {
      throw error
    }
  }

  /**
   * Delete an API key permanently
   */
  async deleteAPIKey(id: string, userId: string): Promise<boolean> {
    const result = await this.db.prepare(`
      DELETE FROM api_keys 
      WHERE id = ? AND created_by = ?
    `).bind(id, userId).run()

    return (result as any).changes > 0
  }
}

// Default scopes
export const API_SCOPES = {
  // Data operations
  'data:read': 'Read data from tables',
  'data:write': 'Create and update data in tables',
  'data:delete': 'Delete data from tables',
  
  // Table operations
  'tables:read': 'View table schemas',
  'tables:write': 'Create and modify table schemas',
  'tables:delete': 'Delete tables',
  
  // Storage operations
  'storage:read': 'Read files from storage',
  'storage:write': 'Upload files to storage',
  'storage:delete': 'Delete files from storage',
  
  // Administrative
  'admin:read': 'Read administrative data',
  'admin:write': 'Perform administrative operations'
} as const

export type APIScope = keyof typeof API_SCOPES