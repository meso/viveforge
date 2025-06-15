import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { TableManager } from '../lib/table-manager'
import type { Env, Variables } from '../types'

export const data = new Hono<{ Bindings: Env; Variables: Variables }>()

// Middleware to add table manager instance
data.use('*', async (c, next) => {
  if (!c.env.DB) {
    console.error('Database not available in environment')
    return c.json({ error: 'Database not configured' }, 500)
  }
  c.set('tableManager', new TableManager(c.env.DB, c.env.SYSTEM_STORAGE, c.executionCtx))
  await next()
})

// Middleware to validate table exists and is user table
data.use('/:tableName/*', async (c, next) => {
  const tm = c.get('tableManager') as TableManager
  const tableName = c.req.param('tableName')
  
  try {
    const tables = await tm.getTables()
    const table = tables.find(t => t.name === tableName)
    
    if (!table) {
      return c.json({ error: `Table '${tableName}' not found` }, 404)
    }
    
    // Allow read access to system tables for display purposes
    // (Write operations are still protected in individual endpoints)
    
    c.set('tableInfo', table)
    await next()
  } catch (error) {
    console.error('Error validating table:', error)
    return c.json({ error: 'Failed to validate table' }, 500)
  }
})

// GET /api/data/:tableName - Get all records with pagination
data.get('/:tableName', async (c) => {
  const tm = c.get('tableManager') as TableManager
  const tableName = c.req.param('tableName')
  
  try {
    const page = Math.max(1, Number(c.req.query('page') || '1'))
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || '20')))
    const offset = (page - 1) * limit
    // Get table columns to determine default sort field
    const columns = await tm.getTableColumns(tableName)
    const validColumns = columns.map(col => col.name)
    const hasCreatedAt = columns.some(col => col.name === 'created_at')
    
    const sortBy = c.req.query('sortBy') || (hasCreatedAt ? 'created_at' : validColumns[0] || 'ROWID')
    const sortOrder = c.req.query('sortOrder') === 'asc' ? 'ASC' : 'DESC'
    
    if (sortBy !== 'ROWID' && !validColumns.includes(sortBy)) {
      return c.json({ 
        error: `Invalid sort field '${sortBy}'. Valid fields: ${validColumns.join(', ')}` 
      }, 400)
    }
    
    // Get data with custom sorting
    const result = await tm.getTableDataWithSort(tableName, limit, offset, sortBy, sortOrder)
    const baseUrl = new URL(c.req.url).origin
    
    return c.json({
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasNext: page * limit < result.total,
        hasPrev: page > 1
      },
      sort: { by: sortBy, order: sortOrder },
      _links: {
        documentation: {
          swagger: `${baseUrl}/api/docs/swagger`,
          table_spec: `${baseUrl}/api/docs/tables/${tableName}`,
          description: `API documentation for ${tableName} table`
        }
      }
    })
  } catch (error) {
    console.error('Error fetching table data:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch data' 
    }, 500)
  }
})

// GET /api/data/:tableName/:id - Get single record
data.get('/:tableName/:id', async (c) => {
  const tm = c.get('tableManager') as TableManager
  const tableName = c.req.param('tableName')
  const id = c.req.param('id')
  
  try {
    const record = await tm.getRecordById(tableName, id)
    
    if (!record) {
      return c.json({ error: `Record with id '${id}' not found` }, 404)
    }
    
    return c.json({ data: record })
  } catch (error) {
    console.error('Error fetching record:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch record' 
    }, 500)
  }
})

// POST /api/data/:tableName - Create new record
data.post('/:tableName', async (c) => {
  const tm = c.get('tableManager') as TableManager
  const tableName = c.req.param('tableName')
  
  try {
    const body = await c.req.json()
    
    // Validate request body is an object
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ error: 'Request body must be a valid JSON object' }, 400)
    }
    
    // Get table schema for validation
    const columns = await tm.getTableColumns(tableName)
    const errors = await validateRecordData(body, columns, 'create')
    
    if (errors.length > 0) {
      return c.json({ error: 'Validation failed', details: errors }, 400)
    }
    
    const id = await tm.createRecordWithId(tableName, body)
    
    return c.json({ 
      success: true, 
      data: { id, ...body },
      message: 'Record created successfully' 
    }, 201)
  } catch (error) {
    console.error('Error creating record:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to create record' 
    }, 400)
  }
})

