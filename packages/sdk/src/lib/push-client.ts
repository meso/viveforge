/**
 * Push Notifications Client
 */
import type { ApiResponse } from '../types'
import type { HttpClient } from './http-client'

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export interface DeviceInfo {
  userAgent: string
  platform: string
  vendor?: string
  language?: string
}

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  data?: Record<string, unknown>
  tag?: string
  requireInteraction?: boolean
  silent?: boolean
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

export interface PushRule {
  id: string
  name: string
  triggerType: 'manual' | 'db_change' | 'scheduled'
  tableName?: string
  eventType?: 'insert' | 'update' | 'delete'
  recipientType: 'all_users' | 'specific_users' | 'user_roles'
  recipients?: string[]
  titleTemplate: string
  bodyTemplate: string
  iconUrl?: string
  clickAction?: string
  isEnabled: boolean
  created_at: string
  updated_at: string
}

export interface PushSubscriptionData {
  id: string
  user_id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
  device_info: DeviceInfo
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NotificationLog {
  id: string
  title: string
  body: string
  recipient_count: number
  success_count: number
  failure_count: number
  rule_id?: string
  created_at: string
}

export class PushClient {
  constructor(private http: HttpClient) {}

  /**
   * Get VAPID public key for push subscription
   */
  async getVapidPublicKey(): Promise<ApiResponse<{ publicKey: string }>> {
    const response = await this.http.get<{ publicKey: string }>('/api/push/vapid-public-key')
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(
    subscription: PushSubscription,
    deviceInfo: DeviceInfo
  ): Promise<ApiResponse<PushSubscriptionData>> {
    const response = await this.http.post<PushSubscriptionData>('/api/push/subscribe', {
      subscription,
      deviceInfo,
    })
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(endpoint: string): Promise<ApiResponse<void>> {
    const response = await this.http.post<void>('/api/push/unsubscribe', { endpoint })
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }

  /**
   * Send manual push notification
   */
  async send(
    notification: NotificationPayload,
    options: {
      userIds?: string[]
      allUsers?: boolean
      roles?: string[]
    }
  ): Promise<ApiResponse<{ result: { sent: number; failed: number } }>> {
    // Convert client options to server format
    const serverPayload = {
      ...notification,
      userIds: options.userIds,
      recipientType: options.allUsers
        ? ('all_users' as const)
        : options.userIds
          ? ('specific_users' as const)
          : undefined,
    }

    const response = await this.http.post<{ result: { sent: number; failed: number } }>(
      '/api/push/send',
      serverPayload
    )
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }

  /**
   * Create notification rule
   */
  async createRule(
    rule: Omit<PushRule, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ApiResponse<PushRule>> {
    const response = await this.http.post<PushRule>('/api/push/rules', rule)
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }

  /**
   * List notification rules
   */
  async listRules(): Promise<ApiResponse<PushRule[]>> {
    const response = await this.http.get<PushRule[]>('/api/push/rules')
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }

  /**
   * Get notification rule by ID
   */
  async getRule(ruleId: string): Promise<ApiResponse<PushRule>> {
    const response = await this.http.get<PushRule>(`/api/push/rules/${ruleId}`)
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }

  /**
   * Update notification rule
   */
  async updateRule(
    ruleId: string,
    updates: Partial<Omit<PushRule, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<ApiResponse<PushRule>> {
    const response = await this.http.patch<PushRule>(`/api/push/rules/${ruleId}`, updates)
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }

  /**
   * Delete notification rule
   */
  async deleteRule(ruleId: string): Promise<ApiResponse<void>> {
    const response = await this.http.delete<void>(`/api/push/rules/${ruleId}`)
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }

  /**
   * Toggle notification rule status
   */
  async toggleRule(ruleId: string, enabled: boolean): Promise<ApiResponse<PushRule>> {
    const response = await this.http.patch<PushRule>(`/api/push/rules/${ruleId}`, {
      isEnabled: enabled,
    })
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }

  /**
   * List user's push subscriptions
   */
  async listSubscriptions(userId?: string): Promise<ApiResponse<PushSubscriptionData[]>> {
    const params: Record<string, string> = {}
    if (userId) params.user_id = userId
    const response = await this.http.get<PushSubscriptionData[]>('/api/push/subscriptions', params)
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }

  /**
   * Get notification logs
   */
  async getLogs(options?: {
    limit?: number
    offset?: number
    ruleId?: string
    startDate?: string
    endDate?: string
  }): Promise<ApiResponse<{ logs: NotificationLog[]; total: number }>> {
    const params: Record<string, string> = {}
    if (options?.limit !== undefined) params.limit = String(options.limit)
    if (options?.offset !== undefined) params.offset = String(options.offset)
    if (options?.ruleId) params.ruleId = options.ruleId
    if (options?.startDate) params.startDate = options.startDate
    if (options?.endDate) params.endDate = options.endDate

    const response = await this.http.get<{ logs: NotificationLog[]; total: number }>(
      '/api/push/logs',
      params
    )
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }

  /**
   * Test notification delivery
   */
  async testNotification(
    notification: NotificationPayload,
    endpoint: string
  ): Promise<ApiResponse<{ success: boolean; error?: string }>> {
    const response = await this.http.post<{ success: boolean; error?: string }>('/api/push/test', {
      notification,
      endpoint,
    })
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }

  /**
   * Get push notification statistics
   */
  async getStats(options?: { startDate?: string; endDate?: string }): Promise<
    ApiResponse<{
      total_notifications: number
      success_rate: number
      active_subscriptions: number
      rules_count: number
    }>
  > {
    const response = await this.http.get<{
      total_notifications: number
      success_rate: number
      active_subscriptions: number
      rules_count: number
    }>('/api/push/stats', options || {})
    if (!response.success && response.error) {
      throw new Error(response.error)
    }
    return response
  }
}
