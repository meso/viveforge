import { useState } from 'preact/hooks'
import type { OAuthProvider, SupportedProvider } from '../lib/api'
import { api } from '../lib/api'

interface OAuthProviderCardProps {
  supportedProvider: SupportedProvider
  configuredProvider?: OAuthProvider
  onUpdate: () => void
}

export function OAuthProviderCard({ supportedProvider, configuredProvider, onUpdate }: OAuthProviderCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    client_id: configuredProvider?.client_id || '',
    client_secret: configuredProvider?.client_secret || '',
    is_enabled: configuredProvider?.is_enabled || false,
    scopes: configuredProvider?.scopes || supportedProvider.default_scopes,
    redirect_uri: configuredProvider?.redirect_uri || ''
  })
  const [showSecret, setShowSecret] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConfigured = !!configuredProvider
  const isEnabled = configuredProvider?.is_enabled || false

  const handleSave = async () => {
    if (!formData.client_id || !formData.client_secret) {
      setError('Client ID and Client Secret are required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await api.updateOAuthProvider(supportedProvider.provider, formData)
      setIsEditing(false)
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async () => {
    if (!isConfigured) return

    setIsLoading(true)
    setError(null)

    try {
      await api.toggleOAuthProvider(supportedProvider.provider, !isEnabled)
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle provider')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!isConfigured || !confirm(`Are you sure you want to delete the ${supportedProvider.name} OAuth configuration?`)) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await api.deleteOAuthProvider(supportedProvider.provider)
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider')
    } finally {
      setIsLoading(false)
    }
  }

  const getProviderIcon = (provider: string) => {
    const icons = {
      google: '🟦',
      github: '⚫',
      facebook: '🟦',
      linkedin: '🔵',
      twitter: '🟦',
      apple: '⚫',
      microsoft: '🔵',
      discord: '🟣',
      slack: '🟩'
    }
    return icons[provider as keyof typeof icons] || '🔗'
  }

  return (
    <div class="bg-white border border-gray-200 rounded-lg p-6">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <span class="text-2xl">{getProviderIcon(supportedProvider.provider)}</span>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">{supportedProvider.name}</h3>
            <div class="flex items-center gap-2 mt-1">
              <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isConfigured 
                  ? isEnabled 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {isConfigured ? (isEnabled ? 'Enabled' : 'Disabled') : 'Not Configured'}
              </span>
              {supportedProvider.note && (
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {supportedProvider.note}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          {isConfigured && (
            <button
              onClick={handleToggle}
              disabled={isLoading}
              class={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${
                isEnabled
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                  : 'bg-green-100 text-green-800 hover:bg-green-200'
              } disabled:opacity-50`}
            >
              {isEnabled ? 'Disable' : 'Enable'}
            </button>
          )}
          
          <button
            onClick={() => setIsEditing(!isEditing)}
            disabled={isLoading}
            class="px-3 py-1 text-sm rounded-md font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors disabled:opacity-50"
          >
            {isEditing ? 'Cancel' : isConfigured ? 'Edit' : 'Configure'}
          </button>
        </div>
      </div>

      {error && (
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p class="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isEditing ? (
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Client ID
            </label>
            <input
              type="text"
              value={formData.client_id}
              onInput={(e) => setFormData({ ...formData, client_id: (e.target as HTMLInputElement).value })}
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your OAuth Client ID"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Client Secret
            </label>
            <div class="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={formData.client_secret}
                onInput={(e) => setFormData({ ...formData, client_secret: (e.target as HTMLInputElement).value })}
                class="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your OAuth Client Secret"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showSecret ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Redirect URI (optional)
            </label>
            <input
              type="url"
              value={formData.redirect_uri}
              onInput={(e) => setFormData({ ...formData, redirect_uri: (e.target as HTMLInputElement).value })}
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={`${window.location.origin}/api/auth/callback/${supportedProvider.provider}`}
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Scopes
            </label>
            <div class="flex flex-wrap gap-2">
              {formData.scopes.map((scope, index) => (
                <span
                  key={index}
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>

          <div class="flex items-center gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={isLoading}
              class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Configuration'}
            </button>
            
            {isConfigured && (
              <button
                onClick={handleDelete}
                disabled={isLoading}
                class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ) : (
        <div class="space-y-3">
          <div class="text-sm text-gray-600">
            <strong>Setup Instructions:</strong>
            <p class="mt-1">{supportedProvider.setup_instructions}</p>
          </div>
          
          <div class="text-sm text-gray-600">
            <strong>Default Callback URL:</strong>
            <code class="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
              {window.location.origin}/api/auth/callback/{supportedProvider.provider}
            </code>
          </div>

          <div class="text-sm text-gray-600">
            <strong>Default Scopes:</strong>
            <div class="flex flex-wrap gap-1 mt-1">
              {supportedProvider.default_scopes.map((scope, index) => (
                <span
                  key={index}
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>

          {isConfigured && (
            <div class="pt-2 border-t border-gray-100">
              <div class="text-sm text-gray-600">
                <strong>Status:</strong> Configured and {isEnabled ? 'enabled' : 'disabled'}
              </div>
              {configuredProvider && (
                <div class="text-sm text-gray-600 mt-1">
                  <strong>Last updated:</strong> {new Date(configuredProvider.updated_at).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}