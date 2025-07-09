import { Hono } from 'hono'
import { Database } from '../lib/database'
import type { TableSchema } from '../lib/schema-snapshot'
import { TableManager } from '../lib/table-manager'
import type { Env, Variables } from '../types'
import type { CustomDurableObjectNamespace } from '../types/cloudflare'

const snapshots = new Hono<{ Bindings: Env; Variables: Variables }>()

// Middleware
snapshots.use('*', async (c, next) => {
  try {
    console.log('Snapshots middleware: starting')
    const env = c.env
    if (!env.DB) {
      console.error('Snapshots middleware: Database not configured')
      return c.json({ error: 'Database not configured' }, 500)
    }

    console.log('Snapshots middleware: Creating TableManager')
    const tableManager = new TableManager(env.DB, env.SYSTEM_STORAGE, c.executionCtx, {
      REALTIME: env.REALTIME as CustomDurableObjectNamespace,
      WORKER_DOMAIN: env.WORKER_DOMAIN,
    })
    console.log('Snapshots middleware: Creating Database')
    const db = new Database(env.DB)

    console.log('Snapshots middleware: Setting context variables')
    c.set('tableManager', tableManager)
    c.set('db', db)

    console.log('Snapshots middleware: Proceeding to next')
    await next()
  } catch (error) {
    console.error('Snapshots middleware error:', error)
    return c.json(
      {
        error: 'Middleware initialization failed',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// Get all snapshots
snapshots.get('/', async (c) => {
  try {
    console.log('Snapshots GET: starting')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = parseInt(c.req.query('offset') || '0')
    console.log('Snapshots GET: parsed params', { limit, offset })

    const tableManager = c.get('tableManager')
    if (!tableManager) {
      console.error('Snapshots GET: TableManager not available')
      return c.json({ error: 'TableManager not available' }, 500)
    }
    console.log('Snapshots GET: got tableManager, calling getSnapshots')
    const result = await tableManager.getSnapshots(limit, offset)
    console.log('Snapshots GET: got result', result)

    return c.json(result)
  } catch (error) {
    console.error('Failed to get snapshots in route:', error)
    console.error('Error type:', typeof error)
    console.error('Error constructor:', error?.constructor?.name)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      if (error.message.includes('no such table')) {
        console.log('Returning empty snapshots due to missing table')
        return c.json({ snapshots: [], total: 0 })
      }
    }
    return c.json(
      {
        error: 'Failed to get snapshots',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

// Get single snapshot
snapshots.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const tableManager = c.get('tableManager')
    if (!tableManager) {
      return c.json({ error: 'TableManager not available' }, 500)
    }
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

    const tableManager = c.get('tableManager')
    if (!tableManager) {
      return c.json({ error: 'TableManager not available' }, 500)
    }
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

    const tableManager = c.get('tableManager')
    if (!tableManager) {
      return c.json({ error: 'TableManager not available' }, 500)
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
    const tableManager = c.get('tableManager')
    if (!tableManager) {
      return c.json({ error: 'TableManager not available' }, 500)
    }

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
    const tableManager = c.get('tableManager')
    if (!tableManager) {
      return c.json({ error: 'TableManager not available' }, 500)
    }

    const snapshot1 = await tableManager.getSnapshot(id1)
    const snapshot2 = await tableManager.getSnapshot(id2)

    if (!snapshot1 || !snapshot2) {
      return c.json({ error: 'One or both snapshots not found' }, 404)
    }

    // Parse schemas for comparison
    const schemas1: TableSchema[] = JSON.parse(snapshot1.tablesJson as string)
    const schemas2: TableSchema[] = JSON.parse(snapshot2.tablesJson as string)

    // Simple comparison - can be enhanced
    const added = schemas2.filter((s2) => !schemas1.find((s1) => s1.name === s2.name))
    const removed = schemas1.filter((s1) => !schemas2.find((s2) => s2.name === s1.name))
    const modified = schemas2.filter((s2) => {
      const s1 = schemas1.find((s) => s.name === s2.name)
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
