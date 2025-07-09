/**
 * VAPID keys storage with encryption
 * Handles secure storage and retrieval of VAPID keys in D1 database
 */

import type { D1Database } from '@cloudflare/workers-types'

export interface VapidKeys {
  publicKey: string
  privateKey: string
  subject: string
}

export interface VapidConfig {
  id: number
  public_key: string
  encrypted_private_key: string
  encryption_iv: string
  subject: string
  created_at: string
  updated_at: string
}

// Generate a stable encryption key from deployment domain
async function getDerivedKey(deploymentDomain: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(deploymentDomain.padEnd(32, '0').slice(0, 32)),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('vibebase-vapid-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// Encrypt data with AES-GCM
async function encryptData(
  data: string,
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(data))

  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

// Decrypt data with AES-GCM
async function decryptData(
  encryptedData: string,
  ivString: string,
  key: CryptoKey
): Promise<string> {
  const encrypted = new Uint8Array(
    atob(encryptedData)
      .split('')
      .map((char) => char.charCodeAt(0))
  )

  const iv = new Uint8Array(
    atob(ivString)
      .split('')
      .map((char) => char.charCodeAt(0))
  )

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)

  return new TextDecoder().decode(decrypted)
}

export class VapidStorage {
  constructor(
    private db: D1Database,
    private deploymentDomain: string = 'vibebase.app'
  ) {}

  // Check if VAPID keys are configured
  async isConfigured(): Promise<boolean> {
    const result = await this.db
      .prepare('SELECT COUNT(*) as count FROM vapid_config WHERE id = 1')
      .first()

    return (result?.count as number) > 0
  }

  // Store VAPID keys with encryption
  async store(keys: VapidKeys): Promise<void> {
    const encryptionKey = await getDerivedKey(this.deploymentDomain)
    const { encrypted, iv } = await encryptData(keys.privateKey, encryptionKey)

    await this.db
      .prepare(`
        INSERT OR REPLACE INTO vapid_config 
        (id, public_key, encrypted_private_key, encryption_iv, subject, updated_at)
        VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(keys.publicKey, encrypted, iv, keys.subject)
      .run()
  }

  // Retrieve and decrypt VAPID keys
  async retrieve(): Promise<VapidKeys | null> {
    const config = await this.db
      .prepare('SELECT * FROM vapid_config WHERE id = 1')
      .first<VapidConfig>()

    if (!config) {
      return null
    }

    try {
      const encryptionKey = await getDerivedKey(this.deploymentDomain)
      const privateKey = await decryptData(
        config.encrypted_private_key,
        config.encryption_iv,
        encryptionKey
      )

      return {
        publicKey: config.public_key,
        privateKey,
        subject: config.subject,
      }
    } catch (error) {
      console.error('Failed to decrypt VAPID keys:', error)
      return null
    }
  }

  // Generate new VAPID keys
  async generateKeys(subject?: string): Promise<VapidKeys> {
    // Generate VAPID keys using Web Crypto API
    const keyPair = (await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    )) as CryptoKeyPair

    // Export keys in the format expected by VAPID
    const publicKeyArrayBuffer = (await crypto.subtle.exportKey(
      'raw',
      keyPair.publicKey
    )) as ArrayBuffer
    
    // Export private key as JWK to get the raw 'd' parameter
    const privateKeyJWK = (await crypto.subtle.exportKey(
      'jwk',
      keyPair.privateKey
    )) as JsonWebKey
    
    if (!privateKeyJWK.d) {
      throw new Error('Failed to export private key: d parameter missing')
    }

    // Convert to base64url format (VAPID format)
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyArrayBuffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    // The 'd' parameter is already in base64url format
    const privateKeyBase64 = privateKeyJWK.d

    const vapidSubject = subject || `mailto:admin@${this.deploymentDomain}`

    return {
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64,
      subject: vapidSubject,
    }
  }

  // Initialize VAPID keys (generate and store)
  async initialize(subject?: string): Promise<VapidKeys> {
    const keys = await this.generateKeys(subject)
    await this.store(keys)
    return keys
  }

  // Delete VAPID configuration
  async delete(): Promise<void> {
    await this.db.prepare('DELETE FROM vapid_config WHERE id = 1').run()
  }
}
