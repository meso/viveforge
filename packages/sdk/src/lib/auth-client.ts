/**
 * Authentication Client
 */

import type { ApiResponse, User, UserSession } from '../types'
import type { HttpClient } from './http-client'

export class AuthClient {
  constructor(private http: HttpClient) {}

  /**
   * Login with OAuth provider
   */
  async loginWithProvider(provider: string, redirectUri?: string): Promise<string> {
    const params = new URLSearchParams({
      provider,
      ...(redirectUri && { redirect_uri: redirectUri }),
    })

    // Return the OAuth URL for redirect
    return `${this.http.config.baseUrl}/api/auth/login?${params}`
  }

  /**
   * Exchange OAuth code for session
   */
  async exchangeCode(code: string, state?: string): Promise<ApiResponse<UserSession>> {
    return this.http.post<UserSession>('/api/auth/callback', { code, state })
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.http.get<User>('/api/auth/me')
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<
    ApiResponse<{
      access_token: string
      refresh_token: string
      expires_in: number
    }>
  > {
    return this.http.post('/api/auth/refresh', { refresh_token: refreshToken })
  }

  /**
   * Logout and revoke tokens
   */
  async logout(): Promise<ApiResponse<void>> {
    return this.http.post('/api/auth/logout')
  }

  /**
   * Check authentication status
   */
  async checkStatus(): Promise<
    ApiResponse<{
      authenticated: boolean
      user: User | null
    }>
  > {
    return this.http.get('/api/auth/status')
  }

  /**
   * Update user profile
   */
  async updateProfile(data: {
    name?: string
    avatar_url?: string
    metadata?: Record<string, unknown>
  }): Promise<ApiResponse<User>> {
    return this.http.put('/api/auth/profile', data)
  }

  /**
   * Delete user account
   */
  async deleteAccount(): Promise<ApiResponse<void>> {
    return this.http.delete('/api/auth/account')
  }

  /**
   * Set user token for subsequent requests
   */
  setUserToken(token: string): void {
    this.http.setAuth({ userToken: token })
  }

  /**
   * Set API key for subsequent requests
   */
  setApiKey(apiKey: string): void {
    this.http.setAuth({ apiKey })
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.http.setAuth({})
  }

  /**
   * Generate anonymous session (if supported)
   */
  async createAnonymousSession(): Promise<
    ApiResponse<{
      access_token: string
      device_id: string
      expires_in: number
    }>
  > {
    return this.http.post('/api/auth/anonymous')
  }

  /**
   * Convert anonymous session to user account
   */
  async upgradeAnonymousSession(provider: string, code: string): Promise<ApiResponse<UserSession>> {
    return this.http.post('/api/auth/upgrade', { provider, code })
  }
}
