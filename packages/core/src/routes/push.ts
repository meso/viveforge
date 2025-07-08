import type { D1Database } from '@cloudflare/workers-types'
import { Hono } from 'hono'
import { z } from 'zod'
import { NotificationManager } from '../lib/notification-manager'
import { VapidStorage } from '../lib/vapid-storage'
import type { Env } from '../types'

// Schemas
const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().optional(),
    keys: z
      .object({
        p256dh: z.string(),
        auth: z.string(),
      })
      .optional(),
    fcmToken: z.string().optional(),
  }),
  deviceInfo: z
    .object({
      userAgent: z.string().optional(),
      platform: z.string().optional(),
      browser: z.string().optional(),
      version: z.string().optional(),
    })
    .optional(),
})

const unsubscribeSchema = z.object({
  endpoint: z.string().url().optional(),
  fcmToken: z.string().optional(),
})

const notificationRuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  triggerType: z.enum(['db_change', 'api']),
  tableName: z.string().optional(),
  eventType: z.enum(['insert', 'update', 'delete']).optional(),
  conditions: z.record(z.any()).optional(),
  recipientType: z.enum(['specific_user', 'column_reference', 'all_users']),
  recipientValue: z.string().optional(),
  titleTemplate: z.string().min(1, 'Title template is required'),
  bodyTemplate: z.string().min(1, 'Body template is required'),
  iconUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  imageUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  clickAction: z.string().optional(),
  platformConfig: z.record(z.any()).optional(),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  ttl: z.number().default(86400),
  enabled: z.boolean().default(true),
})

const sendNotificationSchema = z.object({
  userIds: z.array(z.string()).optional(),
  recipientType: z.enum(['specific_users', 'all_users']).optional(),
  title: z.string(),
  body: z.string(),
  icon: z.string().url().optional(),
  image: z.string().url().optional(),
  badge: z.string().optional(),
  tag: z.string().optional(),
  data: z.record(z.any()).optional(),
  clickAction: z.string().optional(),
  requireInteraction: z.boolean().optional(),
  silent: z.boolean().optional(),
})

export const push = new Hono<{ Bindings: Env }>()

// Helper function to get VAPID configuration from database
async function getVapidConfig(env: Env): Promise<{
  valid: boolean
  error?: string
  config?: {
    db: D1Database
    vapidConfig: {
      publicKey: string
      privateKey: string
      subject: string
    }
  }
}> {
  if (!env.DB) {
    return { valid: false, error: 'Database not configured' }
  }

  const vapidStorage = new VapidStorage(env.DB, env.DEPLOYMENT_DOMAIN)

  // Get VAPID keys from database
  const storedKeys = await vapidStorage.retrieve()
  if (storedKeys) {
    return {
      valid: true,
      config: {
        db: env.DB,
        vapidConfig: storedKeys,
      },
    }
  }

  return { valid: false, error: 'VAPID keys not configured' }
}

