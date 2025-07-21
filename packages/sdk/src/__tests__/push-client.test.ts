import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HttpClient } from '../lib/http-client'
import { PushClient } from '../lib/push-client'

describe('PushClient', () => {
  let pushClient: PushClient
  let mockHttpClient: jest.Mocked<HttpClient>

  beforeEach(() => {
    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
    } as jest.Mocked<HttpClient>

    pushClient = new PushClient(mockHttpClient)
  })

  describe('getVapidPublicKey', () => {
    it('should get VAPID public key', async () => {
      const mockResponse = {
        success: true,
        data: { publicKey: 'test-vapid-public-key' },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await pushClient.getVapidPublicKey()

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/push/vapid-public-key')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('subscribe', () => {
    it('should subscribe to push notifications', async () => {
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: {
          p256dh: 'test-p256dh',
          auth: 'test-auth',
        },
      }
      const deviceInfo = {
        userAgent: 'Test Browser',
        platform: 'Test Platform',
      }
      const mockResponse = {
        success: true,
        data: {
          id: 'sub-123',
          user_id: 'user-123',
          endpoint: subscription.endpoint,
          p256dh_key: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
          device_info: deviceInfo,
          is_active: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        status: 201,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await pushClient.subscribe(subscription, deviceInfo)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/push/subscribe', {
        subscription,
        deviceInfo,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('unsubscribe', () => {
    it('should unsubscribe from push notifications', async () => {
      const endpoint = 'https://fcm.googleapis.com/fcm/send/test'
      const mockResponse = {
        success: true,
        status: 200,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await pushClient.unsubscribe(endpoint)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/push/unsubscribe', { endpoint })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('send', () => {
    it('should send notification to all users', async () => {
      const notification = {
        title: 'Test Notification',
        body: 'Test body',
        icon: '/icon.svg',
      }
      const options = { allUsers: true }
      const mockResponse = {
        success: true,
        data: {
          messageId: 'msg-123',
          sentCount: 5,
        },
        status: 200,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await pushClient.send(notification, options)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/push/send', {
        ...notification,
        ...options,
      })
      expect(result).toEqual(mockResponse)
    })

    it('should send notification to specific users', async () => {
      const notification = {
        title: 'Test Notification',
        body: 'Test body',
      }
      const options = { userIds: ['user1', 'user2'] }
      const mockResponse = {
        success: true,
        data: {
          messageId: 'msg-456',
          sentCount: 2,
        },
        status: 200,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await pushClient.send(notification, options)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/push/send', {
        ...notification,
        ...options,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('createRule', () => {
    it('should create a notification rule', async () => {
      const rule = {
        name: 'Test Rule',
        triggerType: 'db_change' as const,
        tableName: 'tasks',
        eventType: 'insert' as const,
        recipientType: 'all_users' as const,
        titleTemplate: 'New Task',
        bodyTemplate: 'Task {{title}} created',
        isEnabled: true,
      }
      const mockResponse = {
        success: true,
        data: {
          id: 'rule-123',
          ...rule,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        status: 201,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await pushClient.createRule(rule)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/push/rules', rule)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('listRules', () => {
    it('should list notification rules', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 'rule-123',
            name: 'Test Rule',
            triggerType: 'db_change',
            tableName: 'tasks',
            eventType: 'insert',
            recipientType: 'all_users',
            titleTemplate: 'New Task',
            bodyTemplate: 'Task created',
            isEnabled: true,
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ],
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await pushClient.listRules()

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/push/rules')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getRule', () => {
    it('should get a specific notification rule', async () => {
      const ruleId = 'rule-123'
      const mockResponse = {
        success: true,
        data: {
          id: ruleId,
          name: 'Test Rule',
          triggerType: 'db_change',
          tableName: 'tasks',
          eventType: 'insert',
          recipientType: 'all_users',
          titleTemplate: 'New Task',
          bodyTemplate: 'Task created',
          isEnabled: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await pushClient.getRule(ruleId)

      expect(mockHttpClient.get).toHaveBeenCalledWith(`/api/push/rules/${ruleId}`)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('updateRule', () => {
    it('should update a notification rule', async () => {
      const ruleId = 'rule-123'
      const updates = {
        name: 'Updated Rule',
        isEnabled: false,
      }
      const mockResponse = {
        success: true,
        data: {
          id: ruleId,
          name: 'Updated Rule',
          triggerType: 'db_change',
          tableName: 'tasks',
          eventType: 'insert',
          recipientType: 'all_users',
          titleTemplate: 'New Task',
          bodyTemplate: 'Task created',
          isEnabled: false,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        status: 200,
      }
      mockHttpClient.patch.mockResolvedValue(mockResponse)

      const result = await pushClient.updateRule(ruleId, updates)

      expect(mockHttpClient.patch).toHaveBeenCalledWith(`/api/push/rules/${ruleId}`, updates)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('deleteRule', () => {
    it('should delete a notification rule', async () => {
      const ruleId = 'rule-123'
      const mockResponse = {
        success: true,
        status: 200,
      }
      mockHttpClient.delete.mockResolvedValue(mockResponse)

      const result = await pushClient.deleteRule(ruleId)

      expect(mockHttpClient.delete).toHaveBeenCalledWith(`/api/push/rules/${ruleId}`)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('toggleRule', () => {
    it('should toggle rule status', async () => {
      const ruleId = 'rule-123'
      const enabled = false
      const mockResponse = {
        success: true,
        data: {
          id: ruleId,
          name: 'Test Rule',
          triggerType: 'db_change',
          tableName: 'tasks',
          eventType: 'insert',
          recipientType: 'all_users',
          titleTemplate: 'New Task',
          bodyTemplate: 'Task created',
          isEnabled: false,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        status: 200,
      }
      mockHttpClient.patch.mockResolvedValue(mockResponse)

      const result = await pushClient.toggleRule(ruleId, enabled)

      expect(mockHttpClient.patch).toHaveBeenCalledWith(`/api/push/rules/${ruleId}`, {
        isEnabled: enabled,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('listSubscriptions', () => {
    it('should list all subscriptions', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 'sub-123',
            user_id: 'user-123',
            endpoint: 'https://fcm.googleapis.com/fcm/send/test',
            p256dh_key: 'test-p256dh',
            auth_key: 'test-auth',
            device_info: { userAgent: 'Test Browser', platform: 'Test Platform' },
            is_active: true,
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ],
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await pushClient.listSubscriptions()

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/push/subscriptions', {})
      expect(result).toEqual(mockResponse)
    })

    it('should list subscriptions for specific user', async () => {
      const userId = 'user-123'
      const mockResponse = {
        success: true,
        data: [],
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await pushClient.listSubscriptions(userId)

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/push/subscriptions', {
        user_id: userId,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getLogs', () => {
    it('should get notification logs with default options', async () => {
      const mockResponse = {
        success: true,
        data: {
          logs: [
            {
              id: 'log-123',
              title: 'Test Notification',
              body: 'Test body',
              recipient_count: 5,
              success_count: 4,
              failure_count: 1,
              rule_id: 'rule-123',
              created_at: '2023-01-01T00:00:00Z',
            },
          ],
          total: 1,
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await pushClient.getLogs()

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/push/logs', {})
      expect(result).toEqual(mockResponse)
    })

    it('should get notification logs with options', async () => {
      const options = {
        limit: 10,
        offset: 0,
        ruleId: 'rule-123',
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2023-01-02T00:00:00Z',
      }
      const mockResponse = {
        success: true,
        data: { logs: [], total: 0 },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await pushClient.getLogs(options)

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/push/logs', {
        limit: '10',
        offset: '0',
        endDate: '2023-01-02T00:00:00Z',
        ruleId: 'rule-123',
        startDate: '2023-01-01T00:00:00Z',
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('testNotification', () => {
    it('should test notification delivery', async () => {
      const notification = {
        title: 'Test Notification',
        body: 'Test body',
      }
      const endpoint = 'https://fcm.googleapis.com/fcm/send/test'
      const mockResponse = {
        success: true,
        data: { success: true },
        status: 200,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await pushClient.testNotification(notification, endpoint)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/push/test', {
        notification,
        endpoint,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getStats', () => {
    it('should get push notification statistics', async () => {
      const mockResponse = {
        success: true,
        data: {
          total_notifications: 100,
          success_rate: 0.95,
          active_subscriptions: 50,
          rules_count: 10,
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await pushClient.getStats()

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/push/stats', {})
      expect(result).toEqual(mockResponse)
    })

    it('should get statistics with date range', async () => {
      const options = {
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2023-01-02T00:00:00Z',
      }
      const mockResponse = {
        success: true,
        data: {
          total_notifications: 10,
          success_rate: 1.0,
          active_subscriptions: 5,
          rules_count: 2,
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await pushClient.getStats(options)

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/push/stats', options)
      expect(result).toEqual(mockResponse)
    })
  })
})
