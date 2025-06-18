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
  allowed_callback_urls?: string[]
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
      app_description: settings.app_description || undefined,
      allowed_callback_urls: settings.allowed_callback_urls ? JSON.parse(settings.allowed_callback_urls) : []
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
        const serializedValue = key === 'allowed_callback_urls' && Array.isArray(value) 
          ? JSON.stringify(value) 
          : value as string
        
        batch.push(
          this.db.prepare(`
            INSERT OR REPLACE INTO app_settings (key, value, updated_at)
            VALUES (?, ?, ?)
          `).bind(key, serializedValue, now) as unknown as D1PreparedStatement
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

  /**
   * Get allowed callback URLs for OAuth authentication
   */
  async getAllowedCallbackUrls(): Promise<string[]> {
    const value = await this.getSetting('allowed_callback_urls')
    if (!value) return []
    
    try {
      return JSON.parse(value)
    } catch {
      return []
    }
  }

  /**
   * Update allowed callback URLs
   */
  async updateAllowedCallbackUrls(urls: string[]): Promise<void> {
    await this.updateSetting('allowed_callback_urls', JSON.stringify(urls))
  }

  /**
   * Validate if a callback URL is allowed
   */
  async isCallbackUrlAllowed(url: string): Promise<boolean> {
    const allowedUrls = await this.getAllowedCallbackUrls()
    
    // If no URLs are configured, allow any URL (backward compatibility)
    if (allowedUrls.length === 0) {
      return true
    }
    
    // Check for exact match
    if (allowedUrls.includes(url)) {
      return true
    }
    
    // For development, allow localhost URLs if any localhost URL is in the list
    const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/
    if (localhostPattern.test(url)) {
      return allowedUrls.some(allowedUrl => localhostPattern.test(allowedUrl))
    }
    
    return false
  }

  /**
   * Validate callback URL format and protocol
   */
  isValidCallbackUrlFormat(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false
    }
    
    try {
      const urlObj = new URL(url)
      
      // Allow https, http (for localhost), and custom schemes for mobile apps
      const allowedProtocols = ['https:', 'http:']
      const customSchemePattern = /^[a-z][a-z0-9+.-]*:$/i
      
      if (allowedProtocols.includes(urlObj.protocol)) {
        // For http, only allow localhost/127.0.0.1
        if (urlObj.protocol === 'http:') {
          const localhostPattern = /^(localhost|127\.0\.0\.1)$/
          return localhostPattern.test(urlObj.hostname)
        }
        return true
      }
      
      // Allow custom schemes for mobile/desktop apps (e.g., myapp://)
      if (customSchemePattern.test(urlObj.protocol)) {
        return true
      }
      
      return false
    } catch {
      return false
    }
  }
}