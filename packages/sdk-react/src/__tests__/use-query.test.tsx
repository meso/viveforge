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

  it.skip('should retry on failure', async () => {
    vi.useFakeTimers()

    const queryFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('First fail'))
      .mockRejectedValueOnce(new Error('Second fail'))
      .mockResolvedValueOnce({ success: true })

    const { result } = renderHook(() => useQuery(queryFn, { retry: 2 }))

    // First call happens immediately
    expect(queryFn).toHaveBeenCalledTimes(1)

    // Wait for the initial call to complete
    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(1)
    })

    // Advance timer for first retry (2^0 * 1000 = 1000ms)
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(2)
    })

    // Advance timer for second retry (2^1 * 1000 = 2000ms)
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual({ success: true })
    expect(result.current.error).toBeNull()
    expect(queryFn).toHaveBeenCalledTimes(3)

    vi.useRealTimers()
  }, 10000)

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

  it.skip('should refetch on interval', async () => {
    vi.useFakeTimers()
    const queryFn = vi.fn().mockResolvedValue({ data: 'test' })

    const { result } = renderHook(() => useQuery(queryFn, { refetchInterval: 100 }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(queryFn).toHaveBeenCalledTimes(1)

    // Advance timer by 100ms
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    await waitFor(() => {
      expect(queryFn).toHaveBeenCalledTimes(2)
    })

    vi.useRealTimers()
  }, 10000)

  it.skip('should cleanup interval on unmount', async () => {
    vi.useFakeTimers()
    const queryFn = vi.fn().mockResolvedValue({ data: 'test' })

    const { unmount, result } = renderHook(() => useQuery(queryFn, { refetchInterval: 100 }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(queryFn).toHaveBeenCalledTimes(1)

    unmount()

    // Advance timer by 150ms
    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    // Should not be called again after unmount
    expect(queryFn).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  }, 10000)
})
