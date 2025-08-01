import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { push } from '../../routes/push'
import type { Env } from '../../types'
import type { D1Database } from '../../types/cloudflare'
import { createMockD1Database } from '../setup'

// Mock NotificationManager
const mockCreateRule = vi.fn().mockResolvedValue('rule-123')
vi.mock('../../lib/notification-manager', () => ({
  NotificationManager: class MockNotificationManager {
    subscribe = vi.fn().mockResolvedValue('sub-123')
    unsubscribe = vi.fn().mockResolvedValue(undefined)
    getUserSubscriptions = vi.fn().mockResolvedValue([])
    createRule = mockCreateRule
    sendNotification = vi.fn().mockResolvedValue({ sent: 1, failed: 0 })
  },
}))

// Mock VapidStorage
const mockVapidStorage = {
  retrieve: vi.fn(),
  isConfigured: vi.fn(),
}

vi.mock('../../lib/vapid-storage', () => ({
  VapidStorage: class MockVapidStorage {
    retrieve = mockVapidStorage.retrieve
    isConfigured = mockVapidStorage.isConfigured
  },
}))

describe('Push Routes', () => {
  let app: Hono<{ Bindings: Env }>
  let env: Env

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup default VapidStorage mock responses
    mockVapidStorage.retrieve.mockResolvedValue({
      publicKey: 'test-public-key',
      privateKey: 'test-private-key',
      subject: 'mailto:test@example.com',
    })
    mockVapidStorage.isConfigured.mockResolvedValue(true)

    app = new Hono<{ Bindings: Env }>()

    const mockDB = createMockD1Database() as unknown as D1Database

    // Mock the notification_rules query
    const originalPrepare = mockDB.prepare
    mockDB.prepare = (sql: string) => {
      if (sql.includes('SELECT * FROM notification_rules WHERE id = ?')) {
        return {
          bind: () => ({
            first: () =>
              Promise.resolve({
                id: 'rule-123',
                name: 'Test Rule',
                trigger_type: 'db_change',
                table_name: 'messages',
                event_type: 'insert',
                recipient_type: 'all_users',
                recipient_value: null,
                title_template: 'New message',
                body_template: 'You have a new message',
                priority: 'normal',
                ttl: 86400,
                enabled: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }),
          }),
          run: () =>
            Promise.resolve({
              results: [],
              success: true,
              meta: {
                changes: 0,
                last_row_id: 0,
                duration: 0,
                size_after: 0,
                rows_read: 0,
                rows_written: 0,
              },
            }),
          all: () =>
            Promise.resolve({
              results: [],
              success: true,
              meta: {
                changes: 0,
                last_row_id: 0,
                duration: 0,
                size_after: 0,
                rows_read: 0,
                rows_written: 0,
              },
            }),
          raw: () =>
            Promise.resolve({
              results: [],
              success: true,
              meta: {
                changes: 0,
                last_row_id: 0,
                duration: 0,
                size_after: 0,
                rows_read: 0,
                rows_written: 0,
              },
            }),
        } as unknown as D1PreparedStatement
      }
      return originalPrepare.call(mockDB, sql)
    }

    env = {
      DB: mockDB,
      VAPID_PUBLIC_KEY: 'test-public-key',
      VAPID_PRIVATE_KEY: 'test-private-key',
      VAPID_SUBJECT: 'mailto:test@example.com',
      ASSETS: { fetch: () => Promise.resolve(new Response()) },
      ENVIRONMENT: 'development',
    } as Env

    // Add middleware to set environment and default auth context
    app.use('*', async (c, next) => {
      c.env = env
      const authContext = c.get('authContext')
      if (!authContext) {
        // Default to admin context for tests
        c.set('authContext', {
          type: 'admin' as const,
          user: {
            id: 'admin-123',
            email: 'admin@test.com',
            provider: 'github',
            provider_id: 'admin-github-123',
            role: 'admin',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        })
      }
      await next()
    })

    app.route('/api/push', push)
  })

  describe('GET /vapid-public-key', () => {
    it('should return VAPID public key', async () => {
      const req = new Request('http://localhost/api/push/vapid-public-key')
      const res = await app.request(req, undefined, { env })

      expect(res.status).toBe(200)
      const data = (await res.json()) as { publicKey: string }
      expect(data.publicKey).toBe('test-public-key')
    })

    it('should return error if VAPID key not configured', async () => {
      // Override mock to return null (not configured)
      mockVapidStorage.retrieve.mockResolvedValueOnce(null)

      const req = new Request('http://localhost/api/push/vapid-public-key')
      const res = await app.request(req, undefined, { env })

      expect(res.status).toBe(500)
      const data = (await res.json()) as { error: string }
      expect(data.error).toBe('VAPID keys not configured')
    })
  })

  describe('POST /admin/subscribe', () => {
    it('should require admin authentication', async () => {
      // Create app with user auth context (should fail)
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.use('*', async (c, next) => {
        c.env = env
        c.set('authContext', {
          type: 'user' as const,
          user: {
            id: 'user123',
            email: 'user@test.com',
            provider: 'github',
            provider_id: 'user-github-123',
            role: 'user',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          session: {
            id: 'session123',
            user_id: 'user123',
            access_token_hash: 'hash123',
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            token: 'token123',
          },
        })
        await next()
      })
      testApp.route('/api/push', push)

      const req = new Request('http://localhost/api/push/admin/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: 'https://fcm.googleapis.com/test',
            keys: { p256dh: 'test', auth: 'test' },
          },
        }),
      })

      const res = await testApp.request(req)

      expect(res.status).toBe(403)
      const data = (await res.json()) as { error: string }
      expect(data.error).toBe('Admin access required')
    })

    it('should subscribe admin for testing', async () => {
      // Create app with admin auth context
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.use('*', async (c, next) => {
        c.env = env
        c.set('authContext', {
          type: 'admin' as const,
          user: {
            id: 'admin123',
            email: 'admin@test.com',
            provider: 'github',
            provider_id: 'admin-github-123',
            role: 'admin',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        })
        await next()
      })
      testApp.route('/api/push', push)

      const req = new Request('http://localhost/api/push/admin/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: 'https://fcm.googleapis.com/test',
            keys: { p256dh: 'test', auth: 'test' },
          },
        }),
      })

      const res = await testApp.request(req)

      expect(res.status).toBe(200)
      const data = (await res.json()) as { success: boolean; subscriptionId: string }
      expect(data.success).toBe(true)
      expect(data.subscriptionId).toBe('sub-123')
    })
  })

  describe('POST /rules', () => {
    it('should require admin authentication', async () => {
      // Create app with user auth context (should fail)
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.use('*', async (c, next) => {
        c.env = env
        c.set('authContext', {
          type: 'user' as const,
          user: {
            id: 'user123',
            email: 'user@test.com',
            provider: 'github',
            provider_id: 'user-github-123',
            role: 'user',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          session: {
            id: 'session123',
            user_id: 'user123',
            access_token_hash: 'hash123',
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            token: 'token123',
          },
        })
        await next()
      })
      testApp.route('/api/push', push)

      const req = new Request('http://localhost/api/push/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Rule',
          triggerType: 'db_change',
          recipientType: 'all_users',
          titleTemplate: 'Test',
          bodyTemplate: 'Test',
        }),
      })

      const res = await testApp.request(req)

      expect(res.status).toBe(403)
    })

    it('should create notification rule', async () => {
      // Create app with admin auth context
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.use('*', async (c, next) => {
        c.env = env
        c.set('authContext', {
          type: 'admin' as const,
          user: {
            id: 'admin123',
            email: 'admin@test.com',
            provider: 'github',
            provider_id: 'admin-github-123',
            role: 'admin',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        })
        await next()
      })
      testApp.route('/api/push', push)

      const req = new Request('http://localhost/api/push/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Rule',
          triggerType: 'db_change',
          tableName: 'messages',
          eventType: 'insert',
          recipientType: 'all_users',
          titleTemplate: 'New message',
          bodyTemplate: 'You have a new message',
        }),
      })

      const res = await testApp.request(req)

      if (res.status !== 200) {
        const errorBody = await res.text()
        console.log('Error response:', res.status, errorBody)
        console.log('Mock createRule calls:', mockCreateRule.mock.calls)
      }

      expect(res.status).toBe(200)
      const data = (await res.json()) as {
        id: string
        name: string
        triggerType: string
        tableName: string
        eventType: string
        recipientType: string
        titleTemplate: string
        bodyTemplate: string
        isEnabled: boolean
      }
      expect(data.id).toBe('rule-123')
      expect(data.name).toBe('Test Rule')
      expect(data.triggerType).toBe('db_change')
      expect(data.tableName).toBe('messages')
      expect(data.eventType).toBe('insert')
      expect(data.recipientType).toBe('all_users')
      expect(data.titleTemplate).toBe('New message')
      expect(data.bodyTemplate).toBe('You have a new message')
      expect(data.isEnabled).toBe(true)
    })

    it('should validate rule data', async () => {
      // Create app with admin auth context
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.use('*', async (c, next) => {
        c.env = env
        c.set('authContext', {
          type: 'admin' as const,
          user: {
            id: 'admin123',
            email: 'admin@test.com',
            provider: 'github',
            provider_id: 'admin-github-123',
            role: 'admin',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        })
        await next()
      })
      testApp.route('/api/push', push)

      const req = new Request('http://localhost/api/push/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '', // Invalid: empty name
          triggerType: 'db_change',
          recipientType: 'all_users',
          titleTemplate: '',
          bodyTemplate: '',
        }),
      })

      const res = await testApp.request(req)

      expect(res.status).toBe(400)
      const data = (await res.json()) as { error: string; details: unknown }
      expect(data.error).toBe('Invalid request')
      expect(data.details).toBeDefined()
    })
  })

  describe('POST /send', () => {
    it('should send notification to all users', async () => {
      // Create app with admin auth context
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.use('*', async (c, next) => {
        c.env = env
        c.set('authContext', {
          type: 'admin' as const,
          user: {
            id: 'admin123',
            email: 'admin@test.com',
            provider: 'github',
            provider_id: 'admin-github-123',
            role: 'admin',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        })
        await next()
      })
      testApp.route('/api/push', push)

      const req = new Request('http://localhost/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Notification',
          body: 'This is a test',
          recipientType: 'all_users',
        }),
      })

      const res = await testApp.request(req)

      expect(res.status).toBe(200)
      const data = (await res.json()) as {
        success: boolean
        result: { sent: number; failed: number }
      }
      expect(data.success).toBe(true)
      expect(data.result).toEqual({ sent: 1, failed: 0 })
    })

    it('should require admin or API key access', async () => {
      // Create app with user auth context (should fail)
      const testApp = new Hono<{ Bindings: Env }>()
      testApp.use('*', async (c, next) => {
        c.env = env
        c.set('authContext', {
          type: 'user' as const,
          user: {
            id: 'user123',
            email: 'user@test.com',
            provider: 'github',
            provider_id: 'user-github-123',
            role: 'user',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          session: {
            id: 'session123',
            user_id: 'user123',
            access_token_hash: 'hash123',
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            token: 'token123',
          },
        })
        await next()
      })
      testApp.route('/api/push', push)

      const req = new Request('http://localhost/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Notification',
          body: 'This is a test',
        }),
      })

      const res = await testApp.request(req)

      expect(res.status).toBe(403)
    })
  })
})
