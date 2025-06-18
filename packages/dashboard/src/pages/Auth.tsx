import { useState, useEffect } from 'preact/hooks'
import { api, type OAuthProvider, type SupportedProvider } from '../lib/api'
import { OAuthProviderCard } from '../components/OAuthProviderCard'

export function AuthPage() {
  const [supportedProviders, setSupportedProviders] = useState<SupportedProvider[]>([])
  const [configuredProviders, setConfiguredProviders] = useState<OAuthProvider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [supportedResult, configuredResult] = await Promise.all([
        api.getSupportedProviders(),
        api.getOAuthProviders()
      ])
      
      setSupportedProviders(supportedResult.supported_providers)
      setConfiguredProviders(configuredResult.providers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OAuth providers')
      console.error('Error loading OAuth providers:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const getConfiguredProvider = (providerName: string): OAuthProvider | undefined => {
    return configuredProviders.find(p => p.provider === providerName)
  }

  const enabledCount = configuredProviders.filter(p => p.is_enabled).length
  const configuredCount = configuredProviders.length

  if (isLoading) {
    return (
      <div>
        <h2 class="text-2xl font-bold text-gray-900 mb-6">Authentication</h2>
        <div class="flex items-center justify-center py-12">
          <div class="text-gray-500">Loading OAuth providers...</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900">Authentication</h2>
        <p class="text-gray-600 mt-2">
          Configure OAuth providers to enable user authentication in your applications
        </p>
      </div>

      {error && (
        <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p class="text-sm text-red-600">{error}</p>
          {error.includes('authentication required') ? (
            <div class="mt-3">
              <p class="text-sm text-red-700 mb-2">
                You need to log in as an administrator to manage OAuth settings.
              </p>
              <a
                href="/"
                class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Go to Dashboard
              </a>
            </div>
          ) : (
            <button
              onClick={loadData}
              class="mt-2 text-sm text-red-700 hover:text-red-800 underline"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="text-2xl font-bold text-gray-900">{supportedProviders.length}</div>
          <div class="text-sm text-gray-600">Supported Providers</div>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="text-2xl font-bold text-blue-600">{configuredCount}</div>
          <div class="text-sm text-gray-600">Configured</div>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="text-2xl font-bold text-green-600">{enabledCount}</div>
          <div class="text-sm text-gray-600">Enabled</div>
        </div>
      </div>

      {/* Provider Cards */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {supportedProviders.map((supportedProvider) => (
          <OAuthProviderCard
            key={supportedProvider.provider}
            supportedProvider={supportedProvider}
            configuredProvider={getConfiguredProvider(supportedProvider.provider)}
            onUpdate={loadData}
          />
        ))}
      </div>

      {/* Help Section */}
      <div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-blue-900 mb-3">Getting Started</h3>
        <div class="space-y-2 text-sm text-blue-800">
          <p>1. <strong>Choose a provider:</strong> Click "Configure" on any OAuth provider you want to enable</p>
          <p>2. <strong>Create OAuth app:</strong> Follow the setup instructions to create an OAuth application</p>
          <p>3. <strong>Configure credentials:</strong> Enter your Client ID and Client Secret</p>
          <p>4. <strong>Enable provider:</strong> Toggle the provider to "Enabled" status</p>
          <p>5. <strong>Test authentication:</strong> Users can now authenticate with this provider</p>
        </div>
      </div>

      {/* API Endpoints */}
      <div class="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-3">Authentication Endpoints</h3>
        <div class="space-y-2 text-sm font-mono text-gray-700">
          <div><strong>Available providers:</strong> <code>GET /api/auth/providers</code></div>
          <div><strong>Start authentication:</strong> <code>GET /api/auth/login/{'{{provider}}'}</code></div>
          <div><strong>OAuth callback:</strong> <code>GET /api/auth/callback/{'{{provider}}'}</code></div>
          <div><strong>Get user info:</strong> <code>GET /api/auth/me</code></div>
          <div><strong>Refresh token:</strong> <code>POST /api/auth/refresh</code></div>
          <div><strong>Logout:</strong> <code>POST /api/auth/logout</code></div>
        </div>
      </div>
    </div>
  )
}