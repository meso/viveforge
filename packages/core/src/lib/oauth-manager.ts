import type { D1Database } from '../types/cloudflare'
import type { OAuthProvider, OAuthProviderConfig, OAuthUserInfo } from '../types/auth'
import { AppSettingsManager } from './app-settings-manager'

export class OAuthManager {
  private appSettingsManager: AppSettingsManager
  
  constructor(private db: D1Database) {
    this.appSettingsManager = new AppSettingsManager(db)
  }

  // Get enabled OAuth providers
  async getEnabledProviders(): Promise<OAuthProvider[]> {
    const result = await this.db.prepare(`
      SELECT id, provider, client_id, is_enabled, scopes, redirect_uri, created_at, updated_at
      FROM oauth_providers 
      WHERE is_enabled = true
    `).all()
    
    return result.results as OAuthProvider[]
  }

  // Get specific OAuth provider configuration
  async getProviderConfig(provider: string): Promise<OAuthProviderConfig | null> {
    const result = await this.db.prepare(`
      SELECT client_id, client_secret, scopes, redirect_uri
      FROM oauth_providers 
      WHERE provider = ? AND is_enabled = true
    `).bind(provider).first()
    
    if (!result) return null
    
    const config = result as Record<string, unknown>
    return {
      clientId: config.client_id as string,
      clientSecret: config.client_secret as string,
      scopes: config.scopes ? JSON.parse(config.scopes as string) : [],
      redirectUri: config.redirect_uri as string
    }
  }

  // Create or update OAuth provider configuration (admin only)
  async upsertProvider(
    provider: string,
    config: {
      client_id: string
      client_secret: string
      is_enabled: boolean
      scopes?: string[]
      redirect_uri?: string
    }
  ): Promise<void> {
    const existingProvider = await this.db.prepare(`
      SELECT id FROM oauth_providers WHERE provider = ?
    `).bind(provider).first()
    
    const scopesJson = config.scopes ? JSON.stringify(config.scopes) : null
    
    if (existingProvider) {
      // Update existing provider
      await this.db.prepare(`
        UPDATE oauth_providers 
        SET client_id = ?, client_secret = ?, is_enabled = ?, scopes = ?, redirect_uri = ?, updated_at = ?
        WHERE provider = ?
      `).bind(
        config.client_id,
        config.client_secret,
        config.is_enabled,
        scopesJson,
        config.redirect_uri,
        new Date().toISOString(),
        provider
      ).run()
    } else {
      // Create new provider
      const now = new Date().toISOString()
      await this.db.prepare(`
        INSERT INTO oauth_providers (id, provider, client_id, client_secret, is_enabled, scopes, redirect_uri, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID().replace(/-/g, ''),
        provider,
        config.client_id,
        config.client_secret,
        config.is_enabled,
        scopesJson,
        config.redirect_uri,
        now,
        now
      ).run()
    }
  }

  // Generate OAuth authorization URL
  generateAuthUrl(
    provider: string,
    config: OAuthProviderConfig,
    state: string,
    baseUrl: string
  ): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri || `${baseUrl}/api/auth/callback/${provider}`,
      scope: config.scopes.join(' '),
      state: state
    })
    
    const authUrls: Record<string, string> = {
      google: 'https://accounts.google.com/o/oauth2/v2/auth',
      github: 'https://github.com/login/oauth/authorize',
      facebook: 'https://www.facebook.com/v18.0/dialog/oauth',
      linkedin: 'https://www.linkedin.com/oauth/v2/authorization',
      twitter: 'https://twitter.com/i/oauth2/authorize',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      slack: 'https://slack.com/oauth/v2/authorize',
      discord: 'https://discord.com/api/oauth2/authorize'
    }
    
    const authUrl = authUrls[provider]
    if (!authUrl) {
      throw new Error(`Unsupported OAuth provider: ${provider}`)
    }
    
    return `${authUrl}?${params.toString()}`
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(
    provider: string,
    code: string,
    config: OAuthProviderConfig,
    baseUrl: string
  ): Promise<{ access_token: string; token_type: string; expires_in?: number }> {
    const tokenUrls: Record<string, string> = {
      google: 'https://oauth2.googleapis.com/token',
      github: 'https://github.com/login/oauth/access_token',
      facebook: 'https://graph.facebook.com/v18.0/oauth/access_token',
      linkedin: 'https://www.linkedin.com/oauth/v2/accessToken',
      twitter: 'https://api.twitter.com/2/oauth2/token',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      slack: 'https://slack.com/api/oauth.v2.access',
      discord: 'https://discord.com/api/oauth2/token'
    }
    
    const tokenUrl = tokenUrls[provider]
    if (!tokenUrl) {
      throw new Error(`Unsupported OAuth provider: ${provider}`)
    }
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      redirect_uri: config.redirectUri || `${baseUrl}/api/auth/callback/${provider}`
    })
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString()
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token exchange failed: ${errorText}`)
    }
    
    return await response.json()
  }

