/**
 * Generic query hook
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { UseQueryOptions, UseQueryResult } from '../types'

export function useQuery<T = unknown>(
  queryFn: () => Promise<T>,
  options: UseQueryOptions<T> = {}
): UseQueryResult<T> {
  const {
    enabled = true,
    refetchInterval,
    refetchOnWindowFocus = true,
    retry = 3,
    onSuccess,
    onError,
  } = options

  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefetching, setIsRefetching] = useState(false)

  const mountedRef = useRef(true)
  const intervalIdRef = useRef<NodeJS.Timeout>()

  const fetchData = useCallback(
    async (isRefetch = false) => {
      if (!mountedRef.current) return

      try {
        if (isRefetch) {
          setIsRefetching(true)
        } else {
          setIsLoading(true)
        }
        setError(null)

        let lastError: Error | null = null
        const maxRetries = typeof retry === 'number' ? retry : retry ? 3 : 0

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await queryFn()

            if (mountedRef.current) {
              setData(result)
              onSuccess?.(result)
            }
            return
          } catch (err) {
            lastError = err instanceof Error ? err : new Error('Query failed')

            if (attempt < maxRetries) {
              // Wait before retry with exponential backoff
              await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000))
            }
          }
        }

        // All retries failed
        if (mountedRef.current && lastError) {
          setError(lastError)
          onError?.(lastError)
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false)
          setIsRefetching(false)
        }
      }
    },
    [queryFn, retry, onSuccess, onError]
  )

  const refetch = useCallback(async () => {
    await fetchData(true)
  }, [fetchData])

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchData()
    }
  }, [enabled, fetchData])

  // Refetch interval
  useEffect(() => {
    if (refetchInterval && enabled) {
      intervalIdRef.current = setInterval(() => {
        fetchData(true)
      }, refetchInterval)

      return () => {
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current)
        }
      }
    }
  }, [refetchInterval, enabled, fetchData])

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled) return

    const handleFocus = () => {
      fetchData(true)
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refetchOnWindowFocus, enabled, fetchData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
      }
    }
  }, [])

  return {
    data,
    error,
    isLoading,
    isError: !!error,
    isSuccess: !isLoading && !error && data !== undefined,
    refetch,
    isRefetching,
  }
}
