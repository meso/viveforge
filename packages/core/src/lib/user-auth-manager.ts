import { sign, verify } from 'hono/jwt'
import type { JWTPayload } from 'hono/jwt'
import type { D1Database } from '../types/cloudflare'
import type { User, UserSession, UserToken } from '../types/auth'

export class UserAuthManager {
  constructor(
    private db: D1Database,
    private jwtSecret: string,
    private domain: string
  ) {}

  // Generate JWT tokens for user
  async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
    const sessionId = this.generateId()
    const now = Math.floor(Date.now() / 1000)
    
    // Access token (15 minutes)
    const accessTokenPayload: UserToken = {
      type: 'access',
      user_id: user.id,
      session_id: sessionId,
      scope: ['user'],
      aud: this.domain,
      iss: 'vibebase-local',
      exp: now + (15 * 60), // 15 minutes
      iat: now
    }
    
    // Refresh token (30 days)
    const refreshTokenPayload: UserToken = {
      type: 'refresh',
      user_id: user.id,
      session_id: sessionId,
      scope: ['user'],
      aud: this.domain,
      iss: 'vibebase-local',
      exp: now + (30 * 24 * 60 * 60), // 30 days
      iat: now
    }
    
    const accessToken = await sign(accessTokenPayload, this.jwtSecret)
    const refreshToken = await sign(refreshTokenPayload, this.jwtSecret)
    
    // Store session in database
    await this.createSession(sessionId, user.id, accessToken, refreshToken, accessTokenPayload.exp)
    
