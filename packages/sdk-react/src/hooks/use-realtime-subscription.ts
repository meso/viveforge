/**
 * Realtime subscription hook for specific table/event
 */

import type { RealtimeEvent } from '@vibebase/sdk'
import { useEffect } from 'react'
import { useRealtime } from './use-realtime'

interface UseRealtimeSubscriptionOptions {
  enabled?: boolean
  onEvent: (event: RealtimeEvent) => void
}

export function useRealtimeSubscription(
  tableName: string,
  eventType: 'insert' | 'update' | 'delete' | '*',
  options: UseRealtimeSubscriptionOptions
) {
  const { enabled = true, onEvent } = options
  const { subscribe, isConnected } = useRealtime()

  useEffect(() => {
    if (!enabled || !isConnected) return

    const unsubscribe = subscribe(tableName, eventType, onEvent)

    return unsubscribe
  }, [enabled, isConnected, tableName, eventType, subscribe, onEvent])

  return {
    isConnected,
  }
}
