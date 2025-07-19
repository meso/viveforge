/**
 * Data operations hook
 */

import type { TableRow } from '@vibebase/sdk'
import { useCallback, useEffect } from 'react'
import { useVibebase } from '../providers/vibebase-provider'
import type { UseDataOptions, UseDataResult } from '../types'
import { useMutation } from './use-mutation'
import { useQuery } from './use-query'

export function useData<T extends TableRow = TableRow>(
  tableName: string,
  options: UseDataOptions = {}
): UseDataResult<T> {
  const { client } = useVibebase()
  const { realtimeEnabled = false, ...queryOptions } = options

  // Fetch data
  const {
    data: queryData,
    error,
    isLoading,
    refetch,
  } = useQuery(
    async () => {
      const response = await client.data.list<T>(tableName, queryOptions)
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch data')
      }
      return response
    },
    { refetchOnWindowFocus: false }
  )

  // Create mutation
  const createMutation = useMutation(
    async (data: Omit<T, 'id' | 'created_at' | 'updated_at'>) => {
      const response = await client.data.create<T>(tableName, data)
      if (!response.success) {
        throw new Error(response.error || 'Failed to create record')
      }
      return response.data || ({} as T)
    },
    {
      onSuccess: () => {
        // Refetch data after successful create
        refetch()
      },
    }
  )

  // Update mutation
  const updateMutation = useMutation(
    async ({
      id,
      data,
    }: {
      id: string
      data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>
    }) => {
      const response = await client.data.update<T>(tableName, id, data)
      if (!response.success) {
        throw new Error(response.error || 'Failed to update record')
      }
      return response.data || ({} as T)
    },
    {
      onSuccess: () => {
        // Refetch data after successful update
        refetch()
      },
    }
  )

  // Delete mutation
  const deleteMutation = useMutation(
    async (id: string) => {
      const response = await client.data.delete(tableName, id)
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete record')
      }
    },
    {
      onSuccess: () => {
        // Refetch data after successful delete
        refetch()
      },
    }
  )

  // Subscribe to realtime updates if enabled
  useEffect(() => {
    if (!realtimeEnabled || !queryData) return

    const unsubscribe = client.realtime.subscribe(tableName, '*', (_event) => {
      // Refetch data when any change occurs
      refetch()
    })

    return () => {
      unsubscribe.unsubscribe()
    }
  }, [realtimeEnabled, tableName, client, refetch, queryData])

  // Wrapper functions
  const create = useCallback(
    async (data: Omit<T, 'id' | 'created_at' | 'updated_at'>) => {
      return createMutation.mutateAsync(data)
    },
    [createMutation]
  )

  const update = useCallback(
    async (id: string, data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>) => {
      return updateMutation.mutateAsync({ id, data })
    },
    [updateMutation]
  )

  const deleteRecord = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id)
    },
    [deleteMutation]
  )

  return {
    data: queryData?.data || [],
    total: queryData?.total || 0,
    error: error || createMutation.error || updateMutation.error || deleteMutation.error,
    isLoading,
    refetch,
    create,
    update,
    delete: deleteRecord,
    isCreating: createMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
  }
}
