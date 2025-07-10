#!/usr/bin/env node

/**
 * Deploy Button Initialization Script
 * 
 * This script runs during Deploy Button deployment to:
 * 1. Initialize the database schema
 * 2. Generate and set a secure JWT secret
 * 3. Ensure the deployment is production-ready
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'

function log(message) {
  console.log(`🚀 Deploy Button: ${message}`)
}

function error(message) {
  console.error(`❌ Deploy Button: ${message}`)
}

function runCommand(command, description) {
  try {
    log(`${description}...`)
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' })
    if (output.trim()) {
      console.log(output.trim())
    }
    log(`${description} completed`)
  } catch (err) {
    error(`${description} failed: ${err.message}`)
    throw err
  }
}

async function generateSecureSecret(length = 64) {
  // Generate a cryptographically secure random string
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let result = ''
  
  // Use crypto.getRandomValues for secure randomness
  const array = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length]
    }
  } else {
    // Fallback for Node.js environments
    const crypto = await import('crypto')
    const randomBytes = crypto.randomBytes(length)
    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % chars.length]
    }
  }
  
  return result
}

async function main() {
  try {
    log('Starting Deploy Button initialization...')
    
    // Check if this is actually a Deploy Button environment
    if (existsSync('wrangler.local.toml')) {
      log('wrangler.local.toml detected - skipping Deploy Button initialization')
      log('This appears to be a development environment')
      return
    }
    
    // Log current working directory and environment for debugging
    log(`Working directory: ${process.cwd()}`)
    log('Proceeding with Deploy Button initialization for remote Cloudflare environment')
    
    // 1. Initialize database schema
    log('Initializing database schema...')
    runCommand(
      'wrangler d1 execute DB --file=./migrations/consolidated_schema.sql --remote',
      'Database schema initialization'
    )
    
    // 2. Generate and set JWT secret
    log('Generating secure JWT secret...')
    const jwtSecret = await generateSecureSecret(64)
    
    // Set the JWT secret using wrangler
    runCommand(
      `echo "${jwtSecret}" | wrangler secret put JWT_SECRET --remote`,
      'JWT secret configuration'
    )
    
    log('✅ Deploy Button initialization completed successfully!')
    log('Your Vibebase instance is ready for production use')
    
  } catch (error) {
    error('Initialization failed')
    console.error(error)
    process.exit(1)
  }
}

// Run the script
main().catch(console.error)