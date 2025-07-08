// Client-side push notification management

interface PushSubscriptionData {
  subscription: {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }
  deviceInfo?: {
    userAgent: string
    platform: string
    browser: string
    version: string
  }
}

interface NotificationPermissionResult {
  granted: boolean
  error?: string
}

export class PushManager {
  private apiBaseUrl: string
  private vapidPublicKey: string | null = null
  private registration: ServiceWorkerRegistration | null = null

  constructor(apiBaseUrl = '/api') {
    this.apiBaseUrl = apiBaseUrl
  }

  // Initialize push notifications
  async initialize(): Promise<boolean> {
    try {
      // Check if service workers are supported
      if (!('serviceWorker' in navigator)) {
        console.warn('Service Workers not supported')
        return false
      }

      // Check if push messaging is supported
      if (!('PushManager' in window)) {
        console.warn('Push messaging not supported')
        return false
      }

      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js')
      console.log('Service Worker registered:', this.registration)

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready

      // Get VAPID public key (ignore errors if not configured)
      await this.fetchVapidPublicKey()

      return true
    } catch (_error) {
      // Silently ignore errors when VAPID is not configured
      return false
    }
  }

  // Request notification permission
  async requestPermission(): Promise<NotificationPermissionResult> {
    try {
      if (!('Notification' in window)) {
        return { granted: false, error: 'Notifications not supported' }
      }

      const permission = await Notification.requestPermission()
      return { granted: permission === 'granted' }
    } catch (error) {
      return {
        granted: false,
        error: error instanceof Error ? error.message : 'Permission request failed',
      }
    }
  }

  // Check current permission status
  getPermissionStatus(): NotificationPermission | null {
    if (!('Notification' in window)) {
      return null
    }
    return Notification.permission
  }

  // Subscribe to push notifications
  async subscribe(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.registration) {
        throw new Error('Service Worker not registered')
      }

      if (!this.vapidPublicKey) {
        throw new Error('VAPID public key not available')
      }

      // Check permission
      const permission = this.getPermissionStatus()
      if (permission !== 'granted') {
        const result = await this.requestPermission()
        if (!result.granted) {
          throw new Error(result.error || 'Permission denied')
        }
      }

