/**
 * Realtime connection hook
 */

import type { RealtimeEvent } from '@vibebase/sdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useVibebase } from '../providers/vibebase-provider'
import type { UseRealtimeOptions, UseRealtimeResult } from '../types'

export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeResult {
  const { enabled = true, onConnect, onDisconnect, onError } = options
  const { client } = useVibebase()
  const [isConnected, setIsConnected] = useState(false)
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map())

  // Connect to realtime
  useEffect(() => {
    if (!enabled) return

    // Check connection status periodically
    const checkConnection = () => {
      const connected = client.realtime.isConnected()
      setIsConnected(connected)

      if (connected && !isConnected) {
        onConnect?.()
      } else if (!connected && isConnected) {
        onDisconnect?.()
      }
    }

    // Initial check
    checkConnection()

    // Set up periodic checks
    const interval = setInterval(checkConnection, 1000)

    // Try to connect
    try {
      client.realtime.connect()
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Failed to connect to realtime'))
    }

    return () => {
      clearInterval(interval)
      if (enabled) {
        client.realtime.disconnect()
        onDisconnect?.()
      }
    }
  }, [enabled, client, onConnect, onDisconnect, onError, isConnected])

  // Subscribe to table events
  const subscribe = useCallback(
    (
      tableName: string,
      eventType: 'insert' | 'update' | 'delete' | '*',
      callback: (event: RealtimeEvent) => void
    ): (() => void) => {
      if (!enabled) {
        return () => {}
      }

      try {
        const subscription = client.realtime.subscribe(tableName, eventType, callback)
        const unsubscribeKey = `${tableName}:${eventType}:${Date.now()}`

        const unsubscribe = () => {
          subscription.unsubscribe()
          subscriptionsRef.current.delete(unsubscribeKey)
        }

        subscriptionsRef.current.set(unsubscribeKey, unsubscribe)

        return unsubscribe
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error('Failed to subscribe'))
        return () => {}
      }
    },
    [enabled, client, onError]
  )

  // Unsubscribe all
  const unsubscribeAll = useCallback(() => {
    subscriptionsRef.current.forEach((unsubscribe) => unsubscribe())
    subscriptionsRef.current.clear()
    client.realtime.unsubscribeAll()
  }, [client])

  // Clean up subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach((unsubscribe) => unsubscribe())
      subscriptionsRef.current.clear()
    }
  }, [])

  return {
    isConnected,
    subscribe,
    unsubscribeAll,
  }
}
