/**
 * Infinite query hook for pagination
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UseInfiniteQueryOptions, UseInfiniteQueryResult } from '../types'

export function useInfiniteQuery<T = unknown>(
  queryFn: (pageParam: unknown) => Promise<T>,
  options: UseInfiniteQueryOptions<T> = {}
): UseInfiniteQueryResult<T> {
  const {
    enabled = true,
    getNextPageParam,
    getPreviousPageParam,
    retry,
    onSuccess,
    onError,
    refetchInterval,
    refetchOnWindowFocus,
  } = options

  // Memoize queryOptions to prevent unnecessary re-renders
  const queryOptions = useMemo(
    () => ({
      retry,
      onSuccess,
      onError,
      refetchInterval,
      refetchOnWindowFocus,
    }),
    [retry, onSuccess, onError, refetchInterval, refetchOnWindowFocus]
  )

  const [pages, setPages] = useState<T[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefetching, setIsRefetching] = useState(false)
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false)
  const [isFetchingPreviousPage, setIsFetchingPreviousPage] = useState(false)

  const mountedRef = useRef(true)

  // Determine if there are more pages
  const hasNextPage =
    !!getNextPageParam && pages.length > 0 && !!getNextPageParam(pages[pages.length - 1], pages)
  const hasPreviousPage =
    !!getPreviousPageParam && pages.length > 0 && !!getPreviousPageParam(pages[0], pages)

  const fetchInitialPage = useCallback(async () => {
    if (!mountedRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      const result = await queryFn(undefined)

      if (mountedRef.current) {
        setPages([result])
        queryOptions.onSuccess?.(result)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Query failed')
      if (mountedRef.current) {
        setError(error)
        queryOptions.onError?.(error)
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [queryFn, queryOptions])

  const fetchNextPage = useCallback(async () => {
    if (!mountedRef.current || !getNextPageParam || pages.length === 0) return

    const nextPageParam = getNextPageParam(pages[pages.length - 1], pages)
    if (!nextPageParam) return

    try {
      setIsFetchingNextPage(true)
      setError(null)

      const result = await queryFn(nextPageParam)

      if (mountedRef.current) {
        setPages((prev) => [...prev, result])
        queryOptions.onSuccess?.(result)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch next page')
      if (mountedRef.current) {
        setError(error)
        queryOptions.onError?.(error)
      }
    } finally {
      if (mountedRef.current) {
        setIsFetchingNextPage(false)
      }
    }
  }, [queryFn, getNextPageParam, pages, queryOptions])

  const fetchPreviousPage = useCallback(async () => {
    if (!mountedRef.current || !getPreviousPageParam || pages.length === 0) return

    const previousPageParam = getPreviousPageParam(pages[0], pages)
    if (!previousPageParam) return

    try {
      setIsFetchingPreviousPage(true)
      setError(null)

      const result = await queryFn(previousPageParam)

      if (mountedRef.current) {
        setPages((prev) => [result, ...prev])
        queryOptions.onSuccess?.(result)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch previous page')
      if (mountedRef.current) {
        setError(error)
        queryOptions.onError?.(error)
      }
    } finally {
      if (mountedRef.current) {
        setIsFetchingPreviousPage(false)
      }
    }
  }, [queryFn, getPreviousPageParam, pages, queryOptions])

  const refetch = useCallback(async () => {
    if (!mountedRef.current) return

    try {
      setIsRefetching(true)
      setError(null)

      const result = await queryFn(undefined)

      if (mountedRef.current) {
        setPages([result])
        queryOptions.onSuccess?.(result)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Refetch failed')
      if (mountedRef.current) {
        setError(error)
        queryOptions.onError?.(error)
      }
    } finally {
      if (mountedRef.current) {
        setIsRefetching(false)
      }
    }
  }, [queryFn, queryOptions])

  // Initial fetch
  useEffect(() => {
    if (enabled && pages.length === 0) {
      fetchInitialPage()
    }
  }, [enabled, pages.length, fetchInitialPage])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  return {
    data: pages,
    error,
    isLoading,
    isError: !!error,
    isSuccess: !isLoading && !error && pages.length > 0,
    refetch,
    isRefetching,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
  }
}
