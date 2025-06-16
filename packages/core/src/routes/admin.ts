import { Hono } from 'hono'
import { getCurrentUser } from '../middleware/auth'
import type { Env, Variables } from '../types'

const admin = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get all admins
admin.get('/', async (c) => {
  const user = getCurrentUser(c)
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  try {
    const db = c.env.DB
    const result = await db.prepare('SELECT * FROM admins ORDER BY created_at DESC').all()
    
    // Convert is_root from SQLite integer to boolean
    const admins = result.results.map((admin: any) => ({
      ...admin,
      is_root: Boolean(admin.is_root)
    }))
    
    return c.json({
      admins
    })
  } catch (error) {
    console.error('Failed to get admins:', error)
    return c.json({ error: 'Failed to get admins' }, 500)
  }
})

// Add new admin
admin.post('/', async (c) => {
  const user = getCurrentUser(c)
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  try {
    const { github_username } = await c.req.json()
    
    if (!github_username || typeof github_username !== 'string') {
      return c.json({ error: 'GitHub username is required' }, 400)
    }

    const db = c.env.DB
    
    // Check if admin already exists
    const existing = await db.prepare(
      'SELECT id FROM admins WHERE github_username = ?'
    ).bind(github_username).first()
    
    if (existing) {
      return c.json({ error: 'Admin already exists' }, 409)
    }
    
    // Add new admin
    await db.prepare(
      'INSERT INTO admins (github_username, is_root) VALUES (?, ?)'
    ).bind(github_username, false).run()
    
    return c.json({ 
      message: 'Admin added successfully',
      github_username 
    })
  } catch (error) {
    console.error('Failed to add admin:', error)
    return c.json({ error: 'Failed to add admin' }, 500)
  }
})

// Remove admin
admin.delete('/:id', async (c) => {
  const user = getCurrentUser(c)
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  try {
    const id = c.req.param('id')
    const db = c.env.DB
    
    // Check if admin exists and is not root
    const admin = await db.prepare(
      'SELECT id, github_username, is_root FROM admins WHERE id = ?'
    ).bind(id).first() as any
    
    if (!admin) {
      return c.json({ error: 'Admin not found' }, 404)
    }
    
    if (admin.is_root) {
      return c.json({ error: 'Cannot remove root admin' }, 403)
    }
    
    // Remove admin
    await db.prepare('DELETE FROM admins WHERE id = ?').bind(id).run()
    
    return c.json({ 
      message: 'Admin removed successfully',
      github_username: admin.github_username
    })
  } catch (error) {
    console.error('Failed to remove admin:', error)
    return c.json({ error: 'Failed to remove admin' }, 500)
  }
})

export { admin }