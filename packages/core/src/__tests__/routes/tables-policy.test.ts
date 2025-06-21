import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { SYSTEM_TABLES } from '../../lib/table-manager'
import type { Env, Variables } from '../../types'

// Mock auth middleware
vi.mock('../../middleware/auth', () => ({
  authMiddleware: vi.fn(() => async (c: any, next: any) => {
    c.set('auth', { type: 'admin' })
    await next()
  }),
}))

// Create the policy update schema
const policyUpdateSchema = z.object({
  access_policy: z.enum(['public', 'private'], {
    errorMap: () => ({ message: 'Access policy must be either "public" or "private"' }),
  }),
})

describe('Table Access Policy Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let mockTableManager: any

  beforeEach(() => {
    app = new Hono<{ Bindings: Env; Variables: Variables }>()

    // Mock TableManager
    mockTableManager = {
      getTables: vi.fn(),
      getTableColumns: vi.fn(),
      getTableAccessPolicy: vi.fn(),
      setTableAccessPolicy: vi.fn(),
    }

    // Add middleware to inject tableManager
    app.use('*', async (c, next) => {
      c.set('tableManager', mockTableManager)
      await next()
    })

    // Add the specific route we're testing
    app.put('/api/tables/:tableName/policy', zValidator('json', policyUpdateSchema), async (c) => {
      try {
        const tableName = c.req.param('tableName')
        const { access_policy } = c.req.valid('json')
        const tableManager = c.get('tableManager')!

        // Check if table is a system table
        if (SYSTEM_TABLES.includes(tableName as (typeof SYSTEM_TABLES)[number])) {
          return c.json(
            {
              error: 'Cannot modify access policy for system tables',
            },
            403
          )
        }

        // Verify table exists
        const tables = await tableManager.getTables()
        const table = tables.find((t) => t.name === tableName)
        if (!table) {
          return c.json(
            {
              error: `Table '${tableName}' not found`,
            },
            404
          )
        }

        // When changing from public to private, verify owner_id column exists
        if (table.access_policy === 'public' && access_policy === 'private') {
          const columns = await tableManager.getTableColumns(tableName)
          const hasOwnerIdColumn = columns.some((col) => col.name === 'owner_id')

          if (!hasOwnerIdColumn) {
            return c.json(
              {
                error: `Cannot change table '${tableName}' to private: missing owner_id column. Private tables require an owner_id column for access control.`,
              },
              400
            )
          }
        }

        await tableManager.setTableAccessPolicy(tableName, access_policy)

        return c.json({
          success: true,
          table_name: tableName,
          access_policy: access_policy,
          message: `Access policy for table '${tableName}' updated to '${access_policy}'`,
        })
      } catch (error) {
        console.error('Error updating table policy:', error)
        return c.json(
          {
            error: error instanceof Error ? error.message : 'Failed to update table policy',
          },
          500
        )
      }
    })
  })

  describe('PUT /api/tables/:tableName/policy', () => {
    it('should update table access policy from public to private when owner_id exists', async () => {
      mockTableManager.getTables.mockResolvedValue([{ name: 'users', access_policy: 'public' }])
      mockTableManager.getTableColumns.mockResolvedValue([
        { name: 'id', type: 'TEXT' },
        { name: 'owner_id', type: 'TEXT' },
        { name: 'name', type: 'TEXT' },
      ])
      mockTableManager.setTableAccessPolicy.mockResolvedValue(undefined)

      const response = await app.request('/api/tables/users/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_policy: 'private' }),
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as {
        success: boolean
        access_policy: string
        table_name: string
        message: string
      }
      expect(data.success).toBe(true)
      expect(data.access_policy).toBe('private')
      expect(mockTableManager.setTableAccessPolicy).toHaveBeenCalledWith('users', 'private')
    })

    it('should fail when changing from public to private without owner_id column', async () => {
      mockTableManager.getTables.mockResolvedValue([{ name: 'products', access_policy: 'public' }])
      mockTableManager.getTableColumns.mockResolvedValue([
        { name: 'id', type: 'TEXT' },
        { name: 'name', type: 'TEXT' },
        { name: 'price', type: 'REAL' },
      ])

      const response = await app.request('/api/tables/products/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_policy: 'private' }),
      })

      expect(response.status).toBe(400)
      const data = (await response.json()) as { error: string }
      expect(data.error).toContain('missing owner_id column')
      expect(data.error).toContain('Private tables require an owner_id column')
      expect(mockTableManager.setTableAccessPolicy).not.toHaveBeenCalled()
    })

    it('should allow changing from private to public regardless of owner_id', async () => {
      mockTableManager.getTables.mockResolvedValue([{ name: 'users', access_policy: 'private' }])
      mockTableManager.setTableAccessPolicy.mockResolvedValue(undefined)

      const response = await app.request('/api/tables/users/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_policy: 'public' }),
      })

      expect(response.status).toBe(200)
      const data = (await response.json()) as {
        success: boolean
        access_policy: string
        table_name: string
        message: string
      }
      expect(data.success).toBe(true)
      expect(data.access_policy).toBe('public')
      expect(mockTableManager.getTableColumns).not.toHaveBeenCalled()
      expect(mockTableManager.setTableAccessPolicy).toHaveBeenCalledWith('users', 'public')
    })

    it('should not check owner_id when policy stays the same', async () => {
      mockTableManager.getTables.mockResolvedValue([{ name: 'users', access_policy: 'private' }])
      mockTableManager.setTableAccessPolicy.mockResolvedValue(undefined)

      const response = await app.request('/api/tables/users/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_policy: 'private' }),
      })

      expect(response.status).toBe(200)
      expect(mockTableManager.getTableColumns).not.toHaveBeenCalled()
      expect(mockTableManager.setTableAccessPolicy).toHaveBeenCalledWith('users', 'private')
    })

    it('should return 404 for non-existent table', async () => {
      mockTableManager.getTables.mockResolvedValue([{ name: 'users', access_policy: 'public' }])

      const response = await app.request('/api/tables/nonexistent/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_policy: 'private' }),
      })

      expect(response.status).toBe(404)
      const data = (await response.json()) as { error: string }
      expect(data.error).toContain("Table 'nonexistent' not found")
    })

    it('should return 403 for system tables', async () => {
      // For system tables, we shouldn't need to mock getTables since the check happens first
      const response = await app.request('/api/tables/admins/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_policy: 'private' }),
      })

      expect(response.status).toBe(403)
      const data = (await response.json()) as { error: string }
      expect(data.error).toContain('Cannot modify access policy for system tables')
    })

    it('should validate access_policy values', async () => {
      const response = await app.request('/api/tables/users/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_policy: 'invalid' }),
      })

      expect(response.status).toBe(400)
      const data = (await response.json()) as { error: { issues: Array<{ message: string }> } }
      // Check the Zod validation error format
      expect(data.error.issues[0].message).toContain(
        'Access policy must be either "public" or "private"'
      )
    })
  })
})
