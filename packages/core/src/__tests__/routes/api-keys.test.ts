import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_SCOPES, APIKeyManager } from '../../lib/api-key-manager'
import { apiKeys } from '../../routes/api-keys'
import type { Env, Variables } from '../../types'

// Mock auth middleware to bypass authentication
vi.mock('../../middleware/auth', () => ({
  requireAuth: vi.fn().mockImplementation(async (c, next) => {
    // Set a mock user for authentication
    c.set('user', {
      id: 123,
      username: 'testuser',
      email: 'test@example.com',
      name: 'Test User',
      scope: ['admin'],
    })
    await next()
  }),
  getCurrentUser: vi.fn().mockReturnValue({
    id: 123,
    username: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    scope: ['admin'],
  }),
  getAuthContext: vi.fn(),
  requireScope: vi.fn(),
  multiAuth: vi.fn().mockImplementation(async (_c, next) => {
    await next()
  }),
}))

// Mock the APIKeyManager
vi.mock('../../lib/api-key-manager', () => ({
  APIKeyManager: vi.fn(),
  API_SCOPES: {
    'data:read': 'Read data from tables',
    'data:write': 'Create and update data in tables',
    'data:delete': 'Delete data from tables',
    'tables:read': 'View table schemas',
    'tables:write': 'Create and modify table schemas',
    'tables:delete': 'Delete tables',
    'storage:read': 'Read files from storage',
    'storage:write': 'Upload files to storage',
    'storage:delete': 'Delete files from storage',
    'admin:read': 'Read administrative data',
    'admin:write': 'Perform administrative operations',
  },
}))

