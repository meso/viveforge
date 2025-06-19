import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  generateSecureJWTSecret, 
  validateJWTSecret, 
  getOrGenerateJWTSecret,
  logSecurityWarnings,
  isSecureEnvironment
} from '../../lib/security-utils'

describe('Security Utils', () => {
  describe('generateSecureJWTSecret', () => {
    it('should generate a random secret of default length', () => {
      const secret = generateSecureJWTSecret()
      expect(secret.length).toBeGreaterThanOrEqual(32)
      expect(typeof secret).toBe('string')
    })

    it('should generate different secrets on each call', () => {
      const secret1 = generateSecureJWTSecret()
      const secret2 = generateSecureJWTSecret()
      expect(secret1).not.toBe(secret2)
    })

    it('should generate secrets of custom length', () => {
      const secret = generateSecureJWTSecret(16)
      // Base64 encoded 16 bytes is approximately 22 characters (without padding)
      expect(secret.length).toBeGreaterThanOrEqual(20)
      expect(secret.length).toBeLessThanOrEqual(24)
    })

    it('should generate URL-safe base64 strings', () => {
      const secret = generateSecureJWTSecret()
      // Should not contain +, /, or = characters
      expect(secret).not.toMatch(/[+/=]/)
      // Should only contain URL-safe characters
      expect(secret).toMatch(/^[A-Za-z0-9_-]+$/)
    })
  })

  describe('validateJWTSecret', () => {
    it('should validate a strong secret', () => {
      const strongSecret = generateSecureJWTSecret()
      const result = validateJWTSecret(strongSecret)
      expect(result.isValid).toBe(true)
      expect(result.issues).toHaveLength(0)
      expect(result.recommendations).toHaveLength(0)
    })

    it('should reject secrets that are too short', () => {
      const shortSecret = 'short'
      const result = validateJWTSecret(shortSecret)
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('JWT secret is too short (minimum 32 characters recommended)')
      expect(result.recommendations).toContain('Use a longer secret (at least 32 characters)')
    })

    it('should reject secrets with common words', () => {
      const weakSecret = 'my-secret-password-key-for-testing'
      const result = validateJWTSecret(weakSecret)
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('JWT secret contains common words that reduce security')
    })

    it('should reject development/test secrets', () => {
      const devSecret = 'dev-jwt-secret-key-for-testing-only'
      const result = validateJWTSecret(devSecret)
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('JWT secret appears to be a development/test value')
    })

    it('should reject secrets with low entropy', () => {
      const lowEntropySecret = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      const result = validateJWTSecret(lowEntropySecret)
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('JWT secret has low entropy (too many repeated characters)')
    })
  })

  describe('getOrGenerateJWTSecret', () => {
    it('should return provided secret if valid', () => {
      const validSecret = generateSecureJWTSecret()
      const result = getOrGenerateJWTSecret(validSecret, 'development')
      
      expect(result.secret).toBe(validSecret)
      expect(result.isGenerated).toBe(false)
      expect(result.warnings).toHaveLength(0)
    })

    it('should return provided secret with warnings if invalid', () => {
      const invalidSecret = 'weak'
      const result = getOrGenerateJWTSecret(invalidSecret, 'development')
      
      expect(result.secret).toBe(invalidSecret)
      expect(result.isGenerated).toBe(false)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('JWT_SECRET validation failed')
    })

    it('should throw error in production when no secret provided', () => {
      expect(() => {
        getOrGenerateJWTSecret(undefined, 'production')
      }).toThrow('JWT_SECRET environment variable is required in production')
    })

    it('should generate secret in development when none provided', () => {
      const result = getOrGenerateJWTSecret(undefined, 'development')
      
      expect(result.secret).toBeDefined()
      expect(result.secret.length).toBeGreaterThanOrEqual(32)
      expect(result.isGenerated).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('JWT_SECRET not found - generated temporary secret')
    })

    it('should generate different secrets on multiple calls', () => {
      const result1 = getOrGenerateJWTSecret(undefined, 'development')
      const result2 = getOrGenerateJWTSecret(undefined, 'development')
      
      expect(result1.secret).not.toBe(result2.secret)
    })
  })

  describe('logSecurityWarnings', () => {
    let consoleSpy: any

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleSpy.mockRestore()
    })

    it('should log warnings with default context', () => {
      const warnings = ['Warning 1', 'Warning 2']
      logSecurityWarnings(warnings)
      
      expect(consoleSpy).toHaveBeenCalledWith('\n🔐 Security Warnings:')
      expect(consoleSpy).toHaveBeenCalledWith('  1. Warning 1')
      expect(consoleSpy).toHaveBeenCalledWith('  2. Warning 2')
    })

    it('should log warnings with custom context', () => {
      const warnings = ['Test warning']
      logSecurityWarnings(warnings, 'JWT')
      
      expect(consoleSpy).toHaveBeenCalledWith('\n🔐 JWT Warnings:')
      expect(consoleSpy).toHaveBeenCalledWith('  1. Test warning')
    })

    it('should not log anything for empty warnings', () => {
      logSecurityWarnings([])
      expect(consoleSpy).not.toHaveBeenCalled()
    })
  })

  describe('isSecureEnvironment', () => {
    it('should return true for production environment', () => {
      expect(isSecureEnvironment('production')).toBe(true)
    })

    it('should return false for development environment', () => {
      expect(isSecureEnvironment('development')).toBe(false)
    })

    it('should return false for other environments', () => {
      expect(isSecureEnvironment('staging')).toBe(false)
      expect(isSecureEnvironment('test')).toBe(false)
    })
  })
})