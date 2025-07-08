/**
 * useAuth hook tests
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import type { VibebaseClient } from '@vibebase/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../hooks/use-auth'
import { VibebaseProvider } from '../providers/vibebase-provider'

// Mock VibebaseClient
const mockAuth = {
  checkStatus: vi.fn(),
  loginWithProvider: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
}

const mockClient = {
  auth: mockAuth,
  clearAuth: vi.fn(),
  setUserToken: vi.fn(),
  setApiKey: vi.fn(),
  health: vi.fn().mockResolvedValue({ success: true }),
  disconnect: vi.fn(),
} as unknown as VibebaseClient

vi.mock('@vibebase/sdk', () => ({
  VibebaseClient: vi.fn().mockImplementation(() => mockClient),
}))

// Mock window.location
delete (window as Record<string, unknown>).location
window.location = { href: '' } as Location

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.href = ''
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <VibebaseProvider config={{ apiUrl: 'https://test.example.com' }}>{children}</VibebaseProvider>
  )

  it('should check auth status on mount', async () => {
    mockAuth.checkStatus.mockResolvedValueOnce({
      success: true,
      data: {
        authenticated: true,
        user: { id: '1', email: 'test@example.com' },
      },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockAuth.checkStatus).toHaveBeenCalled()
    expect(result.current.user).toEqual({ id: '1', email: 'test@example.com' })
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('should handle unauthenticated state', async () => {
    mockAuth.checkStatus.mockResolvedValueOnce({
      success: true,
      data: {
        authenticated: false,
        user: null,
      },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('should handle login', async () => {
    mockAuth.loginWithProvider.mockResolvedValue('https://auth.example.com/login')

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login('github')
    })

    expect(mockAuth.loginWithProvider).toHaveBeenCalledWith('github', undefined)
    expect(window.location.href).toBe('https://auth.example.com/login')
  })

  it('should handle logout', async () => {
    mockAuth.logout.mockResolvedValueOnce({ success: true })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.logout()
    })

    expect(mockAuth.logout).toHaveBeenCalled()
    expect(mockClient.clearAuth).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
  })

  it('should handle token refresh', async () => {
    mockAuth.refreshToken.mockResolvedValueOnce({
      success: true,
      data: {
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      },
    })

    mockAuth.checkStatus.mockResolvedValueOnce({
      success: true,
      data: {
        authenticated: true,
        user: { id: '1', email: 'test@example.com' },
      },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.refreshToken('old-refresh-token')
    })

    expect(mockAuth.refreshToken).toHaveBeenCalledWith('old-refresh-token')
    expect(mockClient.setUserToken).toHaveBeenCalledWith('new-token')
    expect(mockAuth.checkStatus).toHaveBeenCalled()
  })

  it('should handle setUserToken', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      result.current.setUserToken('user-token')
    })

    expect(mockClient.setUserToken).toHaveBeenCalledWith('user-token')
    expect(mockAuth.checkStatus).toHaveBeenCalled()
  })

  it('should handle setApiKey', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    act(() => {
      result.current.setApiKey('api-key')
    })

    expect(mockClient.setApiKey).toHaveBeenCalledWith('api-key')
    expect(result.current.user).toBeNull()
  })

  it('should handle auth check errors', async () => {
    mockAuth.checkStatus.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Network error')
    expect(result.current.user).toBeNull()
  })
})
