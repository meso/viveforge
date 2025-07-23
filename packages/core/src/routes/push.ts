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
  icon: z.string().optional(),
  image: z.string().optional(),
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

  console.log('VAPID Debug - WORKER_DOMAIN:', env.WORKER_DOMAIN)
  const workerDomain = env.WORKER_DOMAIN || 'localhost:8787'
  console.log('VAPID Debug - Using domain:', workerDomain)
  const vapidStorage = new VapidStorage(env.DB, workerDomain)

  // Get VAPID keys from database
  const storedKeys = await vapidStorage.retrieve()
  console.log('VAPID Debug - storedKeys:', storedKeys ? 'Found' : 'Not found')
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

  if (!authContext || (authContext.type !== 'admin' && authContext.type !== 'api_key')) {
    return c.json({ error: 'Admin access required' }, 403)
  }

  if (!c.env.DB) {
    return c.json({ error: 'Database not configured' }, 500)
  }

  const vapidStorage = new VapidStorage(c.env.DB, c.env.WORKER_DOMAIN)
  const configured = await vapidStorage.isConfigured()

  return c.json({
    configured,
    source: configured ? 'database' : 'none',
  })
})

// Initialize VAPID keys (admin only)
push.post('/initialize', async (c) => {
  const authContext = c.get('authContext')

  if (!authContext || (authContext.type !== 'admin' && authContext.type !== 'api_key')) {
    return c.json({ error: 'Admin access required' }, 403)
  }

  if (!c.env.DB) {
    return c.json({ error: 'Database not configured' }, 500)
  }

  try {
    console.log('Starting VAPID initialization...')

    const vapidStorage = new VapidStorage(c.env.DB, c.env.WORKER_DOMAIN)

    // Check if already configured
    console.log('Checking if VAPID is already configured...')
    if (await vapidStorage.isConfigured()) {
      console.log('VAPID already configured, deleting existing keys...')
      await vapidStorage.delete()
      console.log('Existing VAPID keys deleted')
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

    if (!authContext || (authContext.type !== 'user' && authContext.type !== 'api_key')) {
      return c.json({ error: 'User authentication required' }, 401)
    }

    // For API key auth, use test user ID, for user auth use actual user ID
    const userId =
      authContext.type === 'api_key'
        ? 'V1StGXR8_Z5jdHi6B-myT'
        : 'user' in authContext
          ? authContext.user.id
          : 'unknown'

    const vapidConfig = await getVapidConfig(c.env)
    if (!vapidConfig.valid || !vapidConfig.config) {
      return c.json({ error: vapidConfig.error }, 500)
    }

    const manager = new NotificationManager(vapidConfig.config.db, vapidConfig.config.vapidConfig)

    const subscriptionData = await manager.subscribe(
      userId,
      validated.subscription,
      validated.deviceInfo
    )

    // Return subscription data in the format expected by SDK
    return c.json({
      success: true,
      data: {
        id:
          typeof subscriptionData === 'string'
            ? subscriptionData
            : subscriptionData && typeof subscriptionData === 'object' && 'id' in subscriptionData
              ? ((subscriptionData as { id: string }).id)
              : 'unknown',
        user_id: userId,
        endpoint: validated.subscription.endpoint || '',
        p256dh_key: validated.subscription.keys?.p256dh || '',
        auth_key: validated.subscription.keys?.auth || '',
        device_info: validated.deviceInfo || {},
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
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

    if (!authContext || (authContext.type !== 'user' && authContext.type !== 'api_key')) {
      return c.json({ error: 'User authentication required' }, 401)
    }

    // For API key auth, use test user ID, for user auth use actual user ID
    const userId =
      authContext.type === 'api_key'
        ? 'V1StGXR8_Z5jdHi6B-myT'
        : 'user' in authContext
          ? authContext.user.id
          : 'unknown'

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

// Get subscriptions (user gets own, admin can specify userId)
push.get('/subscriptions', async (c) => {
  const authContext = c.get('authContext')
  const requestedUserId = c.req.query('user_id')

  if (!authContext) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  let targetUserId: string

  if (authContext.type === 'admin') {
    // Admin can access any user's subscriptions or their own
    targetUserId = requestedUserId || ('user' in authContext ? authContext.user.id : 'unknown')
  } else if (authContext.type === 'user') {
    // Regular users can only access their own subscriptions
    if (requestedUserId && 'user' in authContext && requestedUserId !== authContext.user.id) {
      return c.json({ error: 'Access denied' }, 403)
    }
    targetUserId = 'user' in authContext ? authContext.user.id : 'unknown'
  } else {
    return c.json({ error: 'Invalid authentication type' }, 403)
  }

  const vapidConfig = await getVapidConfig(c.env)
  if (!vapidConfig.valid || !vapidConfig.config) {
    return c.json({ error: vapidConfig.error }, 500)
  }

  const manager = new NotificationManager(vapidConfig.config.db, vapidConfig.config.vapidConfig)

  const subscriptions = await manager.getUserSubscriptions(targetUserId)

  return c.json(
    subscriptions.map((sub) => ({
      id: sub.id,
      user_id: sub.userId || targetUserId,
      endpoint: sub.endpoint,
      p256dh_key: ('p256dhKey' in sub
        ? sub.p256dhKey
        : 'p256dh_key' in sub
          ? (sub as { p256dh_key: string }).p256dh_key
          : '') as string,
      auth_key: ('authKey' in sub
        ? sub.authKey
        : 'auth_key' in sub
          ? (sub as { auth_key: string }).auth_key
          : '') as string,
      device_info: ('deviceInfo' in sub
        ? sub.deviceInfo
        : 'device_info' in sub
          ? (sub as { device_info: unknown }).device_info
          : {}) as Record<string, unknown>,
      is_active:
        'active' in sub
          ? sub.active !== false
          : 'is_active' in sub
            ? (sub as { is_active: boolean }).is_active !== false
            : true,
      created_at: ('createdAt' in sub
        ? sub.createdAt
        : 'created_at' in sub
          ? (sub as { created_at: string }).created_at
          : '') as string,
      updated_at: ('updatedAt' in sub
        ? sub.updatedAt
        : 'updated_at' in sub
          ? (sub as { updated_at: string }).updated_at
          : '') as string,
    }))
  )
})

// Get user's subscriptions by userId (admin only - legacy endpoint)
push.get('/subscriptions/:userId', async (c) => {
  const authContext = c.get('authContext')

  if (!authContext || (authContext.type !== 'admin' && authContext.type !== 'api_key')) {
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

  if (!authContext || (authContext.type !== 'admin' && authContext.type !== 'api_key')) {
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

  return c.json(rules)
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

    // Fetch the created rule to return complete data
    const createdRule = await c.env.DB?.prepare('SELECT * FROM notification_rules WHERE id = ?')
      .bind(ruleId)
      .first()

    const ruleData = {
      id: createdRule?.id,
      name: createdRule?.name,
      triggerType: createdRule?.trigger_type,
      tableName: createdRule?.table_name,
      eventType: createdRule?.event_type,
      recipientType: createdRule?.recipient_type,
      recipients: createdRule?.recipient_value ? [createdRule?.recipient_value] : undefined,
      titleTemplate: createdRule?.title_template,
      bodyTemplate: createdRule?.body_template,
      iconUrl: createdRule?.icon_url,
      clickAction: createdRule?.click_action,
      isEnabled: createdRule?.enabled === 1,
      created_at: createdRule?.created_at,
      updated_at: createdRule?.updated_at,
    }

    return c.json(ruleData)
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

  if (!authContext || (authContext.type !== 'admin' && authContext.type !== 'api_key')) {
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
    const adminUserId = `admin_${'user' in authContext ? authContext.user.id : 'unknown'}`

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
    const authContext = c.get('authContext')

    if (!authContext || authContext.type !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const adminUserId = `admin_${'user' in authContext ? authContext.user.id : 'unknown'}`

    const vapidConfig = await getVapidConfig(c.env)
    if (!vapidConfig.valid || !vapidConfig.config) {
      return c.json({ error: vapidConfig.error }, 500)
    }

    const manager = new NotificationManager(vapidConfig.config.db, vapidConfig.config.vapidConfig)

    // If endpoint is provided, unsubscribe by endpoint
    if (body.endpoint) {
      await manager.unsubscribe(adminUserId, body.endpoint)
    } else {
      // If no endpoint provided (browser subscription already removed),
      // unsubscribe all active subscriptions for the admin user
      const subscriptions = await manager.getUserSubscriptions(adminUserId)

      for (const subscription of subscriptions) {
        await manager.unsubscribe(adminUserId, subscription.endpoint, subscription.fcmToken)
      }
    }

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

    const adminUserId = `admin_${'user' in authContext ? authContext.user.id : 'unknown'}`

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

  if (!authContext || (authContext.type !== 'admin' && authContext.type !== 'api_key')) {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const adminUserId = `admin_${'user' in authContext ? authContext.user.id : 'unknown'}`

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

  if (!authContext || (authContext.type !== 'admin' && authContext.type !== 'api_key')) {
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
