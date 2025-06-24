/**
 * Basic API client functions
 * Handles general API operations like health checks, items, and OAuth provider management
 */

import type { Item, OAuthProvider, SupportedProvider } from '../types/api'
import { createApiClient } from './api-client-factory'

// Create API client instance
const client = createApiClient()

export const apiClient = {
  // Health check
  async health() {
    const response = await client.get('/api/health')
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch health status')
    }
    return response.data
  },

  // Items
  async getItems(): Promise<{ items: Item[]; total: number; page: number; pageSize: number }> {
    const response = await client.get<{
      items: Item[]
      total: number
      page: number
      pageSize: number
    }>('/api/items')
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch items')
    }
    return response.data as NonNullable<typeof response.data>
  },

  async createItem(data: { name: string; description?: string }): Promise<Item> {
    const response = await client.post<Item>('/api/items', data)
    if (!response.success) {
      throw new Error(response.error || 'Failed to create item')
    }
    return response.data as NonNullable<typeof response.data>
  },

  async updateItem(id: string, data: { name?: string; description?: string }): Promise<Item> {
    const response = await client.put<Item>(`/api/items/${id}`, data)
    if (!response.success) {
      throw new Error(response.error || 'Failed to update item')
    }
    return response.data as NonNullable<typeof response.data>
  },

  async deleteItem(id: string): Promise<{ success: boolean; id: string }> {
    const response = await client.delete<{ success: boolean; id: string }>(`/api/items/${id}`)
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete item')
    }
    return response.data as NonNullable<typeof response.data>
  },

  // OAuth Provider management
  async getOAuthProviders(): Promise<{ providers: OAuthProvider[] }> {
    const response = await client.get<{ providers: OAuthProvider[] }>('/api/admin/oauth/providers')
    if (!response.success) {
      let errorMessage = response.error || 'Failed to fetch OAuth providers'
      if (response.status === 401) {
        errorMessage = 'Admin authentication required. Please log in to access OAuth settings.'
      }
      throw new Error(errorMessage)
    }
    return response.data as NonNullable<typeof response.data>
  },

  async getOAuthProvider(provider: string): Promise<{ provider: OAuthProvider }> {
    const response = await client.get<{ provider: OAuthProvider }>(
      `/api/admin/oauth/providers/${provider}`
    )
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch OAuth provider')
    }
    return response.data as NonNullable<typeof response.data>
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
    const response = await client.put<{
      success: boolean
      message: string
      provider: OAuthProvider
    }>(`/api/admin/oauth/providers/${provider}`, data)
    if (!response.success) {
      throw new Error(response.error || 'Failed to update OAuth provider')
    }
    return response.data as NonNullable<typeof response.data>
  },

  async toggleOAuthProvider(
    provider: string,
    enabled: boolean
  ): Promise<{ success: boolean; message: string }> {
    const response = await client.patch<{ success: boolean; message: string }>(
      `/api/admin/oauth/providers/${provider}/toggle`,
      { is_enabled: enabled }
    )
    if (!response.success) {
      throw new Error(response.error || 'Failed to toggle OAuth provider')
    }
    return response.data as NonNullable<typeof response.data>
  },

  async deleteOAuthProvider(provider: string): Promise<{ success: boolean; message: string }> {
    const response = await client.delete<{ success: boolean; message: string }>(
      `/api/admin/oauth/providers/${provider}`
    )
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete OAuth provider')
    }
    return response.data as NonNullable<typeof response.data>
  },

  async getSupportedProviders(): Promise<{ supported_providers: SupportedProvider[] }> {
    const response = await client.get<{ supported_providers: SupportedProvider[] }>(
      '/api/admin/oauth/supported-providers'
    )
    if (!response.success) {
      let errorMessage = response.error || 'Failed to fetch supported providers'
      if (response.status === 401) {
        errorMessage = 'Admin authentication required. Please log in to access OAuth settings.'
      }
      throw new Error(errorMessage)
    }
    return response.data as NonNullable<typeof response.data>
  },
}
