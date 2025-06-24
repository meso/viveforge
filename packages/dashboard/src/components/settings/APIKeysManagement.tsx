import { useEffect, useState } from 'preact/hooks'
import type { APIKey, CreateAPIKeyRequest, CreateAPIKeyResponse } from '../../types/settings'

interface APIKeysManagementProps {
  onError: (error: string | null) => void
}

export function APIKeysManagement({ onError }: APIKeysManagementProps) {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateKey, setShowCreateKey] = useState(false)
  const [newKeyData, setNewKeyData] = useState<CreateAPIKeyRequest>({
    name: '',
    scopes: [],
    expires_in_days: 30,
  })
  const [createdKey, setCreatedKey] = useState<CreateAPIKeyResponse | null>(null)
  const [availableScopes] = useState([
    'data:read',
    'data:write',
    'data:delete',
    'tables:read',
    'tables:write',
    'tables:delete',
    'storage:read',
    'storage:write',
    'storage:delete',
  ])
  const [revokeConfirm, setRevokeConfirm] = useState<{ id: string; name: string } | null>(null)

  // Load API keys
  const loadApiKeys = async () => {
    try {
      setLoading(true)
      onError(null)

      // First initialize table if needed
      const initResponse = await fetch('/api/api-keys/init', {
        method: 'POST',
        credentials: 'include',
      })

      if (!initResponse.ok) {
        const _initErrorData = await initResponse.json().catch(() => ({}))
        // Continue anyway, table might already exist
      }

      const response = await fetch('/api/api-keys', {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Failed to load API keys: ${response.status} - ${errorData.error || 'Unknown error'}`
        )
      }

      const data = await response.json()
      setApiKeys(data.data || [])
    } catch (err) {
      console.error('Failed to load API keys:', err)
      // Show more detailed error information
      let errorMessage = 'Failed to load API keys'
      if (err instanceof Error) {
        errorMessage = err.message
      }
      if (typeof err === 'object' && err !== null && 'status' in err) {
        errorMessage += ` (Status: ${(err as { status: unknown }).status})`
      }
      onError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Create new API key
  const createApiKey = async (e: Event) => {
    e.preventDefault()

    if (!newKeyData.name.trim() || newKeyData.scopes.length === 0) {
      onError('Name and at least one scope are required')
      return
    }

    try {
      onError(null)

      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newKeyData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = `Failed to create API key: ${response.status} - ${errorData.error || 'Unknown error'}`
        if (errorData.details) {
          throw new Error(`${errorMessage}. Details: ${JSON.stringify(errorData.details)}`)
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      setCreatedKey(result.data)
      setShowCreateKey(false)
      setNewKeyData({
        name: '',
        scopes: [],
        expires_in_days: 30,
      })
      await loadApiKeys()
    } catch (err) {
      console.error('Failed to create API key:', err)
      onError(err instanceof Error ? err.message : 'Failed to create API key')
    }
  }

  // Revoke API key
  const revokeApiKey = async (keyId: string) => {
    try {
      onError(null)

      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to revoke API key')
      }

      setRevokeConfirm(null)
      await loadApiKeys()
    } catch (err) {
      console.error('Failed to revoke API key:', err)
      onError(err instanceof Error ? err.message : 'Failed to revoke API key')
    }
  }

  const toggleScope = (scope: string) => {
    setNewKeyData((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }))
  }

  useEffect(() => {
    loadApiKeys()
  }, [])

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">API Keys</h3>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowCreateKey(true)}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Create API Key
            </button>
          </div>
        </div>

        {/* API Keys List */}
        {loading ? (
          <div className="text-center py-4">
            <p className="text-gray-500">Loading API keys...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {apiKeys.length === 0 ? (
              <p className="text-sm text-gray-500">No API keys found. Create one to get started.</p>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((key) => (
                  <div key={key.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-sm font-medium text-gray-900">{key.name}</h4>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              key.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {key.is_active ? 'Active' : 'Revoked'}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>
                            <span className="font-medium">Key:</span> {key.key_prefix}...
                          </p>
                          <p>
                            <span className="font-medium">Scopes:</span> {key.scopes.join(', ')}
                          </p>
                          <p>
                            <span className="font-medium">Created:</span>{' '}
                            {new Date(key.created_at).toLocaleDateString()}
                          </p>
                          {key.expires_at && (
                            <p>
                              <span className="font-medium">Expires:</span>{' '}
                              {new Date(key.expires_at).toLocaleDateString()}
                            </p>
                          )}
                          {key.last_used_at && (
                            <p>
                              <span className="font-medium">Last used:</span>{' '}
                              {new Date(key.last_used_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      {key.is_active && (
                        <button
                          type="button"
                          onClick={() => setRevokeConfirm({ id: key.id, name: key.name })}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create API Key Modal */}
        {showCreateKey && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Create API Key</h3>

              <form onSubmit={createApiKey} className="space-y-4">
                <div>
                  <label
                    htmlFor="api-key-name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Name
                  </label>
                  <input
                    id="api-key-name"
                    type="text"
                    value={newKeyData.name}
                    onChange={(e) =>
                      setNewKeyData((prev) => ({
                        ...prev,
                        name: (e.target as HTMLInputElement).value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="My API Key"
                    required
                  />
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Scopes</div>
                  <div className="space-y-2">
                    {availableScopes.map((scope) => (
                      <label key={scope} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newKeyData.scopes.includes(scope)}
                          onChange={() => toggleScope(scope)}
                          className="mr-2"
                        />
                        <span className="text-sm">{scope}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="expires-in-days"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Expires in (days)
                  </label>
                  <input
                    id="expires-in-days"
                    type="number"
                    value={newKeyData.expires_in_days || ''}
                    onChange={(e) =>
                      setNewKeyData((prev) => ({
                        ...prev,
                        expires_in_days:
                          parseInt((e.target as HTMLInputElement).value) || undefined,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="30"
                    min="1"
                    max="365"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty for no expiration</p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateKey(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 text-sm font-medium rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
                  >
                    Create Key
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Revoke Confirmation Modal */}
        {revokeConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Revoke API Key</h3>
              <p className="text-gray-700 mb-6">
                Are you sure you want to revoke the API key{' '}
                <span className="font-medium">"{revokeConfirm.name}"</span>? This action cannot be
                undone and will immediately disable the key.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setRevokeConfirm(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 text-sm font-medium rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => revokeApiKey(revokeConfirm.id)}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
                >
                  Revoke Key
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Created Key Display Modal */}
        {createdKey && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">API Key Created</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                <p className="text-sm text-yellow-800 mb-2">
                  <strong>Important:</strong> This is the only time you'll see the full API key.
                  Copy it now and store it securely.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-gray-700">Name</div>
                  <p className="text-sm text-gray-900">{createdKey.name}</p>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">API Key</div>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 px-2 py-1 bg-gray-100 rounded text-sm font-mono break-all">
                      {createdKey.key}
                    </code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(createdKey.key)}
                      className="px-2 py-1 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Scopes</div>
                  <p className="text-sm text-gray-900">{createdKey.scopes.join(', ')}</p>
                </div>
                {createdKey.expires_at && (
                  <div>
                    <div className="text-sm font-medium text-gray-700">Expires</div>
                    <p className="text-sm text-gray-900">
                      {new Date(createdKey.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setCreatedKey(null)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                >
                  I've saved the key
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