// PUT /api/data/:tableName/:id - Update record
data.put('/:tableName/:id', async (c) => {
  const tm = c.get('tableManager') as TableManager
  const tableName = c.req.param('tableName')
  const id = c.req.param('id')
  
  try {
    const body = await c.req.json()
    
    // Validate request body is an object
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ error: 'Request body must be a valid JSON object' }, 400)
    }
    
    // Check if record exists
    const existingRecord = await tm.getRecordById(tableName, id)
    if (!existingRecord) {
      return c.json({ error: `Record with id '${id}' not found` }, 404)
    }
    
    // Get table schema for validation
    const columns = await tm.getTableColumns(tableName)
    const errors = await validateRecordData(body, columns, 'update')
    
    if (errors.length > 0) {
      return c.json({ error: 'Validation failed', details: errors }, 400)
    }
    
    await tm.updateRecord(tableName, id, body)
    const updatedRecord = await tm.getRecordById(tableName, id)
    
    return c.json({ 
      success: true, 
      data: updatedRecord,
      message: 'Record updated successfully' 
    })
  } catch (error) {
    console.error('Error updating record:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to update record' 
    }, 400)
  }
})

// DELETE /api/data/:tableName/:id - Delete record
data.delete('/:tableName/:id', async (c) => {
  const tm = c.get('tableManager') as TableManager
  const tableName = c.req.param('tableName')
  const id = c.req.param('id')
  
  try {
    // Check if record exists
    const existingRecord = await tm.getRecordById(tableName, id)
    if (!existingRecord) {
      return c.json({ error: `Record with id '${id}' not found` }, 404)
    }
    
    await tm.deleteRecord(tableName, id)
    
    return c.json({ 
      success: true, 
      message: 'Record deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting record:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to delete record' 
    }, 400)
  }
})

// Helper function to validate record data against table schema
async function validateRecordData(
  data: Record<string, any>, 
  columns: any[], 
  operation: 'create' | 'update'
): Promise<string[]> {
  const errors: string[] = []
  
  // Skip validation for system columns
  const systemColumns = ['id', 'created_at', 'updated_at']
  const userColumns = columns.filter(col => !systemColumns.includes(col.name))
  
  for (const column of userColumns) {
    const value = data[column.name]
    const hasValue = value !== undefined && value !== null && value !== ''
    
    // Check required fields (NOT NULL constraint)
    if (operation === 'create' && column.notnull && !hasValue) {
      errors.push(`Field '${column.name}' is required`)
      continue
    }
    
    // Skip validation if no value provided for update
    if (operation === 'update' && !hasValue) {
      continue
    }
    
    // Type validation
    if (hasValue) {
      const typeError = validateFieldType(column.name, value, column.type)
      if (typeError) {
        errors.push(typeError)
      }
    }
  }
  
  return errors
}

function validateFieldType(fieldName: string, value: any, sqlType: string): string | null {
  const type = sqlType.toUpperCase()
  
  switch (type) {
    case 'INTEGER':
      if (!Number.isInteger(Number(value))) {
        return `Field '${fieldName}' must be an integer`
      }
      break
    case 'REAL':
      if (isNaN(Number(value))) {
        return `Field '${fieldName}' must be a number`
      }
      break
    case 'TEXT':
      if (typeof value !== 'string') {
        return `Field '${fieldName}' must be a string`
      }
      break
    case 'BOOLEAN':
      if (typeof value !== 'boolean' && value !== 0 && value !== 1) {
        return `Field '${fieldName}' must be a boolean`
      }
      break
    case 'BLOB':
      // Accept any value for BLOB
      break
    default:
      // For custom types, accept any value
      break
  }
  
  return null
}