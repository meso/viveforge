/**
 * Custom SQL query hook
 */

import { useCallback, useState } from 'react'
import { useVibebase } from '../providers/vibebase-provider'
import type { UseCustomQueryResult as HookResult, UseCustomQueryVariables } from '../types'

export function useCustomQuery<T = unknown>(queryName: string): HookResult<T> {
  const { client } = useVibebase()
  const [data, setData] = useState<T[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, _setIsLoading] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)

  const execute = useCallback(
    async (variables?: UseCustomQueryVariables) => {
      try {
        setIsExecuting(true)
        setError(null)

        const response = await client.customQueries.execute<T>(queryName, variables)

        if (!response.success) {
          throw new Error(response.error || 'Failed to execute query')
        }

        setData(response.data?.data || [])
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Query execution failed')
        setError(error)
        throw error
      } finally {
        setIsExecuting(false)
      }
    },
    [client, queryName]
  )

  return {
    data,
    error,
    isLoading,
    execute,
    isExecuting,
  }
}
