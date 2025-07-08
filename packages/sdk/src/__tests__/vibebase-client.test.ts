/**
 * Tests for VibebaseClient
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VibebaseClient } from '../vibebase-client'

// Mock cross-fetch
vi.mock('cross-fetch', () => ({
  fetch: vi.fn(),
}))

const mockFetch = vi.mocked((await import('cross-fetch')).fetch)

describe('VibebaseClient', () => {
  let client: VibebaseClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    client = new VibebaseClient({
      apiUrl: 'https://test.example.com',
      apiKey: 'test-api-key',
    })
  })

  describe('constructor', () => {
    it('should create client with valid config', () => {
      expect(client).toBeInstanceOf(VibebaseClient)
      expect(client.data).toBeDefined()
      expect(client.auth).toBeDefined()
      expect(client.storage).toBeDefined()
      expect(client.realtime).toBeDefined()
      expect(client.customQueries).toBeDefined()
    })

    it('should throw error with invalid config', () => {
      expect(() => {
        new VibebaseClient({} as Parameters<typeof VibebaseClient>[0])
      }).toThrow('apiUrl is required')
    })

    it('should normalize apiUrl by removing trailing slash', () => {
      const clientWithSlash = new VibebaseClient({
        apiUrl: 'https://test.example.com/',
        apiKey: 'test-key',
      })
      expect(clientWithSlash).toBeInstanceOf(VibebaseClient)
    })
  })

  describe('authentication methods', () => {
    it('should set user token', () => {
      const setUserTokenSpy = vi.spyOn(client.auth, 'setUserToken')
      const realtimeSetAuthSpy = vi.spyOn(client.realtime, 'setAuth')

      client.setUserToken('new-user-token')

      expect(setUserTokenSpy).toHaveBeenCalledWith('new-user-token')
      expect(realtimeSetAuthSpy).toHaveBeenCalledWith('new-user-token')
    })

    it('should set API key', () => {
      const setApiKeySpy = vi.spyOn(client.auth, 'setApiKey')
      const realtimeSetAuthSpy = vi.spyOn(client.realtime, 'setAuth')

      client.setApiKey('new-api-key')

      expect(setApiKeySpy).toHaveBeenCalledWith('new-api-key')
      expect(realtimeSetAuthSpy).toHaveBeenCalledWith('new-api-key')
    })

    it('should clear auth', () => {
      const clearAuthSpy = vi.spyOn(client.auth, 'clearAuth')
      const realtimeDisconnectSpy = vi.spyOn(client.realtime, 'disconnect')

      client.clearAuth()

      expect(clearAuthSpy).toHaveBeenCalled()
      expect(realtimeDisconnectSpy).toHaveBeenCalled()
    })
  })

  describe('health check', () => {
    it('should call health endpoint', async () => {
      const mockResponse = {
        success: true,
        data: {
          status: 'ok',
          timestamp: '2023-12-01T00:00:00Z',
          version: '1.0.0',
        },
        status: 200,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockResponse.data)),
      } as Response)

      const result = await client.health()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.example.com/api/health',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Headers),
        })
      )
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse.data)
    })
  })

  describe('table operations', () => {
    it('should get tables list', async () => {
      const mockTables = [
        { name: 'users', row_count: 100, size: 1024, created_at: '2023-01-01' },
        { name: 'posts', row_count: 50, size: 512, created_at: '2023-01-02' },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockTables)),
      } as Response)

      const result = await client.getTables()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.example.com/api/tables',
        expect.objectContaining({
          method: 'GET',
        })
      )
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockTables)
    })

    it('should create table', async () => {
      const tableName = 'test_table'
      const columns = [
        { name: 'id', type: 'TEXT', primaryKey: true },
        { name: 'name', type: 'TEXT', nullable: false },
      ]

      const mockResponse = {
        name: tableName,
        sql: 'CREATE TABLE test_table...',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      } as Response)

      const result = await client.createTable(tableName, columns)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.example.com/api/tables',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: tableName, columns }),
        })
      )
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse)
    })
  })

  describe('disconnect', () => {
    it('should disconnect realtime connection', () => {
      const disconnectSpy = vi.spyOn(client.realtime, 'disconnect')

      client.disconnect()

      expect(disconnectSpy).toHaveBeenCalled()
    })
  })
})
