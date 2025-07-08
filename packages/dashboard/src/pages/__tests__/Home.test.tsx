import { render, screen, waitFor } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '../Home'

// Mock the API
vi.mock('../../lib/api', () => ({
  api: {
    health: vi.fn(),
    getTables: vi.fn(),
  },
}))

// Mock fetch for OAuth providers and push rules APIs
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('HomePage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Setup default mocks
    const { api } = await import('../../lib/api')
    vi.mocked(api.health).mockResolvedValue({ database: 'connected' })
    vi.mocked(api.getTables).mockResolvedValue({
      tables: [
        { name: 'posts', type: 'user', sql: '', rowCount: 0 },
        { name: 'comments', type: 'user', sql: '', rowCount: 0 },
        { name: 'admins', type: 'system', sql: '', rowCount: 0 },
        { name: 'sessions', type: 'system', sql: '', rowCount: 0 },
        { name: 'vapid_config', type: 'system', sql: '', rowCount: 0 },
      ],
    })
  })

  describe('Dashboard Cards', () => {
    it('should render 4 dashboard cards', async () => {
      // Mock API responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              providers: [
                { provider: 'github', is_enabled: true },
                { provider: 'google', is_enabled: false },
              ],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rules: [
                { id: '1', enabled: true, name: 'New User' },
                { id: '2', enabled: false, name: 'Order Created' },
                { id: '3', enabled: true, name: 'Comment Added' },
              ],
            }),
        })

      render(<HomePage />)

      await waitFor(() => {
        // Check that all 4 cards are rendered
        expect(screen.getByText('User Tables')).toBeInTheDocument()
        expect(screen.getByText('Storage')).toBeInTheDocument()
        expect(screen.getByText('OAuth Providers')).toBeInTheDocument()
        expect(screen.getByText('Push Rules')).toBeInTheDocument()
      })
    })

    it('should display correct user tables count', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ providers: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ rules: [] }) })

      render(<HomePage />)

      await waitFor(() => {
        // Should count only user tables (posts, comments) = 2 tables
        expect(screen.getByText('2 tables')).toBeInTheDocument()
      })
    })

    it('should display correct OAuth providers count', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              providers: [
                { provider: 'github', is_enabled: true },
                { provider: 'google', is_enabled: false },
                { provider: 'discord', is_enabled: true },
              ],
            }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ rules: [] }) })

      render(<HomePage />)

      await waitFor(() => {
        // Should count only enabled providers (github, discord) = 2 enabled
        expect(screen.getByText('2 enabled')).toBeInTheDocument()
      })
    })

    it('should display correct push rules count', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ providers: [] }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rules: [
                { id: '1', enabled: true, name: 'New User' },
                { id: '2', enabled: false, name: 'Order Created' },
                { id: '3', enabled: true, name: 'Comment Added' },
                { id: '4', enabled: true, name: 'System Alert' },
              ],
            }),
        })

      render(<HomePage />)

      await waitFor(() => {
        // Should count only enabled rules (3 enabled) = 3 rules
        expect(screen.getByText('3 rules')).toBeInTheDocument()
      })
    })

    it('should use correct API endpoints', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ providers: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ rules: [] }) })

      render(<HomePage />)

      await waitFor(() => {
        // Check that correct API endpoints are called
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/oauth/providers', {
          credentials: 'include',
        })
        expect(mockFetch).toHaveBeenCalledWith('/api/push/rules', { credentials: 'include' })
      })
    })

    it('should handle API errors gracefully', async () => {
      // Mock API failures
      mockFetch
        .mockRejectedValueOnce(new Error('OAuth API failed'))
        .mockRejectedValueOnce(new Error('Push API failed'))

      render(<HomePage />)

      await waitFor(() => {
        // Should still render the page and show 0 counts for failed APIs
        expect(screen.getByText('User Tables')).toBeInTheDocument()
        expect(screen.getByText('0 enabled')).toBeInTheDocument() // OAuth providers fallback
        expect(screen.getByText('0 rules')).toBeInTheDocument() // Push rules fallback
      })
    })

    it('should handle non-ok API responses gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 403 })
        .mockResolvedValueOnce({ ok: false, status: 500 })

      render(<HomePage />)

      await waitFor(() => {
        // Should show 0 counts when API returns non-ok responses
        expect(screen.getByText('0 enabled')).toBeInTheDocument()
        expect(screen.getByText('0 rules')).toBeInTheDocument()
      })
    })
  })

  describe('Dashboard Metrics Integration', () => {
    it('should filter system tables correctly when counting user tables', async () => {
      const { api } = await import('../../lib/api')
      vi.mocked(api.getTables).mockResolvedValue({
        tables: [
          { name: 'posts', type: 'user', sql: '', rowCount: 0 },
          { name: 'comments', type: 'user', sql: '', rowCount: 0 },
          { name: 'products', type: 'user', sql: '', rowCount: 0 },
          // System tables that should be excluded
          { name: 'admins', type: 'system', sql: '', rowCount: 0 },
          { name: 'sessions', type: 'system', sql: '', rowCount: 0 },
          { name: 'vapid_config', type: 'system', sql: '', rowCount: 0 }, // Our new addition
          { name: 'oauth_providers', type: 'system', sql: '', rowCount: 0 },
        ],
      })

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ providers: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ rules: [] }) })

      render(<HomePage />)

      await waitFor(() => {
        // Should count only user tables (posts, comments, products) = 3 tables
        expect(screen.getByText('3 tables')).toBeInTheDocument()
      })
    })

    it('should properly filter enabled OAuth providers', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              providers: [
                { provider: 'github', is_enabled: true, client_id: 'xxx' },
                { provider: 'google', is_enabled: false, client_id: 'yyy' },
                { provider: 'discord', is_enabled: true, client_id: 'zzz' },
                { provider: 'twitter', is_enabled: false, client_id: 'aaa' },
              ],
            }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ rules: [] }) })

      render(<HomePage />)

      await waitFor(() => {
        // Should count only enabled providers (github, discord) = 2 enabled
        expect(screen.getByText('2 enabled')).toBeInTheDocument()
      })
    })

    it('should properly filter enabled push notification rules', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ providers: [] }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rules: [
                { id: '1', enabled: true, name: 'New User Registration' },
                { id: '2', enabled: false, name: 'Order Created' },
                { id: '3', enabled: true, name: 'Comment Added' },
                { id: '4', enabled: false, name: 'System Maintenance' },
                { id: '5', enabled: true, name: 'Important Alert' },
              ],
            }),
        })

      render(<HomePage />)

      await waitFor(() => {
        // Should count only enabled rules (1, 3, 5) = 3 rules
        expect(screen.getByText('3 rules')).toBeInTheDocument()
      })
    })

    it('should handle empty or missing data arrays', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // No providers key
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ rules: null }) }) // Null rules

      render(<HomePage />)

      await waitFor(() => {
        // Should default to 0 for missing/null data
        expect(screen.getByText('0 enabled')).toBeInTheDocument()
        expect(screen.getByText('0 rules')).toBeInTheDocument()
      })
    })
  })

  describe('Storage Status', () => {
    it('should show storage as ready with connected status', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ providers: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ rules: [] }) })

      render(<HomePage />)

      await waitFor(() => {
        expect(screen.getByText('Storage')).toBeInTheDocument()
        expect(screen.getByText('Ready')).toBeInTheDocument()
      })
    })
  })
})
