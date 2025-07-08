import type { D1Database } from '../types/cloudflare'
import { getCurrentDateTimeISO } from './datetime-utils'

export interface AppSetting {
  key: string
  value: string
  updated_at: string
}

export interface AppSettings {
  app_name: string
  app_url?: string
  support_email?: string
  oauth_user_agent?: string
  callback_urls?: string[]
  worker_domain?: string
}

export interface AppSettingUpdate {
  key: string
  value: string
}

export class AppSettingsManager {
  constructor(private db: D1Database) {}

  /**
   * Get all settings from the single row
   */
  async getAllSettings(): Promise<AppSettings> {
    try {
      const result = await this.db
        .prepare(
          'SELECT app_name, app_url, support_email, oauth_user_agent, callback_urls, worker_domain FROM app_settings LIMIT 1'
        )
        .first<{
          app_name: string
          app_url: string | null
          support_email: string | null
          oauth_user_agent: string | null
          callback_urls: string | null
          worker_domain: string | null
        }>()

      if (!result) {
        // Return default values if no settings exist
        return {
          app_name: 'My Vibebase App',
          app_url: '',
          support_email: '',
          oauth_user_agent: '',
          callback_urls: [],
          worker_domain: '',
        }
      }

      // Parse callback_urls JSON
      let parsedCallbackUrls: string[] = []
      if (result.callback_urls) {
        try {
          parsedCallbackUrls = JSON.parse(result.callback_urls)
        } catch {
          parsedCallbackUrls = []
        }
      }

      return {
        app_name: result.app_name || 'My Vibebase App',
        app_url: result.app_url || '',
        support_email: result.support_email || '',
        oauth_user_agent: result.oauth_user_agent || '',
        callback_urls: parsedCallbackUrls,
        worker_domain: result.worker_domain || '',
      }
    } catch (error) {
      // If table doesn't exist, return default values
      if (error instanceof Error && error.message.includes('no such table')) {
        return {
          app_name: 'My Vibebase App',
          app_url: '',
          support_email: '',
          oauth_user_agent: '',
          callback_urls: [],
          worker_domain: '',
        }
      }
      throw error
    }
  }

  /**
   * Get settings formatted for API response
   */
  async getSettingsForAPI(): Promise<AppSetting[]> {
    try {
      const result = await this.db
        .prepare(
          'SELECT app_name, app_url, support_email, oauth_user_agent, callback_urls, worker_domain, updated_at FROM app_settings LIMIT 1'
        )
        .first<{
          app_name: string | null
          app_url: string | null
          support_email: string | null
          oauth_user_agent: string | null
          callback_urls: string | null
          worker_domain: string | null
          updated_at: string
        }>()

      console.log('getSettingsForAPI result:', result)

      if (!result) {
        console.log('No app_settings record found')
        return []
      }

      const settings: AppSetting[] = []
      const fields = [
        'app_name',
        'app_url',
        'support_email',
        'oauth_user_agent',
        'callback_urls',
        'worker_domain',
      ] as const

      for (const field of fields) {
        const value = result[field]
        if (value !== null) {
          settings.push({
            key: field,
            value: value,
            updated_at: result.updated_at,
          })
        }
      }

      console.log('getSettingsForAPI returning settings:', settings)
      return settings
    } catch (error) {
      if (error instanceof Error && error.message.includes('no such table')) {
        return []
      }
      throw error
    }
  }

  /**
   * Update multiple settings at once
   */
  async updateSettings(settings: AppSettingUpdate[]): Promise<void> {
    const validColumns = [
      'app_name',
      'app_url',
      'support_email',
      'oauth_user_agent',
      'callback_urls',
      'worker_domain',
    ]
    const updates: string[] = []
    const values: (string | null)[] = []

    // Check if app_name is being updated to auto-update oauth_user_agent
    const appNameUpdate = settings.find((s) => s.key === 'app_name')
    const settingsToProcess = [...settings]

    if (appNameUpdate) {
      console.log('App name is being updated to:', appNameUpdate.value)
      // Generate new oauth_user_agent based on new app_name
      const sanitizedAppName = appNameUpdate.value
        .replace(/[^\p{L}\p{N}\s-]/gu, '') // Allow Unicode letters, numbers, spaces, and hyphens
        .replace(/\s+/g, '-')
      const newUserAgent = `${sanitizedAppName}/1.0 (Powered by Vibebase)`
      console.log('Generated new user agent:', newUserAgent)

      // Add oauth_user_agent update if not already specified
      const hasUserAgentUpdate = settings.some((s) => s.key === 'oauth_user_agent')
      if (!hasUserAgentUpdate) {
        console.log('Adding oauth_user_agent to settings update')
        settingsToProcess.push({ key: 'oauth_user_agent', value: newUserAgent })
      } else {
        console.log('oauth_user_agent is already being updated explicitly')
      }
    }

    for (const setting of settingsToProcess) {
      if (validColumns.includes(setting.key)) {
        updates.push(`${setting.key} = ?`)
        values.push(setting.value)
      }
    }

    if (updates.length === 0) {
      return
    }

    // Add updated_at
    updates.push('updated_at = ?')
    values.push(getCurrentDateTimeISO())

    try {
      // Always update the first row (there should only be one)
      await this.db
        .prepare(`UPDATE app_settings SET ${updates.join(', ')}`)
        .bind(...values)
        .run()
    } catch (error) {
      console.error('Failed to update settings:', error)
      throw error
    }
  }

  /**
   * Get allowed callback URLs for OAuth authentication
   */
  async getAllowedCallbackUrls(): Promise<string[]> {
    try {
      const result = await this.db
        .prepare('SELECT callback_urls FROM app_settings LIMIT 1')
        .first<{ callback_urls: string | null }>()

      if (!result?.callback_urls) {
        return []
      }

      try {
        return JSON.parse(result.callback_urls)
      } catch {
        return []
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('no such table') || error.message.includes('no such column'))
      ) {
        return []
      }
      throw error
    }
  }

  /**
   * Update allowed callback URLs
   */
  async updateAllowedCallbackUrls(urls: string[]): Promise<void> {
    await this.updateSettings([{ key: 'callback_urls', value: JSON.stringify(urls) }])
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
      return allowedUrls.some((allowedUrl) => localhostPattern.test(allowedUrl))
    }

    return false
  }

  /**
   * Get worker domain
   */
  async getWorkerDomain(): Promise<string | null> {
    try {
      const result = await this.db
        .prepare('SELECT worker_domain FROM app_settings LIMIT 1')
        .first<{ worker_domain: string | null }>()

      return result?.worker_domain || null
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('no such table') || error.message.includes('no such column'))
      ) {
        return null
      }
      throw error
    }
  }

  /**
   * Set worker domain
   */
  async setWorkerDomain(domain: string): Promise<void> {
    await this.updateSettings([{ key: 'worker_domain', value: domain }])
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
