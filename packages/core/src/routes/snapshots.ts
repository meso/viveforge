import { Hono } from 'hono'
import { Database } from '../lib/database'
import { TableManager } from '../lib/table-manager'
import type { Env, Variables } from '../types'

const snapshots = new Hono<{ Bindings: Env; Variables: Variables }>()

// Middleware
snapshots.use('*', async (c, next) => {
  const env = c.env
  if (!env.DB) {
    return c.json({ error: 'Database not configured' }, 500)
  }

  const tableManager = new TableManager(env.DB, env.SYSTEM_STORAGE as any, c.executionCtx, {
    REALTIME: env.REALTIME,
  })
  const db = new Database(env.DB)

  c.set('tableManager', tableManager)
  c.set('db', db)

  await next()
})

// Get all snapshots
snapshots.get('/', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = parseInt(c.req.query('offset') || '0')

    const tableManager = c.get('tableManager')!
    const result = await tableManager.getSnapshots(limit, offset)

    return c.json(result)
  } catch (error) {
    console.error('Failed to get snapshots:', error)
    return c.json({ error: 'Failed to get snapshots' }, 500)
  }
})

// Get single snapshot
snapshots.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const tableManager = c.get('tableManager')!
    const snapshot = await tableManager.getSnapshot(id)

    if (!snapshot) {
      return c.json({ error: 'Snapshot not found' }, 404)
    }

    return c.json(snapshot)
  } catch (error) {
    console.error('Failed to get snapshot:', error)
    return c.json({ error: 'Failed to get snapshot' }, 500)
  }
})

// Create new snapshot
snapshots.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const { name, description } = body

    const tableManager = c.get('tableManager')!
    const adminId = c.get('adminId') // If available from auth

    const id = await tableManager.createSnapshot({
      name,
      description,
      createdBy: adminId,
    })

    return c.json({ success: true, id })
  } catch (error) {
    console.error('Failed to create snapshot:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: `Failed to create snapshot: ${errorMessage}` }, 500)
  }
})

// Restore from snapshot
snapshots.post('/:id/restore', async (c) => {
  try {
    const id = c.req.param('id')

    const tableManager = c.get('tableManager')!
    if (!tableManager) {
      throw new Error('TableManager not available')
    }

    await tableManager.restoreSnapshot(id)

    return c.json({ success: true, message: 'Snapshot restored successfully' })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error) || 'Failed to restore snapshot'
    const errorResponse = {
      error: errorMessage,
      type: error?.constructor?.name || typeof error,
      details: error instanceof Error ? error.stack : undefined,
      originalError:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : String(error),
    }

    console.error('Error response being sent:', errorResponse)
    return c.json(errorResponse, 500)
  }
})

// Delete snapshot
snapshots.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const tableManager = c.get('tableManager')!

    await tableManager.deleteSnapshot(id)

    return c.json({ success: true, message: 'Snapshot deleted successfully' })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete snapshot'
    return c.json({ error: errorMessage }, 500)
  }
})

// Compare snapshots
snapshots.get('/compare/:id1/:id2', async (c) => {
  try {
    const id1 = c.req.param('id1')
    const id2 = c.req.param('id2')
    const tableManager = c.get('tableManager')!

    const snapshot1 = await tableManager.getSnapshot(id1)
    const snapshot2 = await tableManager.getSnapshot(id2)

    if (!snapshot1 || !snapshot2) {
      return c.json({ error: 'One or both snapshots not found' }, 404)
    }

    // Parse schemas for comparison
    const schemas1 = JSON.parse(snapshot1.tablesJson)
    const schemas2 = JSON.parse(snapshot2.tablesJson)

    // Simple comparison - can be enhanced
    const added = schemas2.filter((s2: any) => !schemas1.find((s1: any) => s1.name === s2.name))
    const removed = schemas1.filter((s1: any) => !schemas2.find((s2: any) => s2.name === s1.name))
    const modified = schemas2.filter((s2: any) => {
      const s1 = schemas1.find((s: any) => s.name === s2.name)
      return s1 && s1.sql !== s2.sql
    })

    return c.json({
      snapshot1: { id: id1, version: snapshot1.version, name: snapshot1.name },
      snapshot2: { id: id2, version: snapshot2.version, name: snapshot2.name },
      changes: { added, removed, modified },
    })
  } catch (error) {
    console.error('Failed to compare snapshots:', error)
    return c.json({ error: 'Failed to compare snapshots' }, 500)
  }
})

export { snapshots }
