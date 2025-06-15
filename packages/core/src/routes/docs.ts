import { Hono } from 'hono'
import { TableManager } from '../lib/table-manager'
import type { Env, Variables } from '../types'

export const docs = new Hono<{ Bindings: Env; Variables: Variables }>()

// Middleware to add table manager instance
docs.use('*', async (c, next) => {
  if (!c.env.DB) {
    console.error('Database not available in environment')
    return c.json({ error: 'Database not configured' }, 500)
  }
  c.set('tableManager', new TableManager(c.env.DB, c.env.SYSTEM_STORAGE, c.executionCtx))
  await next()
})

// Generate OpenAPI 3.0 specification for all user tables
docs.get('/openapi.json', async (c) => {
  const tm = c.get('tableManager') as TableManager
  const baseUrl = new URL(c.req.url).origin

  try {
    const tables = await tm.getTables()
    const userTables = tables.filter(table => table.type === 'user')
    
    const openApiSpec = await generateOpenAPISpec(userTables, tm, baseUrl)
    
    return c.json(openApiSpec)
  } catch (error) {
    console.error('Error generating OpenAPI spec:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate API documentation' 
    }, 500)
  }
})

// Generate API documentation for a specific table
docs.get('/tables/:tableName', async (c) => {
  const tm = c.get('tableManager') as TableManager
  const tableName = c.req.param('tableName')
  const baseUrl = new URL(c.req.url).origin

  try {
    const tables = await tm.getTables()
    const table = tables.find(t => t.name === tableName)
    
    if (!table) {
      return c.json({ error: `Table '${tableName}' not found` }, 404)
    }
    
    if (table.type === 'system') {
      return c.json({ error: `Cannot access documentation for system table '${tableName}'` }, 403)
    }

    const columns = await tm.getTableColumns(tableName)
    const searchableColumns = await tm.getSearchableColumns(tableName)
    const documentation = await generateTableDocumentation(table, columns, searchableColumns, baseUrl)
    
    return c.json(documentation)
  } catch (error) {
    console.error('Error generating table documentation:', error)
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to generate table documentation' 
    }, 500)
  }
})

// Swagger UI HTML page
docs.get('/swagger', async (c) => {
  const baseUrl = new URL(c.req.url).origin
  const swaggerHtml = generateSwaggerUI(baseUrl)
  
  return c.html(swaggerHtml)
})

// Generate OpenAPI 3.0 specification
async function generateOpenAPISpec(tables: any[], tm: TableManager, baseUrl: string) {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'Viveforge Dynamic CRUD API',
      description: 'Automatically generated CRUD API for user-created tables',
      version: '1.0.0',
      contact: {
        name: 'Viveforge',
        url: 'https://github.com/meso/viveforge'
      }
    },
    servers: [
      {
        url: baseUrl,
        description: 'Viveforge Instance'
      }
    ],
    paths: {} as any,
    components: {
      schemas: {} as any,
      responses: {
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' }
                }
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  details: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Generate schemas and paths for each table
  for (const table of tables) {
    const columns = await tm.getTableColumns(table.name)
    const searchableColumns = await tm.getSearchableColumns(table.name)
    
    // Generate schema
    const schema = generateTableSchema(table.name, columns)
    spec.components.schemas[table.name] = schema.full
    spec.components.schemas[`${table.name}Input`] = schema.input
    spec.components.schemas[`${table.name}Update`] = schema.update
    
    // Generate paths
    const paths = generateTablePaths(table.name, searchableColumns)
    Object.assign(spec.paths, paths)
  }

  return spec
}

