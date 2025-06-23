// Push notification service interfaces and implementations

export interface PushSubscription {
  id: string
  userId: string
  provider: 'webpush' | 'fcm'
  endpoint?: string
  p256dh?: string
  auth?: string
  fcmToken?: string
  deviceInfo?: Record<string, any>
  platform?: 'web' | 'ios' | 'android' | 'desktop'
}

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  image?: string
  badge?: string
  tag?: string
  data?: Record<string, any>
  actions?: NotificationAction[]
  requireInteraction?: boolean
  silent?: boolean

  // Platform-specific options
  ios?: {
    sound?: string
    badge?: number
    category?: string
  }
  android?: {
    channelId?: string
    color?: string
    priority?: 'high' | 'normal' | 'low'
  }
}

export interface NotificationAction {
  action: string
  title: string
  icon?: string
}

export interface SendResult {
  success: boolean
  statusCode?: number
  headers?: Record<string, string>
  error?: string
}

// Abstract push service interface
export abstract class PushService {
  abstract send(subscription: PushSubscription, payload: NotificationPayload): Promise<SendResult>
  abstract sendBatch(
    subscriptions: PushSubscription[],
    payload: NotificationPayload
  ): Promise<SendResult[]>
}

// Web Push implementation
export class WebPushService extends PushService {
  private vapidPublicKey: string
  private vapidPrivateKey: string
  private vapidSubject: string

  constructor(vapidPublicKey: string, vapidPrivateKey: string, vapidSubject: string) {
    super()
    this.vapidPublicKey = vapidPublicKey
    this.vapidPrivateKey = vapidPrivateKey
    this.vapidSubject = vapidSubject
  }

  async send(subscription: PushSubscription, payload: NotificationPayload): Promise<SendResult> {
    if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
      return {
        success: false,
        error: 'Invalid subscription: missing endpoint, p256dh, or auth',
      }
    }

    try {
      // Generate JWT for VAPID
      const jwt = await this.generateVAPIDJWT(subscription.endpoint)

      // Prepare the notification payload
      const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
        image: payload.image,
        badge: payload.badge,
        tag: payload.tag,
        data: payload.data,
        actions: payload.actions,
        requireInteraction: payload.requireInteraction,
        silent: payload.silent,
      })

      // Encrypt the payload
      const encryptedPayload = await this.encryptPayload(
        notificationPayload,
        subscription.p256dh,
        subscription.auth
      )

      // Send the push notification
      const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `vapid t=${jwt}, k=${this.vapidPublicKey}`,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          TTL: '86400', // 24 hours
          Urgency: this.getUrgency(payload.android?.priority || 'normal'),
        },
        body: encryptedPayload,
      })

      return {
        success: response.ok,
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async sendBatch(
    subscriptions: PushSubscription[],
    payload: NotificationPayload
  ): Promise<SendResult[]> {
    // Send notifications in parallel with concurrency limit
    const BATCH_SIZE = 100
    const results: SendResult[] = []

    for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
      const batch = subscriptions.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(batch.map((sub) => this.send(sub, payload)))
      results.push(...batchResults)
    }

    return results
  }

  private async generateVAPIDJWT(endpoint: string): Promise<string> {
    try {
      const url = new URL(endpoint)
      const aud = `${url.protocol}//${url.host}`

      const header = {
        typ: 'JWT',
        alg: 'ES256',
      }

      const payload = {
        aud,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
        sub: this.vapidSubject,
      }

      console.log('VAPID JWT generation - endpoint:', endpoint)
      console.log('VAPID private key length:', this.vapidPrivateKey.length)

      // Import the private key using JWK format
      const jwk = this.convertPrivateKeyToJWK(this.vapidPrivateKey)
      console.log('JWK for import:', JSON.stringify(jwk, null, 2))

      const privateKey = await crypto.subtle.importKey(
        'jwk',
        jwk,
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        false,
        ['sign']
      )

      // Create JWT
      const encodedHeader = this.urlBase64Encode(JSON.stringify(header))
      const encodedPayload = this.urlBase64Encode(JSON.stringify(payload))
      const signingInput = `${encodedHeader}.${encodedPayload}`

      const signature = await crypto.subtle.sign(
        {
          name: 'ECDSA',
          hash: 'SHA-256',
        },
        privateKey,
        new TextEncoder().encode(signingInput)
      )

      const encodedSignature = this.urlBase64Encode(signature)

      return `${signingInput}.${encodedSignature}`
    } catch (error) {
      console.error('VAPID JWT generation failed:', error)
      console.error('Private key used:', this.vapidPrivateKey)
      throw new Error(
        `VAPID JWT generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async encryptPayload(
    payload: string,
    p256dh: string,
    auth: string
  ): Promise<ArrayBuffer> {
    // This is a simplified version. In production, use a proper web-push library
    // or implement the full encryption spec: https://tools.ietf.org/html/rfc8291

    const encoder = new TextEncoder()
    const payloadData = encoder.encode(payload)

    // For now, return the payload as-is (not encrypted)
    // TODO: Implement proper payload encryption
    return payloadData.buffer
  }

  private convertPrivateKeyToJWK(privateKey: string): JsonWebKey {
    // For VAPID, we need to convert the base64url private key to JWK format
    // The private key is 32 bytes for P-256 curve
    const keyData = this.urlBase64Decode(privateKey)

    if (keyData.length !== 32) {
      throw new Error(`Invalid private key length: ${keyData.length}, expected 32 bytes`)
    }

    // Convert the public key from the VAPID public key
    const publicKeyData = this.urlBase64Decode(this.vapidPublicKey)

    // Extract x and y coordinates from uncompressed public key (65 bytes)
    if (publicKeyData.length !== 65 || publicKeyData[0] !== 0x04) {
      throw new Error('Invalid public key format')
    }

    const x = this.urlBase64Encode(publicKeyData.slice(1, 33))
    const y = this.urlBase64Encode(publicKeyData.slice(33, 65))

    return {
      kty: 'EC',
      crv: 'P-256',
      d: privateKey,
      x: x,
      y: y,
      key_ops: ['sign'],
    }
  }

  private urlBase64Encode(data: string | ArrayBuffer): string {
    const base64 =
      typeof data === 'string' ? btoa(data) : btoa(String.fromCharCode(...new Uint8Array(data)))

    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  private urlBase64Decode(data: string): Uint8Array {
    const base64 = data
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(data.length + ((4 - (data.length % 4)) % 4), '=')

    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  }

  private getUrgency(priority: 'high' | 'normal' | 'low'): string {
    switch (priority) {
      case 'high':
        return 'high'
      case 'low':
        return 'low'
      default:
        return 'normal'
    }
  }
}

// Factory function to create push service based on provider
export function createPushService(provider: 'webpush' | 'fcm', config: any): PushService {
  switch (provider) {
    case 'webpush':
      return new WebPushService(config.vapidPublicKey, config.vapidPrivateKey, config.vapidSubject)
    case 'fcm':
      // TODO: Implement FCM service
      throw new Error('FCM service not implemented yet')
    default:
      throw new Error(`Unknown push provider: ${provider}`)
  }
}
