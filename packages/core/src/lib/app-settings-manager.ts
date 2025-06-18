import type { D1Database } from '../types/cloudflare'

export interface AppSetting {
  key: string
  value: string
  updated_at: string
}

export interface AppSettings {
  app_name: string
  app_url?: string
  support_email?: string
  app_description?: string
}

export class AppSettingsManager {
  constructor(private db: D1Database) {}

  /**
   * Get a single setting value
   */
  async getSetting(key: string): Promise<string | null> {
    const result = await this.db.prepare(`
      SELECT value FROM app_settings WHERE key = ?
    `).bind(key).first<{ value: string }>()
    
    return result?.value || null
  }

  /**
   * Get all settings as a structured object
   */
  async getAllSettings(): Promise<AppSettings> {
    const results = await this.db.prepare(`
      SELECT key, value FROM app_settings
    `).all<{ key: string; value: string }>()
    
    const settings: Record<string, string> = {}
    results.results.forEach(row => {
      settings[row.key] = row.value
    })
    
    return {
      app_name: settings.app_name || 'My Vibebase App',
      app_url: settings.app_url || undefined,
      support_email: settings.support_email || undefined,
      app_description: settings.app_description || undefined
    }
  }

  /**
   * Update a single setting
   */
  async updateSetting(key: string, value: string): Promise<void> {
    const now = new Date().toISOString()
    
    await this.db.prepare(`
      INSERT OR REPLACE INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
    `).bind(key, value, now).run()
  }

  /**
   * Update multiple settings at once
   */
  async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    const now = new Date().toISOString()
    
    const batch: D1PreparedStatement[] = []
    
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        batch.push(
          this.db.prepare(`
            INSERT OR REPLACE INTO app_settings (key, value, updated_at)
            VALUES (?, ?, ?)
          `).bind(key, value, now) as any
        )
      }
    }
    
    if (batch.length > 0) {
      await this.db.batch(batch)
    }
  }

  /**
   * Get settings for API response
   */
  async getSettingsForAPI(): Promise<AppSetting[]> {
    const results = await this.db.prepare(`
      SELECT key, value, updated_at FROM app_settings
      ORDER BY key
    `).all<AppSetting>()
    
    return results.results
  }
}