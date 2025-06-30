import { Hono } from 'hono'
import { API_SCOPES, APIKeyManager, type CreateAPIKeyRequest } from '../lib/api-key-manager'
import { getCurrentUser, multiAuth } from '../middleware/auth'
import { requireDatabase } from '../middleware/common'
import type { Env, Variables } from '../types'
import { errorResponse, notFoundResponse, successResponse } from '../utils/responses'

export const apiKeys = new Hono<{ Bindings: Env; Variables: Variables }>()

// Apply authentication to all routes
apiKeys.use('*', multiAuth)

// Apply database check to all routes
apiKeys.use('*', requireDatabase)

// Initialize API key manager middleware
apiKeys.use('*', async (c, next) => {
  const db = c.env.DB
  if (!db) {
    return errorResponse(c, 'Database not available', 500)
  }
  const apiKeyManager = new APIKeyManager(db)
  c.set('apiKeyManager', apiKeyManager)
  await next()
})

// Initialize API keys table
apiKeys.post('/init', async (c) => {
  try {
    const apiKeyManager = c.get('apiKeyManager') as APIKeyManager
    await apiKeyManager.initializeTable()
    return successResponse(c, undefined, 'API keys table initialized')
  } catch (error) {
    return c.json(
      {
        error: 'Failed to initialize API keys table',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

// Get available scopes
apiKeys.get('/scopes', async (c) => {
  return c.json({ scopes: API_SCOPES })
})

// List API keys for current user
apiKeys.get('/', async (c) => {
  try {
    const user = getCurrentUser(c)
    if (!user) {
      return errorResponse(c, 'Admin access required', 403)
    }

    // Get admin ID from database using GitHub username
    const adminResult = await c.env.DB?.prepare(`
      SELECT id FROM admins WHERE github_username = ?
    `)
      .bind((user as Record<string, unknown>).username || user.email)
      .first()

    if (!adminResult) {
      return notFoundResponse(c, 'Admin')
    }

    const apiKeyManager = c.get('apiKeyManager') as APIKeyManager
    const apiKeys = await apiKeyManager.listAPIKeys(adminResult.id as string)

    return c.json({ data: apiKeys })
  } catch (error) {
    console.error('Error listing API keys:', error)

    // Check if it's a table not found error (database not initialized)
    if (error instanceof Error && error.message.includes('no such table')) {
      return c.json({ data: [] }) // Return empty array instead of error
    }

    return c.json(
      {
        error: 'Failed to list API keys',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

// Create new API key
apiKeys.post('/', async (c) => {
  try {
    const user = getCurrentUser(c)
    if (!user) {
      return errorResponse(c, 'Admin access required', 403)
    }

    // Get admin ID from database using GitHub username
    const adminResult = await c.env.DB?.prepare(`
      SELECT id FROM admins WHERE github_username = ?
    `)
      .bind((user as Record<string, unknown>).username || user.email)
      .first()

    if (!adminResult) {
      return notFoundResponse(c, 'Admin')
    }

    const body = (await c.req.json()) as CreateAPIKeyRequest

    // Validate request
    if (!body.name || !body.scopes || !Array.isArray(body.scopes)) {
      return c.json(
        {
          error: 'Validation failed',
          details: ['name and scopes are required', 'scopes must be an array'],
        },
        400
      )
    }

    // Validate scopes
    const validScopes = Object.keys(API_SCOPES)
    const invalidScopes = body.scopes.filter((scope) => !validScopes.includes(scope))

    if (invalidScopes.length > 0) {
      return c.json(
        {
          error: 'Invalid scopes',
          details: [`Invalid scopes: ${invalidScopes.join(', ')}`],
          valid_scopes: validScopes,
        },
        400
      )
    }

    const apiKeyManager = c.get('apiKeyManager') as APIKeyManager
    const result = await apiKeyManager.createAPIKey(body, adminResult.id as string)

    return c.json(
      {
        success: true,
        data: result,
        message:
          'API key created successfully. Save the key securely - it will not be shown again.',
      },
      201
    )
  } catch (error) {
    return c.json(
      {
        error: 'Failed to create API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

// Revoke API key
apiKeys.patch('/:id/revoke', async (c) => {
  const keyId = c.req.param('id')
  let adminId: string | undefined

  try {
    const user = getCurrentUser(c)
    if (!user) {
      return errorResponse(c, 'Admin access required', 403)
    }

    // Get admin ID from database using GitHub username
    const adminResult = await c.env.DB?.prepare(`
      SELECT id FROM admins WHERE github_username = ?
    `)
      .bind((user as Record<string, unknown>).username || user.email)
      .first()

    if (!adminResult) {
      return notFoundResponse(c, 'Admin')
    }

    adminId = adminResult.id as string
    const apiKeyManager = c.get('apiKeyManager') as APIKeyManager

    // First check if the key exists and belongs to this admin
    const existingKeys = await apiKeyManager.listAPIKeys(adminId)
    const keyToRevoke = existingKeys.find((key) => key.id === keyId)

    if (!keyToRevoke) {
      return c.json(
        {
          error: 'API key not found or access denied',
        },
        404
      )
    }

    const success = await apiKeyManager.revokeAPIKey(keyId, adminId)

    if (!success) {
      // Double-check if the update actually failed
      const updatedKeys = await apiKeyManager.listAPIKeys(adminId)
      const _updatedKey = updatedKeys.find((k) => k.id === keyId)
      return c.json(
        {
          error: 'Failed to revoke API key',
        },
        500
      )
    }

    return c.json({
      success: true,
      message: 'API key revoked successfully',
    })
  } catch (error) {
    return c.json(
      {
        error: 'Failed to revoke API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

// Delete API key
apiKeys.delete('/:id', async (c) => {
  try {
    const user = getCurrentUser(c)
    if (!user) {
      return errorResponse(c, 'Admin access required', 403)
    }

    // Get admin ID from database using GitHub username
    const adminResult = await c.env.DB?.prepare(`
      SELECT id FROM admins WHERE github_username = ?
    `)
      .bind((user as Record<string, unknown>).username || user.email)
      .first()

    if (!adminResult) {
      return notFoundResponse(c, 'Admin')
    }

    const id = c.req.param('id')
    const apiKeyManager = c.get('apiKeyManager') as APIKeyManager

    const success = await apiKeyManager.deleteAPIKey(id, adminResult.id as string)

    if (!success) {
      return c.json({ error: 'API key not found or access denied' }, 404)
    }

    return c.json({
      success: true,
      message: 'API key deleted successfully',
    })
  } catch (error) {
    return c.json(
      {
        error: 'Failed to delete API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})
