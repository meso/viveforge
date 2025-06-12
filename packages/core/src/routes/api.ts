import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Database } from '../lib/database'
import type { Env } from '../types'

export const api = new Hono<{ Bindings: Env }>()

// Health check
api.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: c.env.DB ? 'connected' : 'not configured'
  })
})

// Middleware to add database instance
api.use('*', async (c, next) => {
  if (c.env.DB) {
    c.set('db', new Database(c.env.DB))
  }
  await next()
})

// Items CRUD endpoints
const createItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

api.post('/items', zValidator('json', createItemSchema), async (c) => {
  const db = c.get('db') as Database
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const data = c.req.valid('json')
    const userId = c.get('userId') // From auth middleware if logged in
    
    const item = await db.createItem({
      name: data.name,
      description: data.description,
      userId,
    })
    
    return c.json(item, 201)
  } catch (error) {
    console.error('Error creating item:', error)
    return c.json({ error: 'Failed to create item' }, 500)
  }
})

api.get('/items', async (c) => {
  const db = c.get('db') as Database
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const page = Number(c.req.query('page') || '1')
    const pageSize = Number(c.req.query('pageSize') || '20')
    const offset = (page - 1) * pageSize
    const userId = c.get('userId') // From auth middleware if logged in
    
    const result = await db.getItems(userId, pageSize, offset)
    
    return c.json({
      ...result,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('Error fetching items:', error)
    return c.json({ error: 'Failed to fetch items' }, 500)
  }
})

api.get('/items/:id', async (c) => {
  const db = c.get('db') as Database
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const id = c.req.param('id')
    const item = await db.getItemById(id)
    
    if (!item) {
      return c.json({ error: 'Item not found' }, 404)
    }
    
    return c.json(item)
  } catch (error) {
    console.error('Error fetching item:', error)
    return c.json({ error: 'Failed to fetch item' }, 500)
  }
})

api.put('/items/:id', zValidator('json', createItemSchema), async (c) => {
  const db = c.get('db') as Database
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const id = c.req.param('id')
    const data = c.req.valid('json')
    
    const item = await db.updateItem(id, {
      name: data.name,
      description: data.description,
    })
    
    if (!item) {
      return c.json({ error: 'Item not found' }, 404)
    }
    
    return c.json(item)
  } catch (error) {
    console.error('Error updating item:', error)
    return c.json({ error: 'Failed to update item' }, 500)
  }
})

api.delete('/items/:id', async (c) => {
  const db = c.get('db') as Database
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const id = c.req.param('id')
    const result = await db.deleteItem(id)
    
    return c.json(result)
  } catch (error) {
    console.error('Error deleting item:', error)
    return c.json({ error: 'Failed to delete item' }, 500)
  }
})

// Projects endpoints
const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

api.post('/projects', zValidator('json', createProjectSchema), async (c) => {
  const db = c.get('db') as Database
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const data = c.req.valid('json')
    const ownerId = c.get('userId') || 'anonymous' // Should require auth in real app
    
    const project = await db.createProject({
      name: data.name,
      description: data.description,
      ownerId,
    })
    
    return c.json(project, 201)
  } catch (error) {
    console.error('Error creating project:', error)
    return c.json({ error: 'Failed to create project' }, 500)
  }
})

api.get('/projects', async (c) => {
  const db = c.get('db') as Database
  if (!db) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const ownerId = c.get('userId') || 'anonymous' // Should require auth in real app
    const projects = await db.getProjects(ownerId)
    
    return c.json({ projects })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return c.json({ error: 'Failed to fetch projects' }, 500)
  }
})