import { Hono } from 'hono'
import { AppSettingsManager } from '../lib/app-settings-manager'
import { multiAuth, requireAdmin } from '../middleware/auth'
import type { Env, Variables } from '../types'

const appSettings = new Hono<{ Bindings: Env; Variables: Variables }>()

// All app settings routes require admin authentication
appSettings.use('*', multiAuth, requireAdmin)

// Get all app settings
appSettings.get('/', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json({ error: 'Database not available' }, 503)
    }

    const settingsManager = new AppSettingsManager(c.env.DB)
    const settings = await settingsManager.getSettingsForAPI()

    return c.json({ settings })
  } catch (error) {
    console.error('Failed to get app settings:', error)
    return c.json({ error: 'Failed to get app settings' }, 500)
  }
})

// Get a specific setting
appSettings.get('/:key', async (c) => {
  try {
    const key = c.req.param('key')

    if (!c.env.DB) {
      return c.json({ error: 'Database not available' }, 503)
    }

    const settingsManager = new AppSettingsManager(c.env.DB)
    const value = await settingsManager.getSetting(key)

    if (value === null) {
      return c.json({ error: `Setting '${key}' not found` }, 404)
    }

    return c.json({ key, value })
  } catch (error) {
    console.error('Failed to get app setting:', error)
    return c.json({ error: 'Failed to get app setting' }, 500)
  }
})

// Update app settings
appSettings.put('/', async (c) => {
  try {
    const body = await c.req.json()

    if (!c.env.DB) {
      return c.json({ error: 'Database not available' }, 503)
    }

    // Validate input
    const allowedKeys = ['app_name', 'app_url', 'support_email', 'app_description']
    const settings: Record<string, string> = {}

    for (const [key, value] of Object.entries(body)) {
      if (allowedKeys.includes(key) && typeof value === 'string') {
        settings[key] = value
      }
    }

    if (Object.keys(settings).length === 0) {
      return c.json(
        {
          error: 'No valid settings provided',
          allowed_keys: allowedKeys,
        },
        400
      )
    }

    const settingsManager = new AppSettingsManager(c.env.DB)
    await settingsManager.updateSettings(settings)

    // Return updated settings
    const updatedSettings = await settingsManager.getSettingsForAPI()

    return c.json({
      success: true,
      message: 'App settings updated successfully',
      settings: updatedSettings,
    })
  } catch (error) {
    console.error('Failed to update app settings:', error)
    return c.json({ error: 'Failed to update app settings' }, 500)
  }
})

export default appSettings
