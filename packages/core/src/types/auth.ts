// User authentication types

export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
  provider: string // 'google', 'github', 'facebook', etc.
  provider_id: string
  role: string // 'user', 'admin', etc.
  metadata?: string // JSON string for provider-specific data
  last_login_at?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserSession {
  id: string
  user_id: string
  access_token_hash: string
  refresh_token_hash?: string
  expires_at: string
  created_at: string
  updated_at: string
}

export interface OAuthProvider {
  id: string
  provider: string
  client_id: string
  client_secret: string
  is_enabled: boolean
  scopes?: string // JSON array
  redirect_uri?: string
  created_at: string
  updated_at: string
}

export interface UserAuthContext {
  type: 'user'
  user: User
  session: UserSession
}

export interface AdminAuthContext {
  type: 'admin'
  user: User
}

export interface APIKeyAuthContext {
  type: 'api_key'
  apiKey: {
    id: string
    name: string
    scopes: string[]
  }
}

export type AuthContext = UserAuthContext | AdminAuthContext | APIKeyAuthContext

export interface OAuthProviderConfig {
  clientId: string
  clientSecret: string
  scopes: string[]
  redirectUri: string
}

export interface UserToken {
  type: 'access' | 'refresh'
  user_id: string
  session_id: string
  scope: ['user']
  aud: string
  iss: string
  exp: number
  iat: number
  [key: string]: unknown
}

// OAuth flow interfaces
export interface OAuthAuthorizationParams {
  response_type: 'code'
  client_id: string
  redirect_uri: string
  scope: string
  state: string
}

export interface OAuthTokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in?: number
  refresh_token?: string
  scope?: string
}

export interface OAuthUserInfo {
  id: string
  email: string
  name?: string
  avatar_url?: string
  [key: string]: unknown // Provider-specific fields
}

// Provider-specific user info interfaces
export interface GoogleUserInfo extends OAuthUserInfo {
  sub: string
  email: string
  name?: string
  picture?: string
  given_name?: string
  family_name?: string
}

export interface GitHubUserInfo extends OAuthUserInfo {
  id: string  // Changed from number to string to match OAuthUserInfo
  login: string
  email: string
  name?: string
  avatar_url?: string
}

export interface FacebookUserInfo extends OAuthUserInfo {
  id: string
  email: string
  name?: string
  picture?: {
    data: {
      url: string
    }
  }
}

// Error types
export interface AuthError {
  code: string
  message: string
  details?: string | Record<string, unknown>
}

export type OAuthProviderType = 'google' | 'github' | 'facebook' | 'linkedin' | 'twitter' | 'apple' | 'microsoft' | 'discord' | 'slack'

// Supported providers by Hono OAuth
export type HonoSupportedProvider = 'google' | 'github' | 'facebook' | 'linkedin' | 'twitter'

// Custom implementation required providers
export type CustomProvider = 'apple' | 'microsoft' | 'discord' | 'slack'