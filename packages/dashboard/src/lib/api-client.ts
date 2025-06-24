/**
 * Basic API client functions
 * Handles general API operations like health checks, items, and OAuth provider management
 */

import type { Item, OAuthProvider, SupportedProvider } from '../types/api'
import { fetchWithAuth } from './auth-client'

const API_BASE = window.location.origin

export const apiClient = {
  // Health check
  async health() {
    const response = await fetchWithAuth(`${API_BASE}/api/health`)
    return response.json()
  },

  // Items
  async getItems(): Promise<{ items: Item[]; total: number; page: number; pageSize: number }> {
    const response = await fetchWithAuth(`${API_BASE}/api/items`)
    if (!response.ok) {
      throw new Error('Failed to fetch items')
    }
    return response.json()
  },

  async createItem(data: { name: string; description?: string }): Promise<Item> {
    const response = await fetchWithAuth(`${API_BASE}/api/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to create item')
    }
    return response.json()
  },

  async updateItem(id: string, data: { name?: string; description?: string }): Promise<Item> {
    const response = await fetchWithAuth(`${API_BASE}/api/items/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to update item')
    }
    return response.json()
  },

  async deleteItem(id: string): Promise<{ success: boolean; id: string }> {
    const response = await fetchWithAuth(`${API_BASE}/api/items/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to delete item')
    }
    return response.json()
  },

  // OAuth Provider management
  async getOAuthProviders(): Promise<{ providers: OAuthProvider[] }> {
    const response = await fetchWithAuth(`${API_BASE}/api/admin/oauth/providers`)
    if (!response.ok) {
      let errorMessage = 'Failed to fetch OAuth providers'
      try {
        const error = await response.json()
        if (error.error === 'Authentication required') {
          errorMessage = 'Admin authentication required. Please log in to access OAuth settings.'
        } else {
          errorMessage = error.error || errorMessage
        }
      } catch {
        // If JSON parsing fails, use default message
      }
      throw new Error(errorMessage)
    }
    return response.json()
  },

  async getOAuthProvider(provider: string): Promise<{ provider: OAuthProvider }> {
    const response = await fetchWithAuth(`${API_BASE}/api/admin/oauth/providers/${provider}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch OAuth provider')
    }
    return response.json()
  },

  async updateOAuthProvider(
    provider: string,
    data: {
      client_id: string
      client_secret: string
      is_enabled?: boolean
      scopes?: string[]
      redirect_uri?: string
    }
  ): Promise<{ success: boolean; message: string; provider: OAuthProvider }> {
    const response = await fetchWithAuth(`${API_BASE}/api/admin/oauth/providers/${provider}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update OAuth provider')
    }
    return response.json()
  },

  async toggleOAuthProvider(
    provider: string,
    enabled: boolean
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetchWithAuth(
      `${API_BASE}/api/admin/oauth/providers/${provider}/toggle`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_enabled: enabled }),
      }
    )
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to toggle OAuth provider')
    }
    return response.json()
  },

  async deleteOAuthProvider(provider: string): Promise<{ success: boolean; message: string }> {
    const response = await fetchWithAuth(`${API_BASE}/api/admin/oauth/providers/${provider}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete OAuth provider')
    }
    return response.json()
  },

  async getSupportedProviders(): Promise<{ supported_providers: SupportedProvider[] }> {
    const response = await fetchWithAuth(`${API_BASE}/api/admin/oauth/supported-providers`)
    if (!response.ok) {
      let errorMessage = 'Failed to fetch supported providers'
      try {
        const error = await response.json()
        if (error.error === 'Authentication required') {
          errorMessage = 'Admin authentication required. Please log in to access OAuth settings.'
        } else {
          errorMessage = error.error || errorMessage
        }
      } catch {
        // If JSON parsing fails, use default message
      }
      throw new Error(errorMessage)
    }
    return response.json()
  },
}
