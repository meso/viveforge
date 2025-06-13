import { TableManager } from './lib/table-manager'
import { Database } from './lib/database'

export interface Env {
  DB?: D1Database
  STORAGE?: R2Bucket
  SESSIONS?: KVNamespace
  ENVIRONMENT: 'development' | 'production'
  
  // OAuth providers secrets
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
}

// Hono Context Variables
export interface Variables {
  tableManager: TableManager
  db: Database
  userId?: string
  adminId?: string
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