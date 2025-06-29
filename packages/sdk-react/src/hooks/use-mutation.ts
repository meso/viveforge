/**
 * Generic mutation hook
 */
import { useCallback, useState } from 'react'
import type { UseMutationOptions, UseMutationResult } from '../types'

export function useMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables> = {}
): UseMutationResult<TData, TVariables> {
  const { onSuccess, onError, onMutate } = options

  const [data, setData] = useState<TData | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const reset = useCallback(() => {
    setData(undefined)
    setError(null)
    setIsLoading(false)
  }, [])

  const mutate = useCallback(
    async (variables: TVariables): Promise<void> => {
      try {
        setIsLoading(true)
        setError(null)

        // Call onMutate callback if provided
        const _context = await onMutate?.(variables)

        const result = await mutationFn(variables)
        setData(result)

        onSuccess?.(result, variables)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Mutation failed')
        setError(error)
        onError?.(error, variables)
      } finally {
        setIsLoading(false)
      }
    },
    [mutationFn, onSuccess, onError, onMutate]
  )

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      try {
        setIsLoading(true)
        setError(null)

        // Call onMutate callback if provided
        const _context = await onMutate?.(variables)

        const result = await mutationFn(variables)
        setData(result)

        onSuccess?.(result, variables)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Mutation failed')
        setError(error)
        onError?.(error, variables)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [mutationFn, onSuccess, onError, onMutate]
  )

  return {
    mutate,
    mutateAsync,
    data,
    error,
    isLoading,
    isError: !!error,
    isSuccess: !isLoading && !error && data !== undefined,
    reset,
  }
}
