import { TableManager } from './lib/table-manager'
import { Database } from './lib/database'

export interface Env {
  DB?: D1Database
  SYSTEM_STORAGE?: R2Bucket  // システム用（スナップショット等）
  USER_STORAGE?: R2Bucket    // ユーザー用
  SESSIONS?: KVNamespace
  ENVIRONMENT: 'development' | 'production'
  
  // Cloudflare Access settings
  CLOUDFLARE_TEAM_DOMAIN?: string  // e.g., "vibebase" for vibebase.cloudflareaccess.com
  
  // OAuth providers secrets (legacy)
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
}

// Hono Context Variables
export interface Variables {
  tableManager?: TableManager
  db?: Database
  userId?: string
  adminId?: string
  user?: {
    id: string
    email: string
    provider: string
    providerId: string
    isFirstAdmin?: boolean
  }
  tableInfo?: any
}

export interface Admin {
  id: string
  email: string
  name?: string
  provider: string
  providerId: string
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  adminId: string
  expiresAt: string
}