    return { accessToken, refreshToken, sessionId }
  }

  // Verify JWT token and return user context
  async verifyUserToken(token: string): Promise<{ user: User; session: UserSession } | null> {
    try {
      const payload = await verify(token, this.jwtSecret) as UserToken
      
      // Validate token structure
      if (!payload || payload.iss !== 'vibebase-local' || payload.aud !== this.domain) {
        return null
      }
      
      if (!payload.scope?.includes('user')) {
        return null
      }
      
      // Check if session exists and is valid
      const session = await this.getSession(payload.session_id)
      if (!session || new Date(session.expires_at) < new Date()) {
        return null
      }
      
      // Get user data
      const user = await this.getUser(payload.user_id)
      if (!user || !user.is_active) {
        return null
      }
      
      return { user, session }
    } catch (error) {
      console.error('Token verification failed:', error)
      return null
    }
  }

  // Create or update user from OAuth provider
  async createOrUpdateUser(providerUser: {
    provider: string
    provider_id: string
    email: string
    name?: string
    avatar_url?: string
    metadata?: any
  }): Promise<User> {
    const existingUser = await this.getUserByProvider(providerUser.provider, providerUser.provider_id)
    
    if (existingUser) {
      // Update existing user
      const updatedUser = await this.updateUser(existingUser.id, {
        email: providerUser.email,
        name: providerUser.name,
        avatar_url: providerUser.avatar_url,
        metadata: JSON.stringify(providerUser.metadata || {}),
        last_login_at: new Date().toISOString()
      })
      return updatedUser
    } else {
      // Create new user
      const userId = this.generateId()
      const user = await this.createUser({
        id: userId,
        email: providerUser.email,
        name: providerUser.name,
        avatar_url: providerUser.avatar_url,
        provider: providerUser.provider,
        provider_id: providerUser.provider_id,
        role: 'user',
        metadata: JSON.stringify(providerUser.metadata || {}),
        last_login_at: new Date().toISOString(),
        is_active: true
      })
      return user
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string } | null> {
    try {
      const payload = await verify(refreshToken, this.jwtSecret) as UserToken
      
      if (payload.type !== 'refresh' || payload.iss !== 'vibebase-local') {
        return null
      }
      
      // Check if session exists
      const session = await this.getSession(payload.session_id)
      if (!session) {
        return null
      }
      
      // Get user and verify active
      const user = await this.getUser(payload.user_id)
      if (!user || !user.is_active) {
        return null
      }
      
      // Generate new access token
      const now = Math.floor(Date.now() / 1000)
      const accessTokenPayload: UserToken = {
        type: 'access',
        user_id: user.id,
        session_id: payload.session_id,
        scope: ['user'],
        aud: this.domain,
        iss: 'vibebase-local',
        exp: now + (15 * 60), // 15 minutes
        iat: now
      }
      
      const accessToken = await sign(accessTokenPayload, this.jwtSecret)
      
      // Update session with new access token
      await this.updateSession(payload.session_id, accessToken, accessTokenPayload.exp)
      
      return { accessToken }
    } catch (error) {
      console.error('Token refresh failed:', error)
      return null
    }
  }

  // Logout user by invalidating session
  async logout(sessionId: string): Promise<void> {
    await this.deleteSession(sessionId)
  }

  // Private helper methods
  private async createSession(id: string, userId: string, accessToken: string, refreshToken: string, expiresAt: number): Promise<void> {
    const accessTokenHash = await this.hashToken(accessToken)
    const refreshTokenHash = await this.hashToken(refreshToken)
    
    await this.db.prepare(`
      INSERT INTO user_sessions (id, user_id, access_token_hash, refresh_token_hash, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, userId, accessTokenHash, refreshTokenHash, new Date(expiresAt * 1000).toISOString()).run()
  }

  private async getSession(id: string): Promise<UserSession | null> {
    const result = await this.db.prepare(`
      SELECT * FROM user_sessions WHERE id = ?
    `).bind(id).first()
    
    return result as UserSession | null
  }

  private async updateSession(id: string, accessToken: string, expiresAt: number): Promise<void> {
    const accessTokenHash = await this.hashToken(accessToken)
    
    await this.db.prepare(`
      UPDATE user_sessions 
      SET access_token_hash = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(accessTokenHash, new Date(expiresAt * 1000).toISOString(), id).run()
  }

  private async deleteSession(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM user_sessions WHERE id = ?`).bind(id).run()
  }

  private async getUser(id: string): Promise<User | null> {
    const result = await this.db.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(id).first()
    
    return result as User | null
  }

  private async getUserByProvider(provider: string, providerId: string): Promise<User | null> {
    const result = await this.db.prepare(`
      SELECT * FROM users WHERE provider = ? AND provider_id = ?
    `).bind(provider, providerId).first()
    
    return result as User | null
  }

  private async createUser(userData: Omit<User, 'created_at' | 'updated_at'>): Promise<User> {
    const now = new Date().toISOString()
    
    await this.db.prepare(`
      INSERT INTO users (id, email, name, avatar_url, provider, provider_id, role, metadata, last_login_at, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userData.id,
      userData.email,
      userData.name,
      userData.avatar_url,
      userData.provider,
      userData.provider_id,
      userData.role,
      userData.metadata,
      userData.last_login_at,
      userData.is_active,
      now,
      now
    ).run()
    
    return { ...userData, created_at: now, updated_at: now }
  }

  private async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const setClauses = []
    const values = []
    
    if (updates.email !== undefined) {
      setClauses.push('email = ?')
      values.push(updates.email)
    }
    if (updates.name !== undefined) {
      setClauses.push('name = ?')
      values.push(updates.name)
    }
    if (updates.avatar_url !== undefined) {
      setClauses.push('avatar_url = ?')
      values.push(updates.avatar_url)
    }
    if (updates.metadata !== undefined) {
      setClauses.push('metadata = ?')
      values.push(updates.metadata)
    }
    if (updates.last_login_at !== undefined) {
      setClauses.push('last_login_at = ?')
      values.push(updates.last_login_at)
    }
    
    setClauses.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id)
    
    await this.db.prepare(`
      UPDATE users SET ${setClauses.join(', ')} WHERE id = ?
    `).bind(...values).run()
    
    const updatedUser = await this.getUser(id)
    if (!updatedUser) {
      throw new Error('Failed to update user')
    }
    
    return updatedUser
  }

  private generateId(): string {
    return crypto.randomUUID().replace(/-/g, '')
  }

  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(token)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
}