  // Get user info from OAuth provider
  async getUserInfo(provider: string, accessToken: string): Promise<OAuthUserInfo> {
    const userInfoUrls: Record<string, string> = {
      google: 'https://www.googleapis.com/oauth2/userinfo',
      github: 'https://api.github.com/user',
      facebook: 'https://graph.facebook.com/me?fields=id,name,email,picture',
      linkedin: 'https://api.linkedin.com/v2/people/~:(id,firstName,lastName,emailAddress,profilePicture)',
      twitter: 'https://api.twitter.com/2/users/me?user.fields=profile_image_url',
      microsoft: 'https://graph.microsoft.com/v1.0/me',
      slack: 'https://slack.com/api/users.identity',
      discord: 'https://discord.com/api/users/@me'
    }
    
    const userInfoUrl = userInfoUrls[provider]
    if (!userInfoUrl) {
      throw new Error(`Unsupported OAuth provider: ${provider}`)
    }
    
    // Get app name for User-Agent
    const appName = await this.appSettingsManager.getSetting('app_name') || 'My Vibebase App'
    const userAgent = `${appName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')}/1.0 (Powered by Vibebase)`
    
    const response = await fetch(userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'User-Agent': userAgent
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to get user info: ${errorText}`)
    }
    
    const userData = await response.json()
    
    // Normalize user data across different providers
    return this.normalizeUserInfo(provider, userData as Record<string, unknown>)
  }

  // Normalize user info from different providers
  private normalizeUserInfo(provider: string, userData: Record<string, unknown>): OAuthUserInfo {
    switch (provider) {
      case 'google':
        return {
          id: userData.id as string,
          email: userData.email as string,
          name: userData.name as string,
          avatar_url: userData.picture as string
        }
      
      case 'github':
        return {
          id: (userData.id as number).toString(),
          email: userData.email as string,
          name: (userData.name as string) || (userData.login as string),
          avatar_url: userData.avatar_url as string
        }
      
      case 'facebook':
        return {
          id: userData.id as string,
          email: userData.email as string,
          name: userData.name as string,
          avatar_url: ((userData.picture as Record<string, unknown>)?.data as Record<string, unknown>)?.url as string
        }
      
      case 'linkedin':
        const firstName = ((userData.firstName as Record<string, unknown>)?.localized as Record<string, unknown>)?.en_US as string || ''
        const lastName = ((userData.lastName as Record<string, unknown>)?.localized as Record<string, unknown>)?.en_US as string || ''
        return {
          id: userData.id as string,
          email: userData.emailAddress as string,
          name: `${firstName} ${lastName}`.trim() || undefined,
          avatar_url: (userData.profilePicture as Record<string, unknown>)?.displayImage as string
        }
      
      case 'twitter':
        return {
          id: userData.id as string,
          email: userData.email as string, // Note: Twitter API v2 doesn't include email by default
          name: (userData.name as string) || (userData.username as string),
          avatar_url: userData.profile_image_url as string
        }
      
      case 'microsoft':
        return {
          id: userData.id as string,
          email: userData.mail as string || userData.userPrincipalName as string,
          name: userData.displayName as string,
          avatar_url: undefined // Microsoft Graph doesn't provide avatar URL in basic profile
        }
      
      case 'slack':
        const slackUser = (userData.user as Record<string, unknown>) || {}
        return {
          id: slackUser.id as string,
          email: slackUser.email as string,
          name: slackUser.name as string,
          avatar_url: slackUser.image_192 as string || slackUser.image_72 as string
        }
      
      case 'discord':
        return {
          id: userData.id as string,
          email: userData.email as string,
          name: userData.username as string,
          avatar_url: userData.avatar 
            ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
            : undefined
        }
      
      default:
        return userData as OAuthUserInfo
    }
  }

  // Generate secure random state for OAuth flow
  generateState(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  // Get default scopes for each provider
  getDefaultScopes(provider: string): string[] {
    const defaultScopes: Record<string, string[]> = {
      google: ['openid', 'email', 'profile'],
      github: ['user:email'],
      facebook: ['email', 'public_profile'],
      linkedin: ['r_liteprofile', 'r_emailaddress'],
      twitter: ['users.read', 'tweet.read'],
      microsoft: ['openid', 'profile', 'email'],
      slack: ['identity.basic', 'identity.email'],
      discord: ['identify', 'email']
    }
    
    return defaultScopes[provider] || []
  }
}