describe('API Keys Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let mockEnv: Env
  let mockAPIKeyManager: any

  beforeEach(() => {
    vi.clearAllMocks()

    app = new Hono()

    mockAPIKeyManager = {
      initializeTable: vi.fn(),
      createAPIKey: vi.fn(),
      listAPIKeys: vi.fn(),
      revokeAPIKey: vi.fn(),
      deleteAPIKey: vi.fn(),
    }

    // Mock the APIKeyManager constructor to return our mock
    vi.mocked(APIKeyManager).mockImplementation(() => mockAPIKeyManager)

    mockEnv = {
      DB: {} as any,
      SESSIONS: {} as any,
      SYSTEM_STORAGE: {} as any,
      USER_STORAGE: {} as any,
      ASSETS: { fetch: vi.fn() } as any,
      VIBEBASE_AUTH_URL: 'https://auth.example.com',
      DEPLOYMENT_DOMAIN: 'example.com',
      WORKER_NAME: 'test-worker',
      ENVIRONMENT: 'development',
    }

    // Mock authentication middleware - set env and variables
    app.use('*', async (c, next) => {
      c.env = mockEnv
      await next()
    })

    // Mock admin lookup for all tests
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ id: 'admin-123' }),
        }),
      }),
    }
    mockEnv.DB = mockDB as any

    app.route('/api/api-keys', apiKeys)
  })

  describe('POST /init', () => {
    it('should initialize API keys table', async () => {
      mockAPIKeyManager.initializeTable.mockResolvedValue(undefined)

      const response = await app.request('/api/api-keys/init', {
        method: 'POST',
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as any
      expect(data.success).toBe(true)
      expect(data.message).toBe('API keys table initialized')
      expect(mockAPIKeyManager.initializeTable).toHaveBeenCalled()
    })

    it('should handle initialization errors', async () => {
      mockAPIKeyManager.initializeTable.mockRejectedValue(new Error('Table creation failed'))

      const response = await app.request('/api/api-keys/init', {
        method: 'POST',
      })

      expect(response.status).toBe(500)
      const data = (await response.json()) as any
      expect(data.error).toBe('Failed to initialize API keys table')
      expect(data.details).toBe('Table creation failed')
    })
  })

  describe('GET /scopes', () => {
    it('should return available scopes', async () => {
      const response = await app.request('/api/api-keys/scopes')

      expect(response.status).toBe(200)
      const data = (await response.json()) as any
      expect(data.scopes).toEqual(API_SCOPES)
    })
  })

  describe('GET /', () => {
    it('should list API keys for current user', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          name: 'Test Key 1',
          key_prefix: 'vb_live_abc123...',
          scopes: ['data:read'],
          created_at: '2023-01-01T00:00:00Z',
          is_active: true,
        },
      ]

      mockAPIKeyManager.listAPIKeys.mockResolvedValue(mockKeys)

      const response = await app.request('/api/api-keys')

      expect(response.status).toBe(200)
      const data = (await response.json()) as any
      expect(data.data).toEqual(mockKeys)
      expect(mockAPIKeyManager.listAPIKeys).toHaveBeenCalledWith('admin-123')
    })

    it('should handle user not found in database', async () => {
      const mockDB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        }),
      }
      mockEnv.DB = mockDB as any

      const response = await app.request('/api/api-keys')

      expect(response.status).toBe(404)
      const data = (await response.json()) as any
      expect(data.error).toBe('Admin not found')
    })

    it('should handle list API keys errors', async () => {
      mockAPIKeyManager.listAPIKeys.mockRejectedValue(new Error('Database error'))

      const response = await app.request('/api/api-keys')

      expect(response.status).toBe(500)
      const data = (await response.json()) as any
      expect(data.error).toBe('Failed to list API keys')
    })
  })

  describe('POST /', () => {
    it('should create new API key', async () => {
      const mockCreatedKey = {
        id: 'key-123',
        name: 'Test Key',
        key: 'vb_live_test-key-123',
        scopes: ['data:read', 'data:write'],
        expires_at: null,
      }

      mockAPIKeyManager.createAPIKey.mockResolvedValue(mockCreatedKey)

      const response = await app.request('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Key',
          scopes: ['data:read', 'data:write'],
        }),
      })

      expect(response.status).toBe(201)
      const data = (await response.json()) as any
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockCreatedKey)
      expect(data.message).toContain('Save the key securely')
      expect(mockAPIKeyManager.createAPIKey).toHaveBeenCalledWith(
        {
          name: 'Test Key',
          scopes: ['data:read', 'data:write'],
        },
        'admin-123'
      )
    })

    it('should validate request body', async () => {
      const response = await app.request('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Key',
          // missing scopes
        }),
      })

      expect(response.status).toBe(400)
      const data = (await response.json()) as any
      expect(data.error).toBe('Validation failed')
      expect(data.details).toContain('name and scopes are required')
    })

    it('should validate scopes', async () => {
      const response = await app.request('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Key',
          scopes: ['invalid:scope', 'data:read'],
        }),
      })

      expect(response.status).toBe(400)
      const data = (await response.json()) as any
      expect(data.error).toBe('Invalid scopes')
      expect(data.details[0]).toContain('invalid:scope')
      expect(data.valid_scopes).toBeTruthy()
    })

    it('should handle create API key errors', async () => {
      mockAPIKeyManager.createAPIKey.mockRejectedValue(new Error('Creation failed'))

      const response = await app.request('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Key',
          scopes: ['data:read'],
        }),
      })

      expect(response.status).toBe(500)
      const data = (await response.json()) as any
      expect(data.error).toBe('Failed to create API key')
      expect(data.details).toBe('Creation failed')
    })
  })

  describe('PATCH /:id/revoke', () => {
    it('should revoke API key', async () => {
      const mockKeys = [
        {
          id: 'key-123',
          name: 'Test Key',
          is_active: true,
        },
      ]

      mockAPIKeyManager.listAPIKeys.mockResolvedValue(mockKeys)
      mockAPIKeyManager.revokeAPIKey.mockResolvedValue(true)

      const response = await app.request('/api/api-keys/key-123/revoke', {
        method: 'PATCH',
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as any
      expect(data.success).toBe(true)
      expect(data.message).toBe('API key revoked successfully')
      expect(mockAPIKeyManager.revokeAPIKey).toHaveBeenCalledWith('key-123', 'admin-123')
    })

    it('should return 404 when key not found', async () => {
      mockAPIKeyManager.listAPIKeys.mockResolvedValue([])

      const response = await app.request('/api/api-keys/nonexistent-key/revoke', {
        method: 'PATCH',
      })

      expect(response.status).toBe(404)
      const data = (await response.json()) as any
      expect(data.error).toBe('API key not found or access denied')
    })

    it('should handle revoke failures', async () => {
      const mockKeys = [
        {
          id: 'key-123',
          name: 'Test Key',
          is_active: true,
        },
      ]

      mockAPIKeyManager.listAPIKeys.mockResolvedValue(mockKeys)
      mockAPIKeyManager.revokeAPIKey.mockResolvedValue(false)

      const response = await app.request('/api/api-keys/key-123/revoke', {
        method: 'PATCH',
      })

      expect(response.status).toBe(500)
      const data = (await response.json()) as any
      expect(data.error).toBe('Failed to revoke API key')
    })
  })

  describe('DELETE /:id', () => {
    it('should delete API key', async () => {
      mockAPIKeyManager.deleteAPIKey.mockResolvedValue(true)

      const response = await app.request('/api/api-keys/key-123', {
        method: 'DELETE',
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as any
      expect(data.success).toBe(true)
      expect(data.message).toBe('API key deleted successfully')
      expect(mockAPIKeyManager.deleteAPIKey).toHaveBeenCalledWith('key-123', 'admin-123')
    })

    it('should return 404 when key not found', async () => {
      mockAPIKeyManager.deleteAPIKey.mockResolvedValue(false)

      const response = await app.request('/api/api-keys/nonexistent-key', {
        method: 'DELETE',
      })

      expect(response.status).toBe(404)
      const data = (await response.json()) as any
      expect(data.error).toBe('API key not found or access denied')
    })

    it('should handle delete errors', async () => {
      mockAPIKeyManager.deleteAPIKey.mockRejectedValue(new Error('Database error'))

      const response = await app.request('/api/api-keys/key-123', {
        method: 'DELETE',
      })

      expect(response.status).toBe(500)
      const data = (await response.json()) as any
      expect(data.error).toBe('Failed to delete API key')
    })
  })

  describe('Database unavailable', () => {
    it('should handle missing database', async () => {
      mockEnv.DB = null as any

      const response = await app.request('/api/api-keys')

      expect(response.status).toBe(503)
      const data = (await response.json()) as any
      expect(data.error).toBe('Database not available')
    })
  })
})
