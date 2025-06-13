import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { TableManager } from '../lib/table-manager'
import type { Env, Variables } from '../types'

export const tables = new Hono<{ Bindings: Env; Variables: Variables }>()

// Middleware to add table manager instance
tables.use('*', async (c, next) => {
  if (!c.env.DB) {
    console.error('Database not available in environment')
    return c.json({ error: 'Database not configured' }, 500)
  }
  c.set('tableManager', new TableManager(c.env.DB))
  await next()
})

// Get all tables
tables.get('/', async (c) => {
  try {
    const tm = c.get('tableManager') as TableManager
    const tables = await tm.getTables()
    const baseUrl = new URL(c.req.url).origin
    
    return c.json({ 
      tables,
      documentation: {
        swagger: `${baseUrl}/api/docs/swagger`,
        openapi: `${baseUrl}/api/docs/openapi.json`,
        description: 'Interactive API documentation for all your tables'
      }
    })
  } catch (error) {
    console.error('Error fetching tables:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch tables',
      details: error instanceof Error ? error.stack : undefined
    }, 500)
  }
})

// Get table schema
tables.get('/:tableName/schema', async (c) => {
  const tm = c.get('tableManager') as TableManager
  if (!tm) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const tableName = c.req.param('tableName')
    const columns = await tm.getTableColumns(tableName)
    return c.json({ tableName, columns })
  } catch (error) {
    console.error('Error fetching table schema:', error)
    return c.json({ error: 'Failed to fetch table schema' }, 500)
  }
})

// Get table data
tables.get('/:tableName/data', async (c) => {
  const tm = c.get('tableManager') as TableManager
  if (!tm) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const tableName = c.req.param('tableName')
    const limit = Number(c.req.query('limit') || '100')
    const offset = Number(c.req.query('offset') || '0')
    
    const result = await tm.getTableData(tableName, limit, offset)
    return c.json(result)
  } catch (error) {
    console.error('Error fetching table data:', error)
    return c.json({ error: 'Failed to fetch table data' }, 500)
  }
})

// Create new table
const createTableSchema = z.object({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid table name'),
  columns: z.array(z.object({
    name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid column name'),
    type: z.enum(['TEXT', 'INTEGER', 'REAL', 'BLOB', 'BOOLEAN']),
    constraints: z.string().optional(),
    foreignKey: z.object({
      table: z.string(),
      column: z.string()
    }).optional()
  })).min(1)
})

tables.post('/', zValidator('json', createTableSchema), async (c) => {
  const tm = c.get('tableManager') as TableManager
  if (!tm) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const data = c.req.valid('json')
    await tm.createTable(data.name, data.columns)
    return c.json({ success: true, table: data.name }, 201)
  } catch (error) {
    console.error('Error creating table:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to create table' 
    }, 400)
  }
})

// Drop table
tables.delete('/:tableName', async (c) => {
  const tm = c.get('tableManager') as TableManager
  if (!tm) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const tableName = c.req.param('tableName')
    await tm.dropTable(tableName)
    return c.json({ success: true, table: tableName })
  } catch (error) {
    console.error('Error dropping table:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to drop table' 
    }, 400)
  }
})

// Create record in table
tables.post('/:tableName/data', async (c) => {
  const tm = c.get('tableManager') as TableManager
  if (!tm) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const tableName = c.req.param('tableName')
    const data = await c.req.json()
    
    // Check if table is system table
    if (['admins', 'sessions', '_cf_KV'].includes(tableName)) {
      return c.json({ error: 'Cannot modify system table' }, 403)
    }
    
    // Use TableManager to ensure foreign key constraints are enabled
    await tm.createRecord(tableName, data)
    
    return c.json({ success: true }, 201)
  } catch (error) {
    console.error('Error creating record:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to create record' 
    }, 400)
  }
})

// Delete record from table
tables.delete('/:tableName/data/:id', async (c) => {
  const tm = c.get('tableManager') as TableManager
  if (!tm) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const tableName = c.req.param('tableName')
    const id = c.req.param('id')
    
    // Use TableManager to ensure foreign key constraints are enabled
    await tm.deleteRecord(tableName, id)
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting record:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to delete record' 
    }, 400)
  }
})

// Execute SQL query
const executeSQLSchema = z.object({
  sql: z.string().min(1),
  params: z.array(z.any()).optional()
})

tables.post('/query', zValidator('json', executeSQLSchema), async (c) => {
  const tm = c.get('tableManager') as TableManager
  if (!tm) {
    return c.json({ error: 'Database not available' }, 500)
  }

  try {
    const { sql, params = [] } = c.req.valid('json')
    const result = await tm.executeSQL(sql, params)
    return c.json({ result })
  } catch (error) {
    console.error('Error executing SQL:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to execute SQL' 
    }, 400)
  }
})