      // Subscribe to push manager
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
      })

      // Send subscription to server
      const subscriptionData: PushSubscriptionData = {
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh') || new ArrayBuffer(0)),
            auth: this.arrayBufferToBase64(subscription.getKey('auth') || new ArrayBuffer(0)),
          },
        },
        deviceInfo: this.getDeviceInfo(),
      }

      const response = await fetch(`${this.apiBaseUrl}/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(subscriptionData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Subscription failed')
      }

      console.log('Successfully subscribed to push notifications')
      return { success: true }
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Unsubscribe from push notifications
  async unsubscribe(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.registration) {
        throw new Error('Service Worker not registered')
      }

      const subscription = await this.registration.pushManager.getSubscription()
      if (!subscription) {
        return { success: true } // Already unsubscribed
      }

      // Unsubscribe from push manager
      await subscription.unsubscribe()

      // Notify server
      const response = await fetch(`${this.apiBaseUrl}/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      })

      if (!response.ok) {
        console.warn('Failed to notify server of unsubscription')
      }

      console.log('Successfully unsubscribed from push notifications')
      return { success: true }
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Check if user is currently subscribed
  async isSubscribed(): Promise<boolean> {
    try {
      if (!this.registration) {
        return false
      }

      const subscription = await this.registration.pushManager.getSubscription()
      return subscription !== null
    } catch (error) {
      console.error('Failed to check subscription status:', error)
      return false
    }
  }

  // Get current subscription
  async getSubscription(): Promise<PushSubscription | null> {
    try {
      if (!this.registration) {
        return null
      }

      return await this.registration.pushManager.getSubscription()
    } catch (error) {
      console.error('Failed to get subscription:', error)
      return null
    }
  }

  // Admin-specific methods for testing

  // Admin subscribe (for testing purposes)
  async adminSubscribe(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.registration) {
        throw new Error('Service Worker not registered')
      }

      if (!this.vapidPublicKey) {
        throw new Error('VAPID public key not available')
      }

      // Check permission
      const permission = this.getPermissionStatus()
      if (permission !== 'granted') {
        const result = await this.requestPermission()
        if (!result.granted) {
          throw new Error(result.error || 'Permission denied')
        }
      }

      // Subscribe to push manager
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
      })

      // Send subscription to server (admin endpoint)
      const subscriptionData: PushSubscriptionData = {
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh') || new ArrayBuffer(0)),
            auth: this.arrayBufferToBase64(subscription.getKey('auth') || new ArrayBuffer(0)),
          },
        },
        deviceInfo: this.getDeviceInfo(),
      }

      const response = await fetch(`${this.apiBaseUrl}/push/admin/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(subscriptionData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Admin subscription failed')
      }

      console.log('Successfully subscribed admin to push notifications')
      return { success: true }
    } catch (error) {
      console.error('Failed to subscribe admin to push notifications:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Admin unsubscribe
  async adminUnsubscribe(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.registration) {
        throw new Error('Service Worker not registered')
      }

      const subscription = await this.registration.pushManager.getSubscription()
      if (!subscription) {
        return { success: true } // Already unsubscribed
      }

      // Unsubscribe from push manager
      await subscription.unsubscribe()

      // Notify server (admin endpoint)
      const response = await fetch(`${this.apiBaseUrl}/push/admin/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      })

      if (!response.ok) {
        console.warn('Failed to notify server of admin unsubscription')
      }

      console.log('Successfully unsubscribed admin from push notifications')
      return { success: true }
    } catch (error) {
      console.error('Failed to unsubscribe admin from push notifications:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Send admin test notification
  async sendAdminTestNotification(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/push/admin/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Admin test notification failed')
      }

      return { success: true }
    } catch (error) {
      console.error('Failed to send admin test notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Send a test notification (legacy method, kept for compatibility)
  async sendTestNotification(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/push/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: 'Test Notification',
          body: 'This is a test notification from Vibebase',
          icon: '/favicon.svg',
          tag: 'test-notification',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Test notification failed')
      }

      return { success: true }
    } catch (error) {
      console.error('Failed to send test notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Private methods

  private async fetchVapidPublicKey(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/push/vapid-public-key`)
      if (!response.ok) {
        if (response.status === 500) {
          // VAPID not configured, silently ignore
          this.vapidPublicKey = null
          return
        }
        throw new Error('Failed to fetch VAPID public key')
      }

      const data = await response.json()
      this.vapidPublicKey = data.publicKey
    } catch (_error) {
      // Silently ignore errors when VAPID is not configured
      this.vapidPublicKey = null
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }

  private getDeviceInfo() {
    const navigator = window.navigator
    const userAgent = navigator.userAgent

    let browser = 'Unknown'
    let version = 'Unknown'
    let platform = 'web'

    // Detect browser
    if (userAgent.includes('Chrome')) {
      browser = 'Chrome'
      const match = userAgent.match(/Chrome\/(\d+)/)
      version = match ? match[1] : 'Unknown'
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox'
      const match = userAgent.match(/Firefox\/(\d+)/)
      version = match ? match[1] : 'Unknown'
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari'
      const match = userAgent.match(/Version\/(\d+)/)
      version = match ? match[1] : 'Unknown'
    } else if (userAgent.includes('Edge')) {
      browser = 'Edge'
      const match = userAgent.match(/Edge\/(\d+)/)
      version = match ? match[1] : 'Unknown'
    }

    // Detect platform
    if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
      platform = 'android'
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      platform = 'ios'
    }

    return {
      userAgent,
      browser,
      version,
      platform,
    }
  }
}

// Global instance
export const pushManager = new PushManager()
