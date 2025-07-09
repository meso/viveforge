import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WebPushService } from '../../lib/push-service'

// Mock fetch globally
global.fetch = vi.fn()

// Mock the webcrypto-web-push library
vi.mock('@block65/webcrypto-web-push', () => ({
  buildPushPayload: vi.fn(),
}))

describe('WebPushService', () => {
  let service: WebPushService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new WebPushService(
      'BLk5DRYrDTproCdr3CVKQlinA66-Ab6DaLRyhvn_OMIYV5r2iazgiX4BQKgcmiMi_MSR2DJ2Xe60zz9gKj_oo4U',
      'AjV0e5aJ8v9U04x90r_VYF1CcC9FjQUrQ58WARPHO44',
      'mailto:test@example.com'
    )
  })

  describe('send', () => {
    it('should send push notification successfully', async () => {
      const { buildPushPayload } = await import('@block65/webcrypto-web-push')

      // Mock successful fetch response
      const mockResponse = new Response(null, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
      })
      vi.mocked(global.fetch).mockResolvedValue(mockResponse)

      // Mock buildPushPayload to return a valid fetch request object
      const mockPushPayload = {
        method: 'POST',
        headers: {
          'content-encoding': 'aes128gcm',
          'content-length': '64',
          'content-type': 'application/octet-stream',
          'crypto-key': 'dh=mock-key',
          encryption: 'salt=mock-salt',
          ttl: '86400',
          authorization: 'vapid t=mock-jwt-token, k=mock-public-key',
        },
        body: new Uint8Array(64),
      }
      vi.mocked(buildPushPayload).mockResolvedValue(mockPushPayload)

      const subscription = {
        id: 'sub1',
        userId: 'user123',
        provider: 'webpush' as const,
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        p256dh: 'test-p256dh',
        auth: 'test-auth',
      }

      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification',
      }

      const result = await service.send(subscription, payload)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      expect(buildPushPayload).toHaveBeenCalledWith(
        {
          data: {
            title: 'Test Notification',
            body: 'This is a test notification',
            icon: undefined,
            image: undefined,
            badge: undefined,
            tag: undefined,
            data: {},
            actions: undefined,
            requireInteraction: undefined,
            silent: undefined,
          },
        },
        {
          endpoint: subscription.endpoint,
          expirationTime: null,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        {
          subject: 'mailto:test@example.com',
          publicKey:
            'BLk5DRYrDTproCdr3CVKQlinA66-Ab6DaLRyhvn_OMIYV5r2iazgiX4BQKgcmiMi_MSR2DJ2Xe60zz9gKj_oo4U',
          privateKey: 'AjV0e5aJ8v9U04x90r_VYF1CcC9FjQUrQ58WARPHO44',
        }
      )
      expect(global.fetch).toHaveBeenCalledWith(subscription.endpoint, mockPushPayload)
    })

    it('should handle send failure', async () => {
      const { buildPushPayload } = await import('@block65/webcrypto-web-push')

      // Mock failed fetch response
      const mockResponse = new Response(null, {
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers(),
      })
      vi.mocked(global.fetch).mockResolvedValue(mockResponse)

      // Mock buildPushPayload to return a valid fetch request object
      const mockPushPayload = {
        method: 'POST',
        headers: {
          'content-encoding': 'aes128gcm',
          'content-length': '64',
          'content-type': 'application/octet-stream',
          'crypto-key': 'dh=mock-key',
          encryption: 'salt=mock-salt',
          ttl: '86400',
          authorization: 'vapid t=mock-jwt-token, k=mock-public-key',
        },
        body: new Uint8Array(64),
      }
      vi.mocked(buildPushPayload).mockResolvedValue(mockPushPayload)

      const subscription = {
        id: 'sub1',
        userId: 'user123',
        provider: 'webpush' as const,
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        p256dh: 'test-p256dh',
        auth: 'test-auth',
      }

      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification',
      }

      const result = await service.send(subscription, payload)

      expect(result.success).toBe(false)
      expect(result.statusCode).toBe(400)
      expect(result.error).toBe('HTTP 400: Bad Request')
    })

    it('should handle buildPushPayload errors', async () => {
      const { buildPushPayload } = await import('@block65/webcrypto-web-push')

      // Mock buildPushPayload to throw an error
      vi.mocked(buildPushPayload).mockRejectedValue(new Error('Invalid key format'))

      const subscription = {
        id: 'sub1',
        userId: 'user123',
        provider: 'webpush' as const,
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        p256dh: 'test-p256dh',
        auth: 'test-auth',
      }

      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification',
      }

      const result = await service.send(subscription, payload)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid key format')
    })
  })

  describe('sendBatch', () => {
    it('should send notifications to multiple subscriptions', async () => {
      const { buildPushPayload } = await import('@block65/webcrypto-web-push')

      // Mock successful responses
      const mockResponse = new Response(null, {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
      })
      vi.mocked(global.fetch).mockResolvedValue(mockResponse)

      // Mock buildPushPayload to return a valid fetch request object
      const mockPushPayload = {
        method: 'POST',
        headers: {
          'content-encoding': 'aes128gcm',
          'content-length': '64',
          'content-type': 'application/octet-stream',
          'crypto-key': 'dh=mock-key',
          encryption: 'salt=mock-salt',
          ttl: '86400',
          authorization: 'vapid t=mock-jwt-token, k=mock-public-key',
        },
        body: new Uint8Array(64),
      }
      vi.mocked(buildPushPayload).mockResolvedValue(mockPushPayload)

      const subscriptions = [
        {
          id: 'sub1',
          userId: 'user1',
          provider: 'webpush' as const,
          endpoint: 'https://fcm.googleapis.com/fcm/send/test1',
          p256dh: 'test-p256dh',
          auth: 'test-auth',
        },
        {
          id: 'sub2',
          userId: 'user2',
          provider: 'webpush' as const,
          endpoint: 'https://fcm.googleapis.com/fcm/send/test2',
          p256dh: 'test-p256dh',
          auth: 'test-auth',
        },
      ]

      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification',
      }

      const results = await service.sendBatch(subscriptions, payload)

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Invalid subscription handling', () => {
    it('should handle missing subscription endpoint', async () => {
      const subscription = {
        id: 'sub1',
        userId: 'user123',
        provider: 'webpush' as const,
        endpoint: '', // Missing endpoint
        p256dh: 'test-p256dh',
        auth: 'test-auth',
      }

      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification',
      }

      const result = await service.send(subscription, payload)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid subscription: missing endpoint, p256dh, or auth')
    })

    it('should handle missing p256dh key', async () => {
      const subscription = {
        id: 'sub1',
        userId: 'user123',
        provider: 'webpush' as const,
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        p256dh: '', // Missing p256dh
        auth: 'test-auth',
      }

      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification',
      }

      const result = await service.send(subscription, payload)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid subscription: missing endpoint, p256dh, or auth')
    })

    it('should handle missing auth key', async () => {
      const subscription = {
        id: 'sub1',
        userId: 'user123',
        provider: 'webpush' as const,
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        p256dh: 'test-p256dh',
        auth: '', // Missing auth
      }

      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification',
      }

      const result = await service.send(subscription, payload)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid subscription: missing endpoint, p256dh, or auth')
    })
  })

  describe('Payload structure', () => {
    it('should correctly structure message payload with all fields', async () => {
      const { buildPushPayload } = await import('@block65/webcrypto-web-push')

      // Mock successful fetch response
      const mockResponse = new Response(null, {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
      })
      vi.mocked(global.fetch).mockResolvedValue(mockResponse)

      // Mock buildPushPayload
      const mockPushPayload = {
        method: 'POST',
        headers: {
          'content-encoding': 'aes128gcm',
          'content-length': '64',
          'content-type': 'application/octet-stream',
          'crypto-key': 'dh=mock-key',
          encryption: 'salt=mock-salt',
          ttl: '86400',
          authorization: 'vapid t=mock-jwt-token, k=mock-public-key',
        },
        body: new Uint8Array(64),
      }
      vi.mocked(buildPushPayload).mockResolvedValue(mockPushPayload)

      const subscription = {
        id: 'sub1',
        userId: 'user123',
        provider: 'webpush' as const,
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        p256dh: 'test-p256dh',
        auth: 'test-auth',
      }

      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification',
        icon: '/icon.png',
        image: '/image.jpg',
        badge: '/badge.png',
        tag: 'test-tag',
        data: { customData: 'value' },
        actions: [{ action: 'view', title: 'View' }],
        requireInteraction: true,
        silent: false,
      }

      await service.send(subscription, payload)

      expect(buildPushPayload).toHaveBeenCalledWith(
        {
          data: {
            title: 'Test Notification',
            body: 'This is a test notification',
            icon: '/icon.png',
            image: '/image.jpg',
            badge: '/badge.png',
            tag: 'test-tag',
            data: { customData: 'value' },
            actions: [{ action: 'view', title: 'View' }],
            requireInteraction: true,
            silent: false,
          },
        },
        expect.objectContaining({
          endpoint: subscription.endpoint,
          expirationTime: null,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        }),
        expect.objectContaining({
          subject: 'mailto:test@example.com',
          publicKey:
            'BLk5DRYrDTproCdr3CVKQlinA66-Ab6DaLRyhvn_OMIYV5r2iazgiX4BQKgcmiMi_MSR2DJ2Xe60zz9gKj_oo4U',
          privateKey: 'AjV0e5aJ8v9U04x90r_VYF1CcC9FjQUrQ58WARPHO44',
        })
      )
    })
  })
})
