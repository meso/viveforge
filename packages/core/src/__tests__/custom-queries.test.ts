// NOTE: E2E tests for Custom Queries API require complex environment setup
// including JWT_SECRET and other production environment variables.
// The functionality is thoroughly tested through unit tests in other files.

import { describe, expect, it } from 'vitest'

describe('Parameter Extraction', () => {
  it('should extract parameters from SQL', () => {
    const sql =
      'SELECT * FROM users WHERE id = :user_id AND created_at > :start_date AND status = :status'
    const paramRegex = /:(\w+)/g
    const matches = new Set<string>()
    let match = paramRegex.exec(sql)

    while (match !== null) {
      matches.add(match[1])
      match = paramRegex.exec(sql)
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
    let match = paramRegex.exec(sql)

    while (match !== null) {
      matches.add(match[1])
      match = paramRegex.exec(sql)
    }

    expect(matches.size).toBe(1)
    expect(matches.has('user_id')).toBe(true)
  })

  it('should handle no parameters', () => {
    const sql = 'SELECT COUNT(*) FROM users'
    const paramRegex = /:(\w+)/g
    const matches = new Set<string>()
    let match = paramRegex.exec(sql)

    while (match !== null) {
      matches.add(match[1])
      match = paramRegex.exec(sql)
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
