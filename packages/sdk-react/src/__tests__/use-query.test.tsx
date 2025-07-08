/**
 * useQuery hook tests
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuery } from '../hooks/use-query'

describe('useQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should fetch data on mount', async () => {
    const mockData = { id: 1, name: 'Test' }
    const queryFn = vi.fn().mockResolvedValue(mockData)

    const { result } = renderHook(() => useQuery(queryFn))

    expect(result.current.isLoading).toBe(true)
    expect(queryFn).toHaveBeenCalled()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.isSuccess).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('should handle errors', async () => {
    const error = new Error('Query failed')
    const queryFn = vi.fn().mockRejectedValue(error)
    const onError = vi.fn()

    const { result } = renderHook(() => useQuery(queryFn, { onError, retry: false }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe(error)
    expect(result.current.isError).toBe(true)
    expect(result.current.data).toBeUndefined()
    expect(onError).toHaveBeenCalledWith(error)
  })

  it('should not fetch when disabled', () => {
    const queryFn = vi.fn()

    renderHook(() => useQuery(queryFn, { enabled: false }))

    expect(queryFn).not.toHaveBeenCalled()
  })

  it('should refetch data', async () => {
    const queryFn = vi.fn().mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 })

    const { result } = renderHook(() => useQuery(queryFn))

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 1 })
    })

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.isRefetching).toBe(false)
    expect(result.current.data).toEqual({ id: 2 })
    expect(queryFn).toHaveBeenCalledTimes(2)
  })

  it('should call onSuccess callback', async () => {
    const mockData = { id: 1 }
    const queryFn = vi.fn().mockResolvedValue(mockData)
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useQuery(queryFn, { onSuccess }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(onSuccess).toHaveBeenCalledWith(mockData)
  }, 10000)
})
