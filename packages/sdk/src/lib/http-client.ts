/**
 * HTTP Client for Vibebase API
 */
import { fetch } from 'cross-fetch'
import type { ApiResponse, AuthConfig } from '../types'

export interface HttpClientConfig {
  baseUrl: string
  timeout?: number
  retries?: number
  auth?: AuthConfig
}

export class HttpClient {
  public readonly config: HttpClientConfig

  constructor(config: HttpClientConfig) {
    this.config = config
  }

  /**
   * Make HTTP request with automatic retries and error handling
   */
  async request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`

    const headers = this.buildHeaders(options.headers)

    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal: this.createTimeoutSignal(),
    }

    let lastError: Error | null = null
    const maxRetries = this.config.retries ?? 3

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, requestOptions)
        const result = await this.handleResponse<T>(response)
        return result
      } catch (error) {
        console.error(`Request attempt ${attempt + 1} failed:`, error)
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('4')) {
          break
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await this.delay(2 ** attempt * 1000)
        }
      }
    }

    // All retries failed
    return {
      success: false,
      error: lastError?.message || 'Request failed',
      status: 0,
    }
  }

  /**
   * GET request
   */
  async get<T = unknown>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint
    return this.request<T>(url, { method: 'GET' })
  }

  /**
   * POST request
   */
  async post<T = unknown>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
    })
  }

  /**
   * PUT request
   */
  async put<T = unknown>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
    })
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
    })
  }

  /**
   * Update authentication config
   */
  setAuth(auth: AuthConfig): void {
    this.config.auth = auth
  }

  /**
   * Build request headers
   */
  private buildHeaders(customHeaders?: HeadersInit): Headers {
    const headers = new Headers()

    // Set default User-Agent
    headers.set('User-Agent', 'vibebase-sdk/0.1.0')

    // Add custom headers
    if (customHeaders) {
      const customHeadersObj =
        customHeaders instanceof Headers
          ? Object.fromEntries(customHeaders.entries())
          : (customHeaders as Record<string, string>)

      Object.entries(customHeadersObj).forEach(([key, value]) => {
        if (value === '') {
          // Remove header if value is empty string
          headers.delete(key)
        } else {
          headers.set(key, value)
        }
      })
    }

    // Add authentication
    if (this.config.auth?.apiKey) {
      headers.set('Authorization', `Bearer ${this.config.auth.apiKey}`)
    } else if (this.config.auth?.userToken) {
      headers.set('Authorization', `Bearer ${this.config.auth.userToken}`)
    }

    return headers
  }

  /**
   * Handle HTTP response
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    let data: T | undefined
    let error: string | undefined

    // Try to parse JSON response
    try {
      const text = await response.text()
      if (text) {
        const parsed = JSON.parse(text)
        if (response.ok) {
          // Check if the response already has the ApiResponse structure
          if (parsed && typeof parsed === 'object' && 'success' in parsed && 'data' in parsed) {
            // Storage API and other endpoints that return { success: true, data: {...} }
            data = parsed.data
          } else {
            // Regular endpoints that return data directly
            data = parsed
          }
        } else {
          // Error response handling
          if (parsed && typeof parsed === 'object' && 'error' in parsed) {
            error =
              typeof parsed.error === 'object'
                ? parsed.error.message || JSON.stringify(parsed.error)
                : parsed.error
          } else {
            error = parsed.message || `HTTP ${response.status}`
          }
        }
      }
    } catch {
      if (!response.ok) {
        error = `HTTP ${response.status}: ${response.statusText}`
      }
    }

    return {
      success: response.ok,
      data,
      error,
      status: response.status,
    }
  }

  /**
   * Create timeout signal
   */
  private createTimeoutSignal(): AbortSignal | undefined {
    if (!this.config.timeout) return undefined

    const controller = new AbortController()
    setTimeout(() => controller.abort(), this.config.timeout)
    return controller.signal
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
