import { TableManager } from './lib/table-manager'
import { Database } from './lib/database'
import type { VibebaseAuthClient, User } from './lib/auth-client'

export interface Env {
  DB?: D1Database
  SYSTEM_STORAGE?: R2Bucket  // システム用（スナップショット等）
  USER_STORAGE?: R2Bucket    // ユーザー用
  SESSIONS?: KVNamespace
  ASSETS: { fetch: (request: Request) => Promise<Response> }  // Workers Assets
  ENVIRONMENT: 'development' | 'production'
  
  // Vibebase Auth settings
  VIBEBASE_AUTH_URL?: string
  DEPLOYMENT_ID?: string
  DEPLOYMENT_DOMAIN?: string
  WORKER_NAME?: string
  
  // Legacy Cloudflare Access settings (deprecated)
  CLOUDFLARE_TEAM_DOMAIN?: string
  
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
  authClient?: VibebaseAuthClient
  user?: User
  userId?: string
  adminId?: string
  tableInfo?: any
  apiKeyManager?: any
  authContext?: any
  apiKey?: any
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