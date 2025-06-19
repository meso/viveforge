import { describe, it, expect } from 'vitest'
import {
  isValidSQLIdentifier,
  escapeSQLIdentifier,
  validateAndEscapeTableName,
  validateAndEscapeColumnName,
  validateNotSystemTable,
  validateSQLDataType,
  validateAndNormalizeSQLDataType
} from '../../lib/sql-utils'

describe('SQL Utils', () => {
  describe('isValidSQLIdentifier', () => {
    it('should accept valid identifiers', () => {
      expect(isValidSQLIdentifier('users')).toBe(true)
      expect(isValidSQLIdentifier('user_data')).toBe(true)
      expect(isValidSQLIdentifier('_private')).toBe(true)
      expect(isValidSQLIdentifier('table123')).toBe(true)
    })

    it('should reject invalid identifiers', () => {
      expect(isValidSQLIdentifier('123table')).toBe(false)
      expect(isValidSQLIdentifier('user-data')).toBe(false)
      expect(isValidSQLIdentifier('user.data')).toBe(false)
      expect(isValidSQLIdentifier('user data')).toBe(false)
      expect(isValidSQLIdentifier('')).toBe(false)
    })

    it('should reject SQL reserved words', () => {
      expect(isValidSQLIdentifier('SELECT')).toBe(false)
      expect(isValidSQLIdentifier('select')).toBe(false)
      expect(isValidSQLIdentifier('TABLE')).toBe(false)
      expect(isValidSQLIdentifier('DROP')).toBe(false)
    })

    it('should reject long identifiers', () => {
      const longName = 'a'.repeat(65)
      expect(isValidSQLIdentifier(longName)).toBe(false)
    })
  })

  describe('escapeSQLIdentifier', () => {
    it('should escape valid identifiers', () => {
      expect(escapeSQLIdentifier('users')).toBe('"users"')
      expect(escapeSQLIdentifier('user_data')).toBe('"user_data"')
    })

    it('should throw on invalid identifiers', () => {
      expect(() => escapeSQLIdentifier('123table')).toThrow('Invalid SQL identifier')
      expect(() => escapeSQLIdentifier('SELECT')).toThrow('Invalid SQL identifier')
    })
  })

  describe('validateNotSystemTable', () => {
    const systemTables = ['admins', 'sessions'] as const

    it('should allow non-system tables', () => {
      expect(() => validateNotSystemTable('users', systemTables)).not.toThrow()
      expect(() => validateNotSystemTable('posts', systemTables)).not.toThrow()
    })

    it('should reject system tables', () => {
      expect(() => validateNotSystemTable('admins', systemTables)).toThrow('Cannot modify system table: admins')
      expect(() => validateNotSystemTable('sessions', systemTables)).toThrow('Cannot modify system table: sessions')
    })
  })

  describe('validateSQLDataType', () => {
    it('should accept valid data types', () => {
      expect(validateSQLDataType('TEXT')).toBe(true)
      expect(validateSQLDataType('INTEGER')).toBe(true)
      expect(validateSQLDataType('REAL')).toBe(true)
      expect(validateSQLDataType('VARCHAR(255)')).toBe(true)
    })

    it('should reject invalid data types', () => {
      expect(validateSQLDataType('INVALID')).toBe(false)
      expect(validateSQLDataType('HACKER_TYPE')).toBe(false)
    })
  })

  describe('SQL Injection Prevention', () => {
    it('should prevent malicious table names', () => {
      expect(() => validateAndEscapeTableName('users; DROP TABLE admins; --')).toThrow()
      expect(() => validateAndEscapeTableName('users" OR 1=1 --')).toThrow()
      expect(() => validateAndEscapeTableName('users\'); DELETE FROM admins; --')).toThrow()
    })

    it('should prevent malicious column names', () => {
      expect(() => validateAndEscapeColumnName('name; DROP TABLE users; --')).toThrow()
      expect(() => validateAndEscapeColumnName('name" OR 1=1 --')).toThrow()
      expect(() => validateAndEscapeColumnName('name\'); UPDATE users SET password = "hacked"; --')).toThrow()
    })

    it('should safely escape legitimate names', () => {
      expect(validateAndEscapeTableName('users')).toBe('"users"')
      expect(validateAndEscapeColumnName('user_name')).toBe('"user_name"')
      expect(validateAndEscapeTableName('my_table_123')).toBe('"my_table_123"')
    })
  })
})