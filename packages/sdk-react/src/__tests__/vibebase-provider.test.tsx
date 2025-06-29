/**
 * VibebaseProvider tests
 */

import { render, screen, waitFor } from '@testing-library/react'
import { VibebaseClient } from '@vibebase/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useVibebase, VibebaseProvider } from '../providers/vibebase-provider'

// Mock VibebaseClient
vi.mock('@vibebase/sdk', () => ({
  VibebaseClient: vi.fn().mockImplementation(() => ({
    health: vi.fn().mockResolvedValue({ success: true }),
    disconnect: vi.fn(),
  })),
}))

// Test component that uses the hook
function TestComponent() {
  const { client, isReady } = useVibebase()
  return (
    <div>
      <div data-testid="client">{client ? 'Client exists' : 'No client'}</div>
      <div data-testid="ready">{isReady ? 'Ready' : 'Not ready'}</div>
    </div>
  )
}

describe('VibebaseProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should provide client context to children', async () => {
    render(
      <VibebaseProvider config={{ apiUrl: 'https://test.example.com' }}>
        <TestComponent />
      </VibebaseProvider>
    )

    expect(screen.getByTestId('client')).toHaveTextContent('Client exists')

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('Ready')
    })
  })

  it('should use provided client if given', () => {
    const mockClient = new VibebaseClient({ apiUrl: 'https://test.example.com' })

    render(
      <VibebaseProvider config={{ apiUrl: 'https://test.example.com' }} client={mockClient}>
        <TestComponent />
      </VibebaseProvider>
    )

    expect(screen.getByTestId('client')).toHaveTextContent('Client exists')
  })

  it('should call disconnect on unmount', () => {
    const mockClient = new VibebaseClient({ apiUrl: 'https://test.example.com' })
    const disconnectSpy = vi.spyOn(mockClient, 'disconnect')

    const { unmount } = render(
      <VibebaseProvider config={{ apiUrl: 'https://test.example.com' }} client={mockClient}>
        <TestComponent />
      </VibebaseProvider>
    )

    unmount()

    expect(disconnectSpy).toHaveBeenCalled()
  })

  it('should throw error when useVibebase is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useVibebase must be used within a VibebaseProvider')

    consoleSpy.mockRestore()
  })

  it('should handle health check failure gracefully', async () => {
    const mockClient = {
      health: vi.fn().mockRejectedValue(new Error('Connection failed')),
      disconnect: vi.fn(),
    }

    vi.mocked(VibebaseClient).mockImplementationOnce(() => mockClient as any)

    render(
      <VibebaseProvider config={{ apiUrl: 'https://test.example.com' }}>
        <TestComponent />
      </VibebaseProvider>
    )

    // Should still mark as ready even if health check fails
    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('Ready')
    })
  })
})
