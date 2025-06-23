import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WebPushService } from '../../lib/push-service'

// Mock fetch globally
global.fetch = vi.fn()

// Mock crypto.subtle
const mockCrypto = {
  subtle: {
    importKey: vi.fn(),
    sign: vi.fn(),
  },
}
Object.defineProperty(global, 'crypto', { value: mockCrypto })

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
      // Mock successful fetch response
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
      })

      // Mock crypto operations
      mockCrypto.subtle.importKey.mockResolvedValue({})
      mockCrypto.subtle.sign.mockResolvedValue(new ArrayBuffer(64))

      // Mock the private JWT generation method
      vi.spyOn(service as any, 'generateVAPIDJWT').mockResolvedValue('mock-jwt-token')

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
      expect(global.fetch).toHaveBeenCalledWith(
        subscription.endpoint,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
          }),
        })
      )
    })

    it('should handle send failure', async () => {
      // Mock failed fetch response
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers(),
      })

      // Mock crypto operations
      mockCrypto.subtle.importKey.mockResolvedValue({})
      mockCrypto.subtle.sign.mockResolvedValue(new ArrayBuffer(64))

      // Mock the private JWT generation method
      vi.spyOn(service as any, 'generateVAPIDJWT').mockResolvedValue('mock-jwt-token')

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

    it('should handle crypto errors', async () => {
      // Mock crypto error
      mockCrypto.subtle.importKey.mockRejectedValue(new Error('Invalid key format'))

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
      expect(result.error).toContain('VAPID JWT generation failed')
    })
  })

  describe('sendBatch', () => {
    it('should send notifications to multiple subscriptions', async () => {
      // Mock successful responses
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
      })

      // Mock crypto operations
      mockCrypto.subtle.importKey.mockResolvedValue({})
      mockCrypto.subtle.sign.mockResolvedValue(new ArrayBuffer(64))

      // Mock the private JWT generation method
      vi.spyOn(service as any, 'generateVAPIDJWT').mockResolvedValue('mock-jwt-token')

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

  describe('Key conversion utilities', () => {
    it('should handle invalid private key length', () => {
      expect(() => {
        ;(service as any).convertPrivateKeyToJWK('invalid-short-key')
      }).toThrow('Invalid character')
    })

    it('should handle invalid public key format', () => {
      // Test the method that actually validates the public key
      const invalidService = new WebPushService(
        'invalid-key',
        'AjV0e5aJ8v9U04x90r_VYF1CcC9FjQUrQ58WARPHO44',
        'mailto:test@example.com'
      )

      expect(() => {
        ;(invalidService as any).convertPrivateKeyToJWK(
          'AjV0e5aJ8v9U04x90r_VYF1CcC9FjQUrQ58WARPHO44'
        )
      }).toThrow()
    })
  })
})