// Generate schema for a table
function generateTableSchema(tableName: string, columns: any[]) {
  const properties: any = {}
  const required: string[] = []
  const inputProperties: any = {}
  const inputRequired: string[] = []

  for (const column of columns) {
    const isSystemField = ['id', 'created_at', 'updated_at'].includes(column.name)
    const fieldSchema = getFieldSchema(column)
    
    properties[column.name] = fieldSchema
    
    if (!isSystemField) {
      inputProperties[column.name] = fieldSchema
      if (column.notnull && !column.dflt_value) {
        inputRequired.push(column.name)
      }
    }
  }

  return {
    full: {
      type: 'object',
      properties,
      required: ['id', 'created_at', 'updated_at']
    },
    input: {
      type: 'object',
      properties: inputProperties,
      required: inputRequired
    },
    update: {
      type: 'object',
      properties: inputProperties
    }
  }
}

// Convert SQL type to JSON schema type
function getFieldSchema(column: any) {
  const type = column.type.toUpperCase()
  const schema: any = { description: `${column.name} field` }
  
  switch (type) {
    case 'INTEGER':
      schema.type = 'integer'
      break
    case 'REAL':
      schema.type = 'number'
      break
    case 'TEXT':
      schema.type = 'string'
      break
    case 'BOOLEAN':
      schema.type = 'boolean'
      break
    case 'BLOB':
      schema.type = 'string'
      schema.format = 'binary'
      break
    default:
      schema.type = 'string'
  }

  if (column.notnull) {
    schema.description += ' (required)'
  }

  if (column.dflt_value) {
    schema.default = column.dflt_value
  }

  return schema
}

// Generate OpenAPI paths for a table
function generateTablePaths(tableName: string, searchableColumns: Array<{name: string, type: string}> = []) {
  return {
    [`/api/data/${tableName}`]: {
      get: {
        summary: `Get all ${tableName} records`,
        description: `Retrieve all records from the ${tableName} table with pagination and sorting`,
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number',
            schema: { type: 'integer', default: 1, minimum: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Records per page',
            schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 }
          },
          {
            name: 'sortBy',
            in: 'query',
            description: 'Field to sort by',
            schema: { type: 'string', default: 'created_at' }
          },
          {
            name: 'sortOrder',
            in: 'query',
            description: 'Sort order',
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: `#/components/schemas/${tableName}` }
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' },
                        hasNext: { type: 'boolean' },
                        hasPrev: { type: 'boolean' }
                      }
                    },
                    sort: {
                      type: 'object',
                      properties: {
                        by: { type: 'string' },
                        order: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' }
        },
        tags: [tableName]
      },
      post: {
        summary: `Create new ${tableName} record`,
        description: `Create a new record in the ${tableName} table`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${tableName}Input` }
            }
          }
        },
        responses: {
          '201': {
            description: 'Record created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: `#/components/schemas/${tableName}` },
                    message: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' }
        },
        tags: [tableName]
      }
    },
    [`/api/data/${tableName}/{id}`]: {
      get: {
        summary: `Get ${tableName} record by ID`,
        description: `Retrieve a specific record from the ${tableName} table`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Record ID',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: `#/components/schemas/${tableName}` }
                  }
                }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' }
        },
        tags: [tableName]
      },
      put: {
        summary: `Update ${tableName} record`,
        description: `Update a specific record in the ${tableName} table`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Record ID',
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${tableName}Update` }
            }
          }
        },
        responses: {
          '200': {
            description: 'Record updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: `#/components/schemas/${tableName}` },
                    message: { type: 'string' }
                  }
                }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '400': { $ref: '#/components/responses/ValidationError' }
        },
        tags: [tableName]
      },
      delete: {
        summary: `Delete ${tableName} record`,
        description: `Delete a specific record from the ${tableName} table`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Record ID',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Record deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' }
        },
        tags: [tableName]
      }
    },
    [`/api/tables/${tableName}/search`]: {
      get: {
        summary: `Search ${tableName} records`,
        description: `Search records in the ${tableName} table by indexed column values. Only columns with database indexes can be searched.`,
        parameters: [
          {
            name: 'column',
            in: 'query',
            required: true,
            description: searchableColumns.length > 0 
              ? `Column name to search. Available columns and their supported operators:\n${searchableColumns.map(col => `- ${col.name} (${col.type}): ${col.type === 'TEXT' ? 'eq, is_null, is_not_null' : 'eq, lt, le, gt, ge, ne, is_null, is_not_null'}`).join('\n')}`
              : 'Column name to search. No searchable columns available - this table has no indexed columns of TEXT or INTEGER type.',
            schema: { 
              type: 'string',
              enum: searchableColumns.length > 0 ? searchableColumns.map(col => col.name) : ['no-columns-available']
            }
          },
          {
            name: 'operator',
            in: 'query',
            required: true,
            description: 'Search operator',
            schema: {
              type: 'string',
              enum: ['eq', 'lt', 'le', 'gt', 'ge', 'ne', 'is_null', 'is_not_null']
            }
          },
          {
            name: 'value',
            in: 'query',
            required: false,
            description: 'Value to search for (required for non-null operators)',
            schema: { type: 'string' }
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Maximum number of results',
            schema: { type: 'integer', minimum: 1 }
          },
          {
            name: 'offset',
            in: 'query',
            required: false,
            description: 'Number of records to skip',
            schema: { type: 'integer', minimum: 0, default: 0 }
          }
        ],
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: `#/components/schemas/${tableName}` }
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer', description: 'Total matching records' },
                        limit: { type: 'integer', description: 'Limit applied' },
                        offset: { type: 'integer', description: 'Offset applied' },
                        hasMore: { type: 'boolean', description: 'Whether more results exist' }
                      }
                    },
                    query: {
                      type: 'object',
                      properties: {
                        table: { type: 'string' },
                        column: { type: 'string' },
                        operator: { type: 'string' },
                        value: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Search error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string' },
                        message: { type: 'string' },
                        details: { type: 'object' }
                      }
                    }
                  }
                }
              }
            }
          },
          '403': {
            description: 'System table access denied',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string' },
                        message: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        tags: [tableName]
      }
    }
  }
}

