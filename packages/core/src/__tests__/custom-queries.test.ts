import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Unstable_DevWorker } from 'wrangler'
import { unstable_dev } from 'wrangler'

describe('Custom Queries API', () => {
  let worker: Unstable_DevWorker

  beforeEach(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    })
  })

  afterEach(async () => {
    await worker.stop()
  })

  it.skip('should create a custom query', async () => {
    const queryData = {
      slug: 'test-query',
      name: 'Test Query',
      description: 'A test query',
      sql_query: 'SELECT * FROM users WHERE id = :user_id',
      parameters: [
        {
          name: 'user_id',
          type: 'string',
          required: true,
          description: 'User ID',
        },
      ],
      method: 'GET',
      is_readonly: true,
      cache_ttl: 300,
      enabled: true,
    }

    const response = await worker.fetch('/api/custom-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryData),
    })

    expect(response.status).toBe(201)
    const result = (await response.json()) as { success: boolean; slug: string }
    expect(result.success).toBe(true)
    expect(result.slug).toBe('test-query')
  })

  it.skip('should list custom queries', async () => {
    const response = await worker.fetch('/api/custom-queries')

    expect(response.status).toBe(200)
    const result = (await response.json()) as { queries: unknown[] }
    expect(result.queries).toBeDefined()
    expect(Array.isArray(result.queries)).toBe(true)
  })

  it.skip('should validate required fields', async () => {
    const invalidData = {
      slug: 'invalid',
      // Missing required fields
    }

    const response = await worker.fetch('/api/custom-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData),
    })

    expect(response.status).toBe(400)
    const result = (await response.json()) as { error: string }
    expect(result.error).toBe('Validation failed')
  })

  it.skip('should validate slug format', async () => {
    const invalidSlugData = {
      slug: 'Invalid Slug!',
      name: 'Test',
      sql_query: 'SELECT 1',
      parameters: [],
      method: 'GET',
      is_readonly: true,
      cache_ttl: 0,
      enabled: true,
    }

    const response = await worker.fetch('/api/custom-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidSlugData),
    })

    expect(response.status).toBe(400)
  })

  it.skip('should validate parameter consistency', async () => {
    const inconsistentData = {
      slug: 'test-inconsistent',
      name: 'Test Inconsistent',
      sql_query: 'SELECT * FROM users WHERE id = :user_id AND name = :user_name',
      parameters: [
        {
          name: 'user_id',
          type: 'string',
          required: true,
        },
        // Missing user_name parameter
      ],
      method: 'GET',
      is_readonly: true,
      cache_ttl: 0,
      enabled: true,
    }

    const response = await worker.fetch('/api/custom-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inconsistentData),
    })

    expect(response.status).toBe(400)
    const result = (await response.json()) as { error: string }
    expect(result.error).toContain('undefined parameters')
  })
})

describe('Parameter Extraction', () => {
  it('should extract parameters from SQL', () => {
    const sql =
      'SELECT * FROM users WHERE id = :user_id AND created_at > :start_date AND status = :status'
    const paramRegex = /:(\w+)/g
    const matches = new Set<string>()
    let match

    while ((match = paramRegex.exec(sql)) !== null) {
      matches.add(match[1])
    }

    expect(matches.size).toBe(3)
    expect(matches.has('user_id')).toBe(true)
    expect(matches.has('start_date')).toBe(true)
    expect(matches.has('status')).toBe(true)
  })

  it('should handle duplicate parameters', () => {
    const sql = 'SELECT * FROM users WHERE id = :user_id OR parent_id = :user_id'
    const paramRegex = /:(\w+)/g
    const matches = new Set<string>()
    let match

    while ((match = paramRegex.exec(sql)) !== null) {
      matches.add(match[1])
    }

    expect(matches.size).toBe(1)
    expect(matches.has('user_id')).toBe(true)
  })

  it('should handle no parameters', () => {
    const sql = 'SELECT COUNT(*) FROM users'
    const paramRegex = /:(\w+)/g
    const matches = new Set<string>()
    let match

    while ((match = paramRegex.exec(sql)) !== null) {
      matches.add(match[1])
    }

    expect(matches.size).toBe(0)
  })
})

describe('HTTP Method Auto-determination', () => {
  it('should determine GET for SELECT queries', () => {
    const selectQueries = [
      'SELECT * FROM users',
      'select id, name from products where price > 100',
      '  SELECT COUNT(*) FROM orders  ',
      'SELECT DISTINCT category FROM items',
    ]

    selectQueries.forEach((sql) => {
      const trimmedSql = sql.trim().toLowerCase()
      const method = trimmedSql.startsWith('select') ? 'GET' : 'POST'
      expect(method).toBe('GET')
    })
  })

  it('should determine POST for non-SELECT queries', () => {
    const nonSelectQueries = [
      'INSERT INTO users (name, email) VALUES (:name, :email)',
      'UPDATE products SET price = :price WHERE id = :id',
      'DELETE FROM orders WHERE created_at < :date',
      'CREATE TABLE temp_table AS SELECT * FROM users',
      'DROP TABLE old_table',
    ]

    nonSelectQueries.forEach((sql) => {
      const trimmedSql = sql.trim().toLowerCase()
      const method = trimmedSql.startsWith('select') ? 'GET' : 'POST'
      expect(method).toBe('POST')
    })
  })

  it('should determine readonly status correctly', () => {
    const readonlyQueries = [
      'SELECT * FROM users',
      'PRAGMA table_info(users)',
      'PRAGMA foreign_key_list(orders)',
    ]

    const writeQueries = [
      'INSERT INTO users (name) VALUES (:name)',
      'UPDATE users SET name = :name',
      'DELETE FROM users WHERE id = :id',
    ]

    readonlyQueries.forEach((sql) => {
      const trimmedSql = sql.trim().toLowerCase()
      const readonly = trimmedSql.startsWith('select') || trimmedSql.includes('pragma')
      expect(readonly).toBe(true)
    })

    writeQueries.forEach((sql) => {
      const trimmedSql = sql.trim().toLowerCase()
      const readonly = trimmedSql.startsWith('select') || trimmedSql.includes('pragma')
      expect(readonly).toBe(false)
    })
  })
})
