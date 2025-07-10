/**
 * Security utility functions for Vibebase
 * Handles secure secret generation and validation
 */

import type { Env } from '../types'

/**
 * Generate a cryptographically secure random JWT secret
 * @param length The length of the secret in bytes (default: 32)
 * @returns A base64-encoded random string
 */
export function generateSecureJWTSecret(length = 32): string {
  // Use crypto.getRandomValues for cryptographically secure randomness
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)

  // Convert to base64 for easy storage
  const base64 = btoa(String.fromCharCode(...array))

  // Make it URL-safe by replacing + and / with - and _
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Validate JWT secret strength
 * @param secret The JWT secret to validate
 * @returns Object with validation result and recommendations
 */
export function validateJWTSecret(secret: string): {
  isValid: boolean
  issues: string[]
  recommendations: string[]
} {
  const issues: string[] = []
  const recommendations: string[] = []

  // Check minimum length (should be at least 256 bits = 32 bytes)
  if (secret.length < 32) {
    issues.push('JWT secret is too short (minimum 32 characters recommended)')
    recommendations.push('Use a longer secret (at least 32 characters)')
  }

  // Check for common weak patterns
  if (secret.includes('secret') || secret.includes('password') || secret.includes('key')) {
    issues.push('JWT secret contains common words that reduce security')
    recommendations.push('Use a randomly generated secret without common words')
  }

  // Check for development/test patterns
  const devPatterns = ['dev', 'test', 'demo', 'example', 'default', 'sample']
  if (devPatterns.some((pattern) => secret.toLowerCase().includes(pattern))) {
    issues.push('JWT secret appears to be a development/test value')
    recommendations.push('Use a production-grade randomly generated secret')
  }

  // Check entropy (basic check for repeated characters)
  const uniqueChars = new Set(secret).size
  if (uniqueChars < secret.length * 0.5) {
    issues.push('JWT secret has low entropy (too many repeated characters)')
    recommendations.push('Use a secret with higher entropy (more random characters)')
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendations,
  }
}

/**
 * Get or generate JWT secret for development environments
 * This function ensures a secure secret is available during development
 * while warning about production security requirements
 *
 * @param envSecret The JWT_SECRET from environment variables
 * @param environment The current environment ('development' | 'production')
 * @returns A valid JWT secret with security warnings if needed
 */
export async function getOrGenerateJWTSecret(
  envSecret: string | undefined,
  environment: string = 'development',
  env?: Env
): Promise<{
  secret: string
  warnings: string[]
  isGenerated: boolean
}> {
  const warnings: string[] = []

  // If secret is provided, validate it
  if (envSecret) {
    const validation = validateJWTSecret(envSecret)

    if (!validation.isValid) {
      warnings.push(`JWT_SECRET validation failed: ${validation.issues.join(', ')}`)
      validation.recommendations.forEach((rec) => warnings.push(`Recommendation: ${rec}`))
    }

    return {
      secret: envSecret,
      warnings,
      isGenerated: false,
    }
  }

  // No secret provided - handle based on environment
  if (environment === 'production') {
    // For production deployments, try to generate or retrieve a persistent secret from KV
    if (!env || !env.SESSIONS) {
      throw new Error(
        'JWT_SECRET environment variable is required in production. ' +
          'Please set a secure JWT secret using: wrangler secret put JWT_SECRET'
      )
    }
    
    const secretKey = 'vibebase-production-jwt-secret'
    
    try {
      // Try to get existing secret from KV
      const existingSecret = await env.SESSIONS.get(secretKey)
      if (existingSecret) {
        console.log('📦 Using existing production JWT secret from KV storage')
        return {
          secret: existingSecret,
          warnings: [
            'Using persistent JWT secret from KV storage for production deployment.',
          ],
          isGenerated: false,
        }
      }
      
      // Generate new secret with random data + timestamp for uniqueness
      const randomData = crypto.randomUUID() + Date.now().toString() + Math.random().toString()
      const hashedSecret = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(randomData))
      const secretBase64 = btoa(String.fromCharCode(...new Uint8Array(hashedSecret)))
      const productionSecret = `vibebase-prod-${secretBase64.slice(0, 32)}-secret-key-v1`
      
      // Store in KV with no expiration
      await env.SESSIONS.put(secretKey, productionSecret)
      
      console.warn(
        '🔑 PRODUCTION: Generated new unique JWT secret and stored in KV storage'
      )
      
      return {
        secret: productionSecret,
        warnings: [
          'Generated new unique JWT secret for production deployment and stored in KV storage.',
          'For better security, consider setting JWT_SECRET environment variable manually.',
        ],
        isGenerated: true,
      }
    } catch (error) {
      console.error('Failed to access KV storage for JWT secret:', error)
      throw new Error(
        'JWT_SECRET environment variable is required in production. ' +
          'Please set a secure JWT secret using: wrangler secret put JWT_SECRET'
      )
    }
  }

  // Development environment - generate a secure temporary secret
  const generatedSecret = generateSecureJWTSecret()

  warnings.push('JWT_SECRET not found - generated temporary secret for development')
  warnings.push('SECURITY WARNING: Set JWT_SECRET environment variable for production')
  warnings.push(`Temporary secret generated: ${generatedSecret.substring(0, 8)}...`)
  warnings.push('To set permanently: wrangler secret put JWT_SECRET')

  return {
    secret: generatedSecret,
    warnings,
    isGenerated: true,
  }
}

/**
 * Log security warnings in a standardized format
 */
export function logSecurityWarnings(warnings: string[], context: string = 'Security'): void {
  if (warnings.length === 0) return

  console.warn(`\n🔐 ${context} Warnings:`)
  warnings.forEach((warning, index) => {
    console.warn(`  ${index + 1}. ${warning}`)
  })
  console.warn('')
}

/**
 * Check if we're running in a secure environment
 */
export function isSecureEnvironment(environment: string): boolean {
  return environment === 'production'
}