// Generate documentation for a specific table
async function generateTableDocumentation(table: any, columns: any[], searchableColumns: Array<{name: string, type: string}>, baseUrl: string) {
  const userColumns = columns.filter(col => !['id', 'created_at', 'updated_at'].includes(col.name))
  
  return {
    table: {
      name: table.name,
      type: table.type,
      rowCount: table.rowCount,
      sql: table.sql
    },
    schema: {
      columns: columns.map(col => ({
        name: col.name,
        type: col.type,
        nullable: !col.notnull,
        defaultValue: col.dflt_value,
        primaryKey: !!col.pk,
        description: getColumnDescription(col)
      }))
    },
    endpoints: {
      list: {
        method: 'GET',
        url: `${baseUrl}/api/data/${table.name}`,
        description: `Get all ${table.name} records with pagination`,
        parameters: [
          { name: 'page', type: 'integer', description: 'Page number (default: 1)' },
          { name: 'limit', type: 'integer', description: 'Records per page (default: 20, max: 100)' },
          { name: 'sortBy', type: 'string', description: 'Field to sort by (default: created_at)' },
          { name: 'sortOrder', type: 'string', description: 'Sort order: asc or desc (default: desc)' }
        ]
      },
      get: {
        method: 'GET',
        url: `${baseUrl}/api/data/${table.name}/{id}`,
        description: `Get a specific ${table.name} record by ID`
      },
      create: {
        method: 'POST',
        url: `${baseUrl}/api/data/${table.name}`,
        description: `Create a new ${table.name} record`,
        body: {
          type: 'object',
          properties: userColumns.reduce((props: any, col) => {
            props[col.name] = {
              type: getSqlTypeMapping(col.type),
              required: !!col.notnull,
              description: getColumnDescription(col)
            }
            return props
          }, {})
        }
      },
      update: {
        method: 'PUT',
        url: `${baseUrl}/api/data/${table.name}/{id}`,
        description: `Update a ${table.name} record`,
        body: {
          type: 'object',
          properties: userColumns.reduce((props: any, col) => {
            props[col.name] = {
              type: getSqlTypeMapping(col.type),
              required: false,
              description: getColumnDescription(col)
            }
            return props
          }, {})
        }
      },
      delete: {
        method: 'DELETE',
        url: `${baseUrl}/api/data/${table.name}/{id}`,
        description: `Delete a ${table.name} record`
      },
      search: {
        method: 'GET',
        url: `${baseUrl}/api/tables/${table.name}/search`,
        description: `Search ${table.name} records by indexed column values`,
        parameters: [
          { name: 'column', type: 'string', required: true, description: searchableColumns.length > 0 ? `Column to search (${searchableColumns.map(col => `${col.name}:${col.type}`).join(', ')})` : 'Column to search (no indexed columns available)' },
          { name: 'operator', type: 'string', required: true, description: 'Search operator (eq, lt, le, gt, ge, ne, is_null, is_not_null)' },
          { name: 'value', type: 'string', required: false, description: 'Value to search for (required for non-null operators)' },
          { name: 'limit', type: 'integer', required: false, description: 'Maximum number of results' },
          { name: 'offset', type: 'integer', required: false, description: 'Number of records to skip (default: 0)' }
        ]
      }
    },
    searchableColumns: searchableColumns.map(col => ({
      name: col.name,
      type: col.type,
      description: `${col.type} column with database index`,
      supportedOperators: col.type === 'TEXT' 
        ? ['eq', 'is_null', 'is_not_null']
        : ['eq', 'lt', 'le', 'gt', 'ge', 'ne', 'is_null', 'is_not_null']
    })),
    examples: {
      create: generateExampleBody(userColumns),
      update: generateExampleBody(userColumns, true),
      search: {
        textSearch: searchableColumns.find(col => col.type === 'TEXT') 
          ? `${baseUrl}/api/tables/${table.name}/search?column=${searchableColumns.find(col => col.type === 'TEXT')?.name}&operator=eq&value=example`
          : null,
        integerSearch: searchableColumns.find(col => col.type === 'INTEGER')
          ? `${baseUrl}/api/tables/${table.name}/search?column=${searchableColumns.find(col => col.type === 'INTEGER')?.name}&operator=gt&value=100&limit=50`
          : null,
        nullSearch: searchableColumns.length > 0
          ? `${baseUrl}/api/tables/${table.name}/search?column=${searchableColumns[0].name}&operator=is_null`
          : null
      }
    }
  }
}

function getColumnDescription(column: any): string {
  let desc = `${column.type}`
  if (column.notnull) desc += ', required'
  if (column.dflt_value) desc += `, default: ${column.dflt_value}`
  return desc
}

function getSqlTypeMapping(sqlType: string): string {
  const type = sqlType.toUpperCase()
  switch (type) {
    case 'INTEGER': return 'integer'
    case 'REAL': return 'number'
    case 'BOOLEAN': return 'boolean'
    default: return 'string'
  }
}

function generateExampleBody(columns: any[], isUpdate = false): any {
  const example: any = {}
  
  for (const col of columns) {
    const type = col.type.toUpperCase()
    
    // Skip required fields for update examples
    if (isUpdate && col.notnull && !col.dflt_value) continue
    
    switch (type) {
      case 'INTEGER':
        example[col.name] = 123
        break
      case 'REAL':
        example[col.name] = 12.34
        break
      case 'BOOLEAN':
        example[col.name] = true
        break
      case 'TEXT':
        example[col.name] = `example_${col.name}`
        break
      default:
        example[col.name] = `example_${col.name}`
    }
  }
  
  return example
}

// Generate Swagger UI HTML
function generateSwaggerUI(baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Viveforge API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '${baseUrl}/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`
}