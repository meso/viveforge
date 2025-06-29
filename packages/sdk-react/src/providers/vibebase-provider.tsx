/**
 * Vibebase Provider and Context
 */

import { VibebaseClient } from '@vibebase/sdk'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { VibebaseContextValue, VibebaseProviderProps } from '../types'

const VibebaseContext = createContext<VibebaseContextValue | null>(null)

/**
 * Provider component that initializes and provides Vibebase client to the app
 */
export function VibebaseProvider({
  children,
  config,
  client: providedClient,
}: VibebaseProviderProps) {
  const [isReady, setIsReady] = useState(false)

  // Create or use provided client
  const client = useMemo(() => {
    if (providedClient) {
      return providedClient
    }
    return new VibebaseClient(config)
  }, [config, providedClient])

  useEffect(() => {
    // Optional: Check connection health on mount
    const checkConnection = async () => {
      try {
        await client.health()
        setIsReady(true)
      } catch (error) {
        console.error('Failed to connect to Vibebase:', error)
        // Still mark as ready even if health check fails
        setIsReady(true)
      }
    }

    checkConnection()

    // Cleanup on unmount
    return () => {
      client.disconnect()
    }
  }, [client])

  const value = useMemo<VibebaseContextValue>(
    () => ({
      client,
      isReady,
    }),
    [client, isReady]
  )

  return <VibebaseContext.Provider value={value}>{children}</VibebaseContext.Provider>
}

/**
 * Hook to access the Vibebase client and context
 */
export function useVibebase(): VibebaseContextValue {
  const context = useContext(VibebaseContext)

  if (!context) {
    throw new Error('useVibebase must be used within a VibebaseProvider')
  }

  return context
}
