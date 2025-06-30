import { Hono } from 'hono'
import { generateId } from '../lib/utils'
import { multiAuth } from '../middleware/auth'
import { requireAdminUser, requireDatabase } from '../middleware/common'
import type { Env, Variables } from '../types'
import {
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '../utils/responses'

const admin = new Hono<{ Bindings: Env; Variables: Variables }>()

// Apply authentication and database middleware to all routes
admin.use('*', multiAuth)
admin.use('*', requireAdminUser)
admin.use('*', requireDatabase)

// Note: All c.env.DB! usages below are safe because requireDatabase middleware
// ensures the database is available before any route handlers are called

// Get all admins
admin.get('/', async (c) => {
  try {
    // Database is guaranteed to be available by requireDatabase middleware
    const result = await c.env.DB!.prepare('SELECT * FROM admins ORDER BY created_at DESC').all()

    // Convert is_root from SQLite integer to boolean
    const admins = result.results.map((admin: Record<string, unknown>) => ({
      ...admin,
      is_root: Boolean(admin.is_root),
    }))

    return c.json({
      admins,
    })
  } catch (error) {
    console.error('Failed to get admins:', error)
    return errorResponse(c, 'Failed to get admins')
  }
})

// Add new admin
admin.post('/', async (c) => {
  try {
    const { github_username } = await c.req.json()

    if (!github_username || typeof github_username !== 'string') {
      return validationErrorResponse(c, 'GitHub username is required')
    }

    // Check if admin already exists
    const existing = await c.env
      .DB!.prepare('SELECT id FROM admins WHERE github_username = ?')
      .bind(github_username)
      .first()

    if (existing) {
      return errorResponse(c, 'Admin already exists', 409)
    }

    // Add new admin
    await c.env
      .DB!.prepare('INSERT INTO admins (id, github_username, is_root) VALUES (?, ?, ?)')
      .bind(generateId(), github_username, false)
      .run()

    return c.json({
      message: 'Admin added successfully',
      github_username,
    })
  } catch (error) {
    console.error('Failed to add admin:', error)
    return errorResponse(c, 'Failed to add admin')
  }
})

// Remove admin
admin.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')

    // Check if admin exists and is not root
    const admin = (await c.env
      .DB!.prepare('SELECT id, github_username, is_root FROM admins WHERE id = ?')
      .bind(id)
      .first()) as Record<string, unknown>

    if (!admin) {
      return notFoundResponse(c, 'Admin')
    }

    if (admin.is_root) {
      return errorResponse(c, 'Cannot remove root admin', 403)
    }

    // Remove admin
    await c.env.DB!.prepare('DELETE FROM admins WHERE id = ?').bind(id).run()

    return c.json({
      message: 'Admin removed successfully',
      github_username: admin.github_username as string,
    })
  } catch (error) {
    console.error('Failed to remove admin:', error)
    return errorResponse(c, 'Failed to remove admin')
  }
})

export { admin }
