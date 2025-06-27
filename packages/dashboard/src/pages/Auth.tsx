import { useEffect, useState } from 'preact/hooks'
import { OAuthProviderCard } from '../components/OAuthProviderCard'
import { api, type OAuthProvider, type SupportedProvider } from '../lib/api'

function CallbackUrlsSection() {
  const [callbackUrls, setCallbackUrls] = useState<string[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCallbackUrls = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/app-settings', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load app settings')
      }

      const data = await response.json()
      // Find callback_urls setting from the settings array
      const callbackUrlsSetting = data.settings.find(
        (s: { key: string; value: string }) => s.key === 'callback_urls'
      )
      setCallbackUrls(callbackUrlsSetting ? JSON.parse(callbackUrlsSetting.value) : [])
    } catch (err) {
      console.error('Failed to load callback URLs:', err)
      setError(err instanceof Error ? err.message : 'Failed to load callback URLs')
    } finally {
      setIsLoading(false)
    }
  }

  const saveCallbackUrls = async (urls: string[]) => {
    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch('/api/app-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          callback_urls: JSON.stringify(urls),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save callback URLs')
      }

      setCallbackUrls(urls)
    } catch (err) {
      console.error('Failed to save callback URLs:', err)
      setError(err instanceof Error ? err.message : 'Failed to save callback URLs')
    } finally {
      setIsSaving(false)
    }
  }

  const addUrl = async () => {
    if (!newUrl.trim()) return

    const updatedUrls = [...callbackUrls, newUrl.trim()]
    await saveCallbackUrls(updatedUrls)
    setNewUrl('')
  }

  const removeUrl = async (index: number) => {
    const updatedUrls = callbackUrls.filter((_, i) => i !== index)
    await saveCallbackUrls(updatedUrls)
  }

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addUrl()
    }
  }

  useEffect(() => {
    loadCallbackUrls()
  }, [])

  if (isLoading) {
    return (
      <div class="flex items-center justify-center py-12">
        <div class="text-gray-500">Loading callback URLs...</div>
      </div>
    )
  }

  return (
    <div>
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-gray-900">Allowed Callback URLs</h3>
        <p class="text-gray-600 mt-2">
          Configure URLs where users can be redirected after OAuth authentication. Supports web URLs
          (https://), mobile deep links (myapp://), and localhost for development.
        </p>
      </div>

      {error && (
        <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p class="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Add new URL */}
      <div class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h4 class="text-md font-medium text-gray-900 mb-4">Add Callback URL</h4>
        <div class="flex gap-3">
          <input
            type="text"
            value={newUrl}
            onInput={(e) => {
              const target = e.target as HTMLInputElement
              setNewUrl(target.value)
            }}
            onKeyPress={handleKeyPress}
            placeholder="https://myapp.com/auth/callback or myapp://auth/callback"
            class="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={addUrl}
            disabled={!newUrl.trim() || isSaving}
            class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Adding...' : 'Add URL'}
          </button>
        </div>
      </div>

      {/* URL List */}
      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <h4 class="text-md font-medium text-gray-900 mb-4">
          Configured URLs ({callbackUrls.length})
        </h4>

        {callbackUrls.length === 0 ? (
          <div class="text-center py-8 text-gray-500">
            <p class="mb-2">No callback URLs configured</p>
            <p class="text-sm">
              When no URLs are configured, any callback URL will be allowed (for backward
              compatibility)
            </p>
          </div>
        ) : (
          <div class="space-y-3">
            {callbackUrls.map((url, index) => (
              <div
                key={`callback-url-${index}-${url}`}
                class="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <div class="flex-1">
                  <code class="text-sm text-gray-800">{url}</code>
                  <div class="text-xs text-gray-500 mt-1">
                    {url.startsWith('https://')
                      ? '🌐 Web App'
                      : url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')
                        ? '🔧 Development'
                        : url.includes('://')
                          ? '📱 Mobile/Desktop App'
                          : '❓ Unknown'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeUrl(index)}
                  disabled={isSaving}
                  class="ml-3 text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 class="text-lg font-semibold text-blue-900 mb-3">URL Format Examples</h4>
        <div class="space-y-2 text-sm text-blue-800">
          <p>
            <strong>Web Applications:</strong> <code>https://myapp.com/auth/callback</code>
          </p>
          <p>
            <strong>Mobile Apps:</strong> <code>myapp://auth/callback</code> or{' '}
            <code>com.example.myapp://callback</code>
          </p>
          <p>
            <strong>Desktop Apps:</strong> <code>myapp://localhost/callback</code>
          </p>
          <p>
            <strong>Development:</strong> <code>http://localhost:3000/callback</code> or{' '}
            <code>http://127.0.0.1:8080/auth</code>
          </p>
        </div>
      </div>

      {/* API Usage */}
      <div class="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 class="text-lg font-semibold text-gray-900 mb-3">API Usage</h4>
        <div class="space-y-2 text-sm font-mono text-gray-700">
          <p>
            <strong>Login with callback:</strong>
          </p>
          <code class="block bg-white p-2 rounded border">
            GET /api/auth/login/google?callback_url=https://myapp.com/auth/callback
          </code>
          <p class="mt-3">
            <strong>The callback response includes:</strong>
          </p>
          <code class="block bg-white p-2 rounded border text-xs">
            {JSON.stringify(
              {
                success: true,
                access_token: '...',
                refresh_token: '...',
                user: { id: '...', email: '...', name: '...' },
                return_url: 'https://myapp.com/auth/callback',
              },
              null,
              2
            )}
          </code>
        </div>
      </div>
    </div>
  )
}

export function AuthPage() {
  const [activeSection, setActiveSection] = useState<'providers' | 'callback-urls'>('providers')
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
        api.getOAuthProviders(),
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
    return configuredProviders.find((p) => p.provider === providerName)
  }

  const enabledCount = configuredProviders.filter((p) => p.is_enabled).length
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
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Authentication</h2>

      <div class="flex gap-6">
        {/* Navigation Sidebar */}
        <div class="w-64 flex-shrink-0">
          <nav class="space-y-1">
            <button
              type="button"
              onClick={() => setActiveSection('providers')}
              class={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeSection === 'providers'
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              OAuth Providers
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('callback-urls')}
              class={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeSection === 'callback-urls'
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Callback URLs
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div class="flex-1 min-w-0">
          {activeSection === 'providers' && (
            <div>
              <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-900">OAuth Providers</h3>
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
                      type="button"
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
              <div class="space-y-6">
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
                  <p>
                    1. <strong>Choose a provider:</strong> Click "Configure" on any OAuth provider
                    you want to enable
                  </p>
                  <p>
                    2. <strong>Create OAuth app:</strong> Follow the setup instructions to create an
                    OAuth application
                  </p>
                  <p>
                    3. <strong>Configure credentials:</strong> Enter your Client ID and Client
                    Secret
                  </p>
                  <p>
                    4. <strong>Enable provider:</strong> Toggle the provider to "Enabled" status
                  </p>
                  <p>
                    5. <strong>Test authentication:</strong> Users can now authenticate with this
                    provider
                  </p>
                </div>
              </div>

              {/* API Endpoints */}
              <div class="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-3">Authentication Endpoints</h3>
                <div class="space-y-2 text-sm font-mono text-gray-700">
                  <div>
                    <strong>Available providers:</strong> <code>GET /api/auth/providers</code>
                  </div>
                  <div>
                    <strong>Start authentication:</strong>{' '}
                    <code>GET /api/auth/login/{'{{provider}}'}</code>
                  </div>
                  <div>
                    <strong>OAuth callback:</strong>{' '}
                    <code>GET /api/auth/callback/{'{{provider}}'}</code>
                  </div>
                  <div>
                    <strong>Get user info:</strong> <code>GET /api/auth/me</code>
                  </div>
                  <div>
                    <strong>Refresh token:</strong> <code>POST /api/auth/refresh</code>
                  </div>
                  <div>
                    <strong>Logout:</strong> <code>POST /api/auth/logout</code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'callback-urls' && <CallbackUrlsSection />}
        </div>
      </div>
    </div>
  )
}
