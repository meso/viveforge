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

export interface User {
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
  userId: string
  expiresAt: string
}