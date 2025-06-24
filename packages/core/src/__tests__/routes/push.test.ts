import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { push } from '../../routes/push'
import type { Env } from '../../types'
import { createMockD1Database } from '../setup'

// Mock NotificationManager
vi.mock('../../lib/notification-manager', () => ({
  NotificationManager: class MockNotificationManager {
    subscribe = vi.fn().mockResolvedValue('sub-123')
    unsubscribe = vi.fn().mockResolvedValue(undefined)
    getUserSubscriptions = vi.fn().mockResolvedValue([])
    createRule = vi.fn().mockResolvedValue('rule-123')
    sendNotification = vi.fn().mockResolvedValue({ sent: 1, failed: 0 })
  },
}))

describe('Push Routes', () => {
  let app: Hono<{ Bindings: Env }>
  let env: Env

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>()

    env = {
      DB: createMockD1Database() as any,
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
      const res = await app.request(req, env as any)

      expect(res.status).toBe(200)
      const data = (await res.json()) as { publicKey: string }
      expect(data.publicKey).toBe('test-public-key')
    })

    it('should return error if VAPID key not configured', async () => {
      // Create app with no VAPID key
      const testApp = new Hono<{ Bindings: Env }>()
      const testEnv = { ...env, VAPID_PUBLIC_KEY: undefined }

      testApp.use('*', async (c, next) => {
        c.env = testEnv
        await next()
      })
      testApp.route('/api/push', push)

      const req = new Request('http://localhost/api/push/vapid-public-key')
      const res = await testApp.request(req)

      expect(res.status).toBe(500)
      const data = (await res.json()) as { error: string }
      expect(data.error).toBe('VAPID public key not configured')
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
      const data = await res.json() as { error: string }
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

      expect(res.status).toBe(200)
      const data = (await res.json()) as { success: boolean; ruleId: string }
      expect(data.success).toBe(true)
      expect(data.ruleId).toBe('rule-123')
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
      const data = await res.json() as { error: string; details: unknown }
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
      const data = (await res.json()) as { success: boolean; result: { sent: number; failed: number } }
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
