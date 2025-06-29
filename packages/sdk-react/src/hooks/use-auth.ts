/**
 * Authentication hook
 */

import type { User } from '@vibebase/sdk'
import { useCallback, useEffect, useState } from 'react'
import { useVibebase } from '../providers/vibebase-provider'

interface UseAuthResult {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: Error | null
  login: (provider: string, redirectUri?: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: (refreshToken: string) => Promise<void>
  checkStatus: () => Promise<void>
  setUserToken: (token: string) => void
  setApiKey: (apiKey: string) => void
}

export function useAuth(): UseAuthResult {
  const { client } = useVibebase()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Check authentication status on mount
  const checkStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await client.auth.checkStatus()

      if (response.success && response.data) {
        setUser(response.data.user)
      } else {
        setUser(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Authentication check failed'))
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [client])

  // Login with OAuth provider
  const login = useCallback(
    async (provider: string, redirectUri?: string) => {
      const loginUrl = await client.auth.loginWithProvider(provider, redirectUri)
      window.location.href = loginUrl
    },
    [client]
  )

  // Logout
  const logout = useCallback(async () => {
    try {
      setError(null)
      await client.auth.logout()
      setUser(null)
      client.clearAuth()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Logout failed'))
      throw err
    }
  }, [client])

  // Refresh token
  const refreshToken = useCallback(
    async (refreshToken: string) => {
      try {
        setError(null)
        const response = await client.auth.refreshToken(refreshToken)

        if (response.success && response.data) {
          client.setUserToken(response.data.access_token)
          await checkStatus()
        } else {
          throw new Error(response.error || 'Token refresh failed')
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Token refresh failed'))
        throw err
      }
    },
    [client, checkStatus]
  )

  // Set user token
  const setUserToken = useCallback(
    (token: string) => {
      client.setUserToken(token)
      checkStatus()
    },
    [client, checkStatus]
  )

  // Set API key
  const setApiKey = useCallback(
    (apiKey: string) => {
      client.setApiKey(apiKey)
      // API key auth doesn't have a user, so clear user state
      setUser(null)
    },
    [client]
  )

  // Check status on mount
  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    refreshToken,
    checkStatus,
    setUserToken,
    setApiKey,
  }
}
