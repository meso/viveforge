import type { D1Database } from '@cloudflare/workers-types'
import { getCurrentDateTimeISO } from './datetime-utils'
import {
  createPushService,
  type NotificationPayload,
  type PushService,
  type PushSubscription,
} from './push-service'
import { generateId } from './utils'

export interface NotificationRule {
  id: string
  name: string
  description?: string
  triggerType: 'db_change' | 'api'
  tableName?: string
  eventType?: 'insert' | 'update' | 'delete'
  conditions?: Record<string, unknown>
  recipientType: 'specific_user' | 'column_reference' | 'all_users'
  recipientValue?: string
  titleTemplate: string
  bodyTemplate: string
  iconUrl?: string
  imageUrl?: string
  clickAction?: string
  platformConfig?: Record<string, unknown>
  priority: 'high' | 'normal' | 'low'
  ttl: number
  enabled: boolean
}

export class NotificationManager {
  private db: D1Database
  private pushService: PushService

  constructor(
    db: D1Database,
    vapidConfig: { publicKey: string; privateKey: string; subject: string }
  ) {
    this.db = db
    this.pushService = createPushService('webpush', {
      vapidPublicKey: vapidConfig.publicKey,
      vapidPrivateKey: vapidConfig.privateKey,
      vapidSubject: vapidConfig.subject,
    })
  }

  // Subscribe a device for push notifications
  async subscribe(
    userId: string,
    subscription: {
      endpoint?: string
      keys?: {
        p256dh?: string
        auth?: string
      }
      fcmToken?: string
    },
    deviceInfo?: Record<string, unknown>
  ): Promise<string> {
    const id = generateId()
    const provider = subscription.endpoint ? 'webpush' : 'fcm'

    await this.db
      .prepare(`
      INSERT INTO push_subscriptions (
        id, user_id, provider, endpoint, p256dh, auth, fcm_token, 
        device_info, platform, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(user_id, endpoint) DO UPDATE SET
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        device_info = excluded.device_info,
        updated_at = ?,
        active = 1
    `)
      .bind(
        id,
        userId,
        provider,
        subscription.endpoint || null,
        subscription.keys?.p256dh || null,
        subscription.keys?.auth || null,
        subscription.fcmToken || null,
        JSON.stringify(deviceInfo || {}),
        this.detectPlatform(deviceInfo),
        getCurrentDateTimeISO()
      )
      .run()

    return id
  }

  // Unsubscribe a device
  async unsubscribe(userId: string, endpoint?: string, fcmToken?: string): Promise<void> {
    if (endpoint) {
      await this.db
        .prepare(
          'UPDATE push_subscriptions SET active = 0, updated_at = ? WHERE user_id = ? AND endpoint = ?'
        )
        .bind(getCurrentDateTimeISO(), userId, endpoint)
        .run()
    } else if (fcmToken) {
      await this.db
        .prepare(
          'UPDATE push_subscriptions SET active = 0, updated_at = ? WHERE user_id = ? AND fcm_token = ?'
        )
        .bind(getCurrentDateTimeISO(), userId, fcmToken)
        .run()
    }
  }

  // Get user's active subscriptions
  async getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    const result = await this.db
      .prepare(`
      SELECT * FROM push_subscriptions 
      WHERE user_id = ? AND active = 1
    `)
      .bind(userId)
      .all()

    if (result.results.length > 0) {
    }

