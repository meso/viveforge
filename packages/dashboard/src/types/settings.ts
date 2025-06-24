/**
 * Type definitions for Settings components
 */

export interface Admin {
  id: string
  github_username: string
  is_root: boolean
  created_at: string
}

export interface APIKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
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
  key: string
  scopes: string[]
  expires_at: string | null
}

export interface AppSetting {
  key: string
  value: string
  updated_at: string
}

export type SettingsSection = 'app-settings' | 'admins' | 'api-keys'
