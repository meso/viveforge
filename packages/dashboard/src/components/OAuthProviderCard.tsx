import { useState } from 'preact/hooks'
import type { OAuthProvider, SupportedProvider } from '../lib/api'
import { api } from '../lib/api'

interface OAuthProviderCardProps {
  supportedProvider: SupportedProvider
  configuredProvider?: OAuthProvider
  onUpdate: () => void
}

export function OAuthProviderCard({
  supportedProvider,
  configuredProvider,
  onUpdate,
}: OAuthProviderCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    client_id: configuredProvider?.client_id || '',
    client_secret: configuredProvider?.client_secret || '',
    is_enabled: configuredProvider?.is_enabled || false,
    scopes: configuredProvider?.scopes || supportedProvider.default_scopes,
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
    if (
      !isConfigured ||
      !confirm(`Are you sure you want to delete the ${supportedProvider.name} OAuth configuration?`)
    ) {
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
    const iconComponents = {
      google: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      ),
      github: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      ),
      facebook: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      linkedin: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      twitter: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      apple: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
        </svg>
      ),
      microsoft: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M0 0h11.377v11.372H0z" fill="#F25022" />
          <path d="M12.623 0H24v11.372H12.623z" fill="#7FBA00" />
          <path d="M0 12.628h11.377V24H0z" fill="#00A4EF" />
          <path d="M12.623 12.628H24V24H12.623z" fill="#FFB900" />
        </svg>
      ),
      discord: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865F2">
          <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0190 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9460 2.4189-2.1568 2.4189Z" />
        </svg>
      ),
      slack: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52z"
            fill="#E01E5A"
          />
          <path
            d="M6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313z"
            fill="#E01E5A"
          />
          <path
            d="M8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834z"
            fill="#36C5F0"
          />
          <path
            d="M8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312z"
            fill="#36C5F0"
          />
          <path
            d="M18.956 8.834a2.528 2.528 0 012.521-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.523 2.521h-2.521V8.834z"
            fill="#2EB67D"
          />
          <path
            d="M17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312z"
            fill="#2EB67D"
          />
          <path
            d="M15.165 18.956a2.528 2.528 0 012.523 2.521A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.523v-2.521h2.52z"
            fill="#ECB22E"
          />
          <path
            d="M15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z"
            fill="#ECB22E"
          />
        </svg>
      ),
    }

    return (
      iconComponents[provider as keyof typeof iconComponents] || (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
      )
    )
  }

  return (
    <div class="bg-white border border-gray-200 rounded-lg p-6">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 flex items-center justify-center">
            {getProviderIcon(supportedProvider.provider)}
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">{supportedProvider.name}</h3>
            <div class="flex items-center gap-2 mt-1">
              <span
                class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isConfigured
                    ? isEnabled
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
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
            <label class="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input
              type="text"
              value={formData.client_id}
              onInput={(e) =>
                setFormData({ ...formData, client_id: (e.target as HTMLInputElement).value })
              }
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your OAuth Client ID"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
            <div class="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={formData.client_secret}
                onInput={(e) =>
                  setFormData({ ...formData, client_secret: (e.target as HTMLInputElement).value })
                }
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
            <label class="block text-sm font-medium text-gray-700 mb-2">Scopes</label>
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
            <strong>OAuth Callback URL for Provider:</strong>
            <br />
            <code class="px-2 py-1 bg-gray-100 rounded text-xs">
              {window.location.origin}/api/auth/callback/{supportedProvider.provider}
            </code>
            <p class="mt-1 text-xs text-gray-500">
              Use this URL when configuring your OAuth application with the provider. After
              authentication, users will be redirected to your app based on the callback URLs you
              configure in your application settings.
            </p>
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
                  <strong>Last updated:</strong>{' '}
                  {new Date(configuredProvider.updated_at).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