    return result.results.map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      provider: row.provider as 'webpush' | 'fcm',
      endpoint: row.endpoint as string | undefined,
      p256dh: row.p256dh as string | undefined,
      auth: row.auth as string | undefined,
      fcmToken: row.fcm_token as string | undefined,
      deviceInfo: row.device_info ? JSON.parse(row.device_info as string) : undefined,
      platform: row.platform as 'web' | 'ios' | 'android' | 'desktop' | undefined,
    }))
  }

  // Create or update a notification rule
  async createRule(rule: Omit<NotificationRule, 'id'>): Promise<string> {
    const id = generateId()

    await this.db
      .prepare(`
      INSERT INTO notification_rules (
        id, name, description, trigger_type, table_name, event_type, conditions,
        recipient_type, recipient_value, title_template, body_template, icon_url,
        image_url, click_action, platform_config, priority, ttl, enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        id,
        rule.name,
        rule.description || null,
        rule.triggerType,
        rule.tableName || null,
        rule.eventType || null,
        rule.conditions ? JSON.stringify(rule.conditions) : null,
        rule.recipientType,
        rule.recipientValue || null,
        rule.titleTemplate,
        rule.bodyTemplate,
        rule.iconUrl || null,
        rule.imageUrl || null,
        rule.clickAction || null,
        rule.platformConfig ? JSON.stringify(rule.platformConfig) : null,
        rule.priority,
        rule.ttl,
        rule.enabled ? 1 : 0
      )
      .run()

    return id
  }

  // Get rules for a specific trigger
  async getRulesForTrigger(tableName: string, eventType: string): Promise<NotificationRule[]> {
    const result = await this.db
      .prepare(`
      SELECT * FROM notification_rules 
      WHERE trigger_type = 'db_change' 
      AND table_name = ? 
      AND event_type = ? 
      AND enabled = 1
    `)
      .bind(tableName, eventType)
      .all()

    return result.results.map((row) => this.rowToRule(row))
  }

  // Process a database change event
  async processDbChange(
    tableName: string,
    eventType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const rules = await this.getRulesForTrigger(tableName, eventType)

    for (const rule of rules) {
      if (this.evaluateConditions(rule.conditions, data)) {
        await this.executeRule(rule, data)
      }
    }
  }

  // Send notification via API trigger
  async sendNotification(
    userIds: string[],
    payload: NotificationPayload,
    ruleId?: string
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0
    let failed = 0

    for (const userId of userIds) {
      const subscriptions = await this.getUserSubscriptions(userId)

      for (const subscription of subscriptions) {
        try {
          const result = await this.pushService.send(subscription, payload)

          // Log the notification
          await this.logNotification({
            ruleId,
            userId,
            provider: subscription.provider,
            title: payload.title,
            body: payload.body,
            status: result.success ? 'sent' : 'failed',
            error: result.error,
          })

          if (result.success) {
            sent++
          } else {
            failed++
            // Handle invalid subscriptions
            if (result.statusCode === 410) {
              await this.unsubscribe(userId, subscription.endpoint, subscription.fcmToken)
            }
          }
        } catch (error) {
          failed++
          await this.logNotification({
            ruleId,
            userId,
            provider: subscription.provider,
            title: payload.title,
            body: payload.body,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }

    return { sent, failed }
  }

  // Template processing
  private processTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key]?.toString() || match
    })
  }

  // Execute a notification rule
  private async executeRule(rule: NotificationRule, data: Record<string, unknown>): Promise<void> {
    // Determine recipients
    const userIds = await this.getRecipients(rule, data)

    // Process templates
    const payload: NotificationPayload = {
      title: this.processTemplate(rule.titleTemplate, data),
      body: this.processTemplate(rule.bodyTemplate, data),
      icon: rule.iconUrl,
      image: rule.imageUrl,
      data: {
        ruleId: rule.id,
        clickAction: rule.clickAction,
        ...data,
      },
    }

    // Apply platform-specific config
    if (rule.platformConfig) {
      Object.assign(payload, rule.platformConfig)
    }

    // Send notifications
    await this.sendNotification(userIds, payload, rule.id)
  }

  // Get recipients based on rule configuration
  private async getRecipients(
    rule: NotificationRule,
    data: Record<string, unknown>
  ): Promise<string[]> {
    switch (rule.recipientType) {
      case 'specific_user':
        return rule.recipientValue ? [rule.recipientValue] : []

      case 'column_reference':
        if (rule.recipientValue && data[rule.recipientValue]) {
          return [data[rule.recipientValue] as string]
        }
        return []

      case 'all_users': {
        const result = await this.db
          .prepare('SELECT DISTINCT user_id FROM push_subscriptions WHERE active = 1')
          .all()
        return result.results.map((row) => row.user_id as string)
      }

      default:
        return []
    }
  }

  // Evaluate rule conditions
  private evaluateConditions(
    conditions: Record<string, unknown> | undefined,
    data: Record<string, unknown>
  ): boolean {
    if (!conditions) return true

    // Simple condition evaluation
    // TODO: Implement more complex condition logic
    for (const [key, value] of Object.entries(conditions)) {
      if (data[key] !== value) {
        return false
      }
    }

    return true
  }

  // Log notification
  private async logNotification(log: {
    ruleId?: string
    templateId?: string
    userId: string
    provider: string
    title: string
    body: string
    status: 'sent' | 'failed' | 'pending'
    error?: string
  }): Promise<void> {
    if (log.status === 'sent') {
      // Use ISO8601 format for sent notifications
      await this.db
        .prepare(`
        INSERT INTO notification_logs (
          id, rule_id, template_id, user_id, provider, title, body, status, error_message, sent_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(
          crypto.randomUUID(),
          log.ruleId || null,
          log.templateId || null,
          log.userId,
          log.provider,
          log.title,
          log.body,
          log.status,
          log.error || null,
          getCurrentDateTimeISO(),
          getCurrentDateTimeISO()
        )
        .run()
    } else {
      // For failed/pending notifications, sent_at remains NULL
      await this.db
        .prepare(`
        INSERT INTO notification_logs (
          id, rule_id, template_id, user_id, provider, title, body, status, error_message, sent_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
      `)
        .bind(
          crypto.randomUUID(),
          log.ruleId || null,
          log.templateId || null,
          log.userId,
          log.provider,
          log.title,
          log.body,
          log.status,
          log.error || null,
          getCurrentDateTimeISO()
        )
        .run()
    }
  }

  // Detect platform from device info
  private detectPlatform(deviceInfo?: Record<string, unknown>): string {
    if (!deviceInfo) return 'web'

    const userAgent = (deviceInfo.userAgent as string)?.toLowerCase() || ''

    if (userAgent.includes('android')) return 'android'
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios'
    if (userAgent.includes('electron')) return 'desktop'

    return 'web'
  }

  // Convert database row to NotificationRule
  private rowToRule(row: Record<string, unknown>): NotificationRule {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      triggerType: row.trigger_type as 'db_change' | 'api',
      tableName: row.table_name as string | undefined,
      eventType: row.event_type as 'insert' | 'update' | 'delete' | undefined,
      conditions: row.conditions ? JSON.parse(row.conditions as string) : undefined,
      recipientType: row.recipient_type as 'specific_user' | 'column_reference' | 'all_users',
      recipientValue: row.recipient_value as string | undefined,
      titleTemplate: row.title_template as string,
      bodyTemplate: row.body_template as string,
      iconUrl: row.icon_url as string | undefined,
      imageUrl: row.image_url as string | undefined,
      clickAction: row.click_action as string | undefined,
      platformConfig: row.platform_config ? JSON.parse(row.platform_config as string) : undefined,
      priority: row.priority as 'high' | 'normal' | 'low',
      ttl: row.ttl as number,
      enabled: row.enabled === 1,
    }
  }
}
