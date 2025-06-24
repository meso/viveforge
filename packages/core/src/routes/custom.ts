import { Hono } from 'hono'
import { generateId } from '../lib/utils'
import type { Env, Variables } from '../types'

// Type definitions
interface Parameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date'
  required: boolean
  description?: string
  default?: string | number | boolean
}

export const custom = new Hono<{ Bindings: Env; Variables: Variables }>()

// Dynamic custom query execution
custom.all('/:slug', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json({ error: 'Database not configured' }, 500)
    }

    const slug = c.req.param('slug')
    const method = c.req.method

    // Fetch the custom query by slug
    const query = await c.env.DB.prepare(`
      SELECT * FROM custom_queries 
      WHERE slug = ? AND enabled = 1
    `)
      .bind(slug)
      .first()

    if (!query) {
      return c.json({ error: 'Custom query not found' }, 404)
    }

    // Check if the method matches
    if (query.method !== method) {
      return c.json(
        {
          error: `Method not allowed. This endpoint expects ${query.method}`,
        },
        405
      )
    }

    // Parse parameters definition
    const paramDefs = JSON.parse((query.parameters as string) || '[]')

    // Get parameters from request
    let providedParams: Record<string, unknown> = {}

    if (method === 'GET') {
      // Get parameters from query string
      const queryParams = c.req.query()
      providedParams = queryParams
    } else if (method === 'POST') {
      // Get parameters from request body
      try {
        providedParams = await c.req.json()
      } catch {
        providedParams = {}
      }
    }

    // Prepare parameters
    const preparedParams = prepareQueryParameters(paramDefs, providedParams)

    const startTime = Date.now()
    let result: { results: unknown[]; success: boolean; meta: unknown } | null = null
    let error = null

    try {
      // Execute the query
      if (query.is_readonly) {
        result = await c.env.DB.prepare(query.sql_query as string)
          .bind(...Object.values(preparedParams))
          .all()
      } else {
        result = await c.env.DB.prepare(query.sql_query as string)
          .bind(...Object.values(preparedParams))
          .run()
      }
    } catch (queryError) {
      error = queryError instanceof Error ? queryError.message : 'Query execution failed'
    }

    const executionTime = Date.now() - startTime

    // Log the execution (fire and forget)
    if (c.executionCtx) {
      c.executionCtx.waitUntil(
        c.env.DB.prepare(`
        INSERT INTO custom_query_logs (id, query_id, execution_time, row_count, parameters, error)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
          .bind(
            generateId(),
            query.id,
            executionTime,
            result?.results?.length || 0,
            JSON.stringify(providedParams),
            error
          )
          .run()
      )
    }

    if (error) {
      return c.json({ error }, 400)
    }

    // Handle caching if specified
    const response = c.json({
      success: true,
      data: result?.results || [],
      meta: {
        row_count: result?.results?.length || 0,
        execution_time: executionTime,
      },
    })

    // Set cache headers if cache_ttl is specified
    if (query.cache_ttl && Number(query.cache_ttl) > 0) {
      response.headers.set('Cache-Control', `public, max-age=${query.cache_ttl}`)
    }

    return response
  } catch (error) {
    console.error('Error executing custom query:', error)
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to execute custom query',
      },
      500
    )
  }
})

// Helper function to prepare query parameters
function prepareQueryParameters(
  paramDefs: Parameter[],
  providedParams: Record<string, unknown>
): Record<string, unknown> {
  const prepared: Record<string, unknown> = {}

  for (const paramDef of paramDefs) {
    let value = providedParams[paramDef.name]

    // Use default if not provided
    if (value === undefined && paramDef.default !== undefined) {
      value = paramDef.default
    }

    // Check required parameters
    if (value === undefined && paramDef.required) {
      throw new Error(`Required parameter '${paramDef.name}' is missing`)
    }

    // Type conversion and validation
    if (value !== undefined) {
      switch (paramDef.type) {
        case 'number':
          value = Number(value)
          if (Number.isNaN(value as number)) {
            throw new Error(`Parameter '${paramDef.name}' must be a number`)
          }
          break
        case 'boolean':
          // Handle string boolean values from query params
          if (typeof value === 'string') {
            value = value.toLowerCase() === 'true' || value === '1'
          } else {
            value = Boolean(value)
          }
          break
        case 'date': {
          // Convert to ISO string if it's a valid date
          const date = new Date(value as string)
          if (Number.isNaN(date.getTime())) {
            throw new Error(`Parameter '${paramDef.name}' must be a valid date`)
          }
          value = date.toISOString()
          break
        }
        default:
          value = String(value)
      }
    }

    prepared[paramDef.name] = value ?? null
  }

  return prepared
}