// Check VAPID configuration status
push.get('/status', async (c) => {
  const authContext = c.get('authContext')

  if (!authContext || authContext.type !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  if (!c.env.DB) {
    return c.json({ error: 'Database not configured' }, 500)
  }

  const vapidStorage = new VapidStorage(c.env.DB, c.env.DEPLOYMENT_DOMAIN)
  const configured = await vapidStorage.isConfigured()

  return c.json({
    configured,
    source: configured ? 'database' : 'none',
  })
})

// Initialize VAPID keys (admin only)
push.post('/initialize', async (c) => {
  const authContext = c.get('authContext')

  if (!authContext || authContext.type !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  if (!c.env.DB) {
    return c.json({ error: 'Database not configured' }, 500)
  }

  try {
    console.log('Starting VAPID initialization...')

    const vapidStorage = new VapidStorage(c.env.DB, c.env.DEPLOYMENT_DOMAIN)

    // Check if already configured
    console.log('Checking if VAPID is already configured...')
    if (await vapidStorage.isConfigured()) {
      console.log('VAPID already configured')
      return c.json({ error: 'VAPID keys are already configured' }, 400)
    }

    // Generate and store keys automatically
    console.log('Generating and storing VAPID keys...')
    const keys = await vapidStorage.initialize()
    console.log('VAPID keys generated successfully')

    return c.json({
      success: true,
      message: 'VAPID keys generated and stored successfully',
      keys: {
        publicKey: keys.publicKey,
        subject: keys.subject,
        // Don't return private key for security
      },
      note: 'Private key has been encrypted and stored securely in the database. Push notifications are now ready to use!',
    })
  } catch (error) {
    console.error('Failed to initialize VAPID keys:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('Error details:', errorMessage, errorStack)
    return c.json(
      {
        error: `Failed to generate VAPID keys: ${errorMessage}`,
        details: errorStack,
      },
      500
    )
  }
})

// Get VAPID public key
push.get('/vapid-public-key', async (c) => {
  const vapidConfig = await getVapidConfig(c.env)

  if (!vapidConfig.valid || !vapidConfig.config) {
    return c.json({ error: vapidConfig.error || 'VAPID keys not configured' }, 500)
  }

  return c.json({ publicKey: vapidConfig.config.vapidConfig.publicKey })
})

// Subscribe to push notifications
push.post('/subscribe', async (c) => {
  try {
    const body = await c.req.json()
    const validated = subscribeSchema.parse(body)
    const authContext = c.get('authContext')

    if (!authContext || authContext.type !== 'user') {
      return c.json({ error: 'User authentication required' }, 401)
    }

    const userId = authContext.user.id

    const vapidConfig = await getVapidConfig(c.env)
    if (!vapidConfig.valid || !vapidConfig.config) {
      return c.json({ error: vapidConfig.error }, 500)
    }

    const manager = new NotificationManager(vapidConfig.config.db, vapidConfig.config.vapidConfig)

    const subscriptionId = await manager.subscribe(
      userId,
      validated.subscription,
      validated.deviceInfo
    )

    return c.json({
      success: true,
      subscriptionId,
      message: 'Successfully subscribed to push notifications',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.errors }, 400)
    }
    return c.json({ error: 'Failed to subscribe' }, 500)
  }
})

// Unsubscribe from push notifications
push.post('/unsubscribe', async (c) => {
  try {
    const body = await c.req.json()
    const validated = unsubscribeSchema.parse(body)
    const authContext = c.get('authContext')

    if (!authContext || authContext.type !== 'user') {
      return c.json({ error: 'User authentication required' }, 401)
    }

    const userId = authContext.user.id

    const vapidConfig = await getVapidConfig(c.env)
    if (!vapidConfig.valid || !vapidConfig.config) {
      return c.json({ error: vapidConfig.error }, 500)
    }

    const manager = new NotificationManager(vapidConfig.config.db, vapidConfig.config.vapidConfig)

    await manager.unsubscribe(userId, validated.endpoint, validated.fcmToken)

    return c.json({
      success: true,
      message: 'Successfully unsubscribed from push notifications',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.errors }, 400)
    }
    return c.json({ error: 'Failed to unsubscribe' }, 500)
  }
})

// Get user's subscriptions (admin only)
push.get('/subscriptions/:userId', async (c) => {
  const authContext = c.get('authContext')

  if (!authContext || authContext.type !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const userId = c.req.param('userId')

  const vapidConfig = await getVapidConfig(c.env)
  if (!vapidConfig.valid || !vapidConfig.config) {
    return c.json({ error: vapidConfig.error }, 500)
  }

  const manager = new NotificationManager(vapidConfig.config.db, vapidConfig.config.vapidConfig)

  const subscriptions = await manager.getUserSubscriptions(userId)

  return c.json({ subscriptions })
})

// Notification rules management (admin only)
push.get('/rules', async (c) => {
  const authContext = c.get('authContext')

  if (!authContext || authContext.type !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  if (!c.env.DB) {
    return c.json({ error: 'Database not configured' }, 500)
  }

  const result = await c.env.DB.prepare(
    'SELECT * FROM notification_rules ORDER BY created_at DESC'
  ).all()

  const rules = result.results.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    triggerType: row.trigger_type,
    tableName: row.table_name,
    eventType: row.event_type,
    conditions: row.conditions ? JSON.parse(row.conditions as string) : null,
    recipientType: row.recipient_type,
    recipientValue: row.recipient_value,
    titleTemplate: row.title_template,
    bodyTemplate: row.body_template,
    iconUrl: row.icon_url,
    imageUrl: row.image_url,
    clickAction: row.click_action,
    platformConfig: row.platform_config ? JSON.parse(row.platform_config as string) : null,
    priority: row.priority,
    ttl: row.ttl,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return c.json({ rules })
})

push.post('/rules', async (c) => {
  try {
    const authContext = c.get('authContext')

    if (!authContext || authContext.type !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const body = await c.req.json()
    const validated = notificationRuleSchema.parse(body)

    const vapidConfig = await getVapidConfig(c.env)
    if (!vapidConfig.valid || !vapidConfig.config) {
      return c.json({ error: vapidConfig.error }, 500)
    }

    const manager = new NotificationManager(vapidConfig.config.db, vapidConfig.config.vapidConfig)

    const ruleId = await manager.createRule(validated)

    return c.json({
      success: true,
      ruleId,
      message: 'Notification rule created successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.errors }, 400)
    }
    return c.json({ error: 'Failed to create rule' }, 500)
  }
})

push.put('/rules/:id', async (c) => {
  try {
    const authContext = c.get('authContext')

    if (!authContext || authContext.type !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const ruleId = c.req.param('id')
    const body = await c.req.json()
    const validated = notificationRuleSchema.parse(body)

    if (!c.env.DB) {
      return c.json({ error: 'Database not configured' }, 500)
    }

    await c.env.DB.prepare(`
      UPDATE notification_rules SET
        name = ?, description = ?, trigger_type = ?, table_name = ?, event_type = ?,
        conditions = ?, recipient_type = ?, recipient_value = ?, title_template = ?,
        body_template = ?, icon_url = ?, image_url = ?, click_action = ?,
        platform_config = ?, priority = ?, ttl = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
      .bind(
        validated.name,
        validated.description || null,
        validated.triggerType,
        validated.tableName || null,
        validated.eventType || null,
        validated.conditions ? JSON.stringify(validated.conditions) : null,
        validated.recipientType,
        validated.recipientValue || null,
        validated.titleTemplate,
        validated.bodyTemplate,
        validated.iconUrl || null,
        validated.imageUrl || null,
        validated.clickAction || null,
        validated.platformConfig ? JSON.stringify(validated.platformConfig) : null,
        validated.priority,
        validated.ttl,
        validated.enabled ? 1 : 0,
        ruleId
      )
      .run()

    return c.json({
      success: true,
      message: 'Notification rule updated successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.errors }, 400)
    }
    return c.json({ error: 'Failed to update rule' }, 500)
  }
})

push.delete('/rules/:id', async (c) => {
  const authContext = c.get('authContext')

  if (!authContext || authContext.type !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const ruleId = c.req.param('id')

  if (!c.env.DB) {
    return c.json({ error: 'Database not configured' }, 500)
  }

  await c.env.DB.prepare('DELETE FROM notification_rules WHERE id = ?').bind(ruleId).run()

  return c.json({
    success: true,
    message: 'Notification rule deleted successfully',
  })
})

// Send notification via API trigger
push.post('/send', async (c) => {
  try {
    const body = await c.req.json()
    const validated = sendNotificationSchema.parse(body)
    const authContext = c.get('authContext')

    if (!authContext || (authContext.type !== 'admin' && authContext.type !== 'api_key')) {
      return c.json({ error: 'Admin or API key access required' }, 403)
    }

    const vapidConfig = await getVapidConfig(c.env)
    if (!vapidConfig.valid || !vapidConfig.config) {
      return c.json({ error: vapidConfig.error }, 500)
    }

    const manager = new NotificationManager(vapidConfig.config.db, vapidConfig.config.vapidConfig)

    // Determine recipients
    let userIds: string[] = []

    if (
      validated.recipientType === 'all_users' ||
      (!validated.userIds && !validated.recipientType)
    ) {
      // Get all users with active subscriptions
      if (!c.env.DB) {
        return c.json({ error: 'Database not configured' }, 500)
      }
      const result = await c.env.DB.prepare(
        'SELECT DISTINCT user_id FROM push_subscriptions WHERE active = 1'
      ).all()
      userIds =
        result.results.map((row) => (row as Record<string, unknown>).user_id as string) || []
    } else if (validated.userIds) {
      userIds = validated.userIds
    }

    const payload = {
      title: validated.title,
      body: validated.body,
      icon: validated.icon,
      image: validated.image,
      badge: validated.badge,
      tag: validated.tag,
      data: {
        ...validated.data,
        clickAction: validated.clickAction,
      },
      requireInteraction: validated.requireInteraction,
      silent: validated.silent,
    }

    const result = await manager.sendNotification(userIds, payload)

    return c.json({
      success: true,
      result,
      message: `Notifications sent: ${result.sent}, failed: ${result.failed}`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.errors }, 400)
    }
    return c.json({ error: 'Failed to send notification' }, 500)
  }
})

// Admin-specific endpoints for testing push notifications

// Admin subscribe (for testing purposes)
push.post('/admin/subscribe', async (c) => {
  try {
    const body = await c.req.json()
    const validated = subscribeSchema.parse(body)
    const authContext = c.get('authContext')

    if (!authContext || authContext.type !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    // Use admin user ID for subscription
    const adminUserId = `admin_${authContext.user.id}`

    const vapidConfig = await getVapidConfig(c.env)
    if (!vapidConfig.valid || !vapidConfig.config) {
      return c.json({ error: vapidConfig.error }, 500)
    }

    const manager = new NotificationManager(vapidConfig.config.db, vapidConfig.config.vapidConfig)

    const subscriptionId = await manager.subscribe(
      adminUserId,
      validated.subscription,
      validated.deviceInfo
    )

    return c.json({
      success: true,
      subscriptionId,
      message: 'Admin successfully subscribed to push notifications for testing',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.errors }, 400)
    }
    return c.json({ error: 'Failed to subscribe admin' }, 500)
  }
})

// Admin unsubscribe
push.post('/admin/unsubscribe', async (c) => {
  try {
    const body = await c.req.json()
    const validated = unsubscribeSchema.parse(body)
    const authContext = c.get('authContext')

    if (!authContext || authContext.type !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const adminUserId = `admin_${authContext.user.id}`

    const vapidConfig = await getVapidConfig(c.env)
    if (!vapidConfig.valid || !vapidConfig.config) {
      return c.json({ error: vapidConfig.error }, 500)
    }

    const manager = new NotificationManager(vapidConfig.config.db, vapidConfig.config.vapidConfig)

    await manager.unsubscribe(adminUserId, validated.endpoint, validated.fcmToken)

    return c.json({
      success: true,
      message: 'Admin successfully unsubscribed from push notifications',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.errors }, 400)
    }
    return c.json({ error: 'Failed to unsubscribe admin' }, 500)
  }
})

// Admin test notification
push.post('/admin/test', async (c) => {
  try {
    const authContext = c.get('authContext')

    if (!authContext || authContext.type !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const adminUserId = `admin_${authContext.user.id}`

    const vapidConfig = await getVapidConfig(c.env)
    if (!vapidConfig.valid || !vapidConfig.config) {
      return c.json({ error: vapidConfig.error }, 500)
    }

    const manager = new NotificationManager(vapidConfig.config.db, vapidConfig.config.vapidConfig)

    const payload = {
      title: 'Test Notification',
      body: 'This is a test notification from Vibebase admin dashboard',
      icon: '/favicon.svg',
      tag: 'admin-test-notification',
      data: {
        clickAction: '/',
        source: 'admin-test',
      },
    }

    const result = await manager.sendNotification([adminUserId], payload)

    return c.json({
      success: true,
      result,
      message: `Test notification sent. Sent: ${result.sent}, Failed: ${result.failed}`,
    })
  } catch (_error) {
    return c.json({ error: 'Failed to send test notification' }, 500)
  }
})

// Check admin subscription status
push.get('/admin/subscription', async (c) => {
  const authContext = c.get('authContext')

  if (!authContext || authContext.type !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const adminUserId = `admin_${authContext.user.id}`

  const vapidConfig = await getVapidConfig(c.env)
  if (!vapidConfig.valid || !vapidConfig.config) {
    return c.json({ error: vapidConfig.error }, 500)
  }

  const manager = new NotificationManager(vapidConfig.config.db, vapidConfig.config.vapidConfig)

  const subscriptions = await manager.getUserSubscriptions(adminUserId)

  return c.json({
    subscriptions,
    isSubscribed: subscriptions.length > 0,
  })
})

// Get notification logs (admin only)
push.get('/logs', async (c) => {
  const authContext = c.get('authContext')

  if (!authContext || authContext.type !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const limit = parseInt(c.req.query('limit') || '100')
  const offset = parseInt(c.req.query('offset') || '0')
  const userId = c.req.query('userId')
  const status = c.req.query('status')

  let query = 'SELECT * FROM notification_logs'
  const params: (string | number)[] = []
  const conditions: string[] = []

  if (userId) {
    conditions.push('user_id = ?')
    params.push(userId)
  }

  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  if (!c.env.DB) {
    return c.json({ error: 'Database not configured' }, 500)
  }

  const result = await c.env.DB.prepare(query)
    .bind(...params)
    .all()

  const logs =
    result.results.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: r.id,
        ruleId: r.rule_id,
        templateId: r.template_id,
        userId: r.user_id,
        provider: r.provider,
        title: r.title,
        body: r.body,
        status: r.status,
        errorMessage: r.error_message,
        sentAt: r.sent_at,
        createdAt: r.created_at,
      }
    }) || []

  return c.json({ logs })
})
