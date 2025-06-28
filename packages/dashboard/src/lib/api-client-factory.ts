/**
 * Unified API Client Factory
 * Provides standardized API communication with error handling, authentication, and type safety
 */

import { handleAuthenticationError } from './auth-error-handler'

export interface ApiClientConfig {
  baseUrl: string
  defaultHeaders?: Record<string, string>
  timeout?: number
  credentials?: RequestCredentials
  onAuthError?: () => void
  onError?: (error: ApiError) => void
}

export interface ApiError {
  message: string
  status?: number
  code?: string
  details?: unknown
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  success: boolean
  status: number
}

export class ApiClient {
  private config: ApiClientConfig

  constructor(config: ApiClientConfig) {
    this.config = config
  }

  /**
   * Main request method with unified error handling
   */
  async request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.config.baseUrl}${endpoint}`

    const requestOptions: RequestInit = {
      credentials: this.config.credentials,
      ...options,
      headers: {
        ...this.config.defaultHeaders,
        ...options.headers,
      },
    }

    // Add timeout if specified
    const controller = new AbortController()
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    if (this.config.timeout) {
      timeoutId = setTimeout(() => controller.abort(), this.config.timeout)
      requestOptions.signal = controller.signal
    }

    try {
      const response = await fetch(url, requestOptions)

      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      // Handle authentication errors
      if (response.status === 401) {
        const error: ApiError = {
          message: 'Authentication required',
          status: 401,
          code: 'UNAUTHORIZED',
        }

        if (this.config.onAuthError) {
          this.config.onAuthError()
        }

        return {
          success: false,
          error: error.message,
          status: response.status,
        }
      }

      // Parse response
      let data: T | undefined
      let errorMessage: string | undefined

      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        try {
          const jsonData = await response.json()

          if (!response.ok) {
            errorMessage =
              jsonData.error ||
              jsonData.message ||
              `HTTP ${response.status}: ${response.statusText}`
          } else {
            data = jsonData
          }
        } catch (parseError) {
          errorMessage = `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        }
      } else if (!response.ok) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }

      const result: ApiResponse<T> = {
        success: response.ok,
        status: response.status,
        data,
        error: errorMessage,
      }

      // Call error handler if provided
      if (!response.ok && this.config.onError) {
        const error: ApiError = {
          message: errorMessage || 'Unknown error',
          status: response.status,
          details: data,
        }
        this.config.onError(error)
      }

      return result
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      const errorMessage = error instanceof Error ? error.message : 'Network error'
      const apiError: ApiError = {
        message: errorMessage,
        details: error,
      }

      if (this.config.onError) {
        this.config.onError(apiError)
      }

      return {
        success: false,
        error: errorMessage,
        status: 0,
      }
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    const requestOptions: RequestInit = {
      ...options,
      method: 'POST',
    }

    if (data !== undefined) {
      requestOptions.body = JSON.stringify(data)
    }

    return this.request<T>(endpoint, requestOptions)
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    const requestOptions: RequestInit = {
      ...options,
      method: 'PUT',
    }

    if (data !== undefined) {
      requestOptions.body = JSON.stringify(data)
    }

    return this.request<T>(endpoint, requestOptions)
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    const requestOptions: RequestInit = {
      ...options,
      method: 'PATCH',
    }

    if (data !== undefined) {
      requestOptions.body = JSON.stringify(data)
    }

    return this.request<T>(endpoint, requestOptions)
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }
}

/**
 * Factory function to create API client with default configuration
 */
export function createApiClient(config: Partial<ApiClientConfig> = {}): ApiClient {
  const defaultConfig: ApiClientConfig = {
    baseUrl: window.location.origin,
    credentials: 'include',
    defaultHeaders: {
      'Content-Type': 'application/json',
    },
    timeout: 30000,
    onAuthError: () => {
      // Use centralized auth error handler
      handleAuthenticationError()
    },
  }

  return new ApiClient({ ...defaultConfig, ...config })
}

/**
 * Default API client instance
 */
export const defaultApiClient = createApiClient()
