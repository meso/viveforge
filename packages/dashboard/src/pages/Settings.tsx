import { useState, useEffect } from 'preact/hooks'
import { api } from '../lib/api'

interface Admin {
  id: string
  github_username: string
  is_root: boolean
  created_at: string
}

interface APIKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
}

interface CreateAPIKeyRequest {
  name: string
  scopes: string[]
  expires_in_days?: number
}

interface CreateAPIKeyResponse {
  id: string
  name: string
  key: string
  scopes: string[]
  expires_at: string | null
}

export function SettingsPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [adding, setAdding] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; username: string } | null>(null)

  // API Keys state
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [apiKeysLoading, setApiKeysLoading] = useState(false)
  const [apiKeysError, setApiKeysError] = useState<string | null>(null)
  const [showCreateKey, setShowCreateKey] = useState(false)
  const [newKeyData, setNewKeyData] = useState<CreateAPIKeyRequest>({
    name: '',
    scopes: [],
    expires_in_days: 30
  })
  const [createdKey, setCreatedKey] = useState<CreateAPIKeyResponse | null>(null)
  const [availableScopes] = useState([
    'data:read', 'data:write', 'data:delete',
    'tables:read', 'tables:write', 'tables:delete',
    'storage:read', 'storage:write', 'storage:delete'
  ])
  const [revokeConfirm, setRevokeConfirm] = useState<{ id: string; name: string } | null>(null)

  // Load admins
  const loadAdmins = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin', {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Failed to load admins')
      }
      
      const data = await response.json()
      setAdmins(data.admins)
    } catch (err) {
      console.error('Failed to load admins:', err)
      setError(err instanceof Error ? err.message : 'Failed to load admins')
    } finally {
      setLoading(false)
    }
  }

  // Add new admin
  const addAdmin = async (e: Event) => {
    e.preventDefault()
    
    if (!newUsername.trim()) {
      setError('GitHub username is required')
      return
    }

    try {
      setAdding(true)
      setError(null)
      
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          github_username: newUsername.trim()
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add admin')
      }
      
      setNewUsername('')
      await loadAdmins()
    } catch (err) {
      console.error('Failed to add admin:', err)
      setError(err instanceof Error ? err.message : 'Failed to add admin')
    } finally {
      setAdding(false)
    }
  }

  // Remove admin
  const removeAdmin = async (adminId: string) => {
    try {
      setError(null)
      
      const response = await fetch(`/api/admin/${adminId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove admin')
      }
      
      setRemoveConfirm(null)
      await loadAdmins()
    } catch (err) {
      console.error('Failed to remove admin:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove admin')
    }
  }

  // Load API keys
  const loadApiKeys = async () => {
    try {
      setApiKeysLoading(true)
      setApiKeysError(null)
      
      // First initialize table if needed
      const initResponse = await fetch('/api/api-keys/init', { 
        method: 'POST',
        credentials: 'include'
      })
      
      if (!initResponse.ok) {
        const initErrorData = await initResponse.json().catch(() => ({}))
        // Continue anyway, table might already exist
      }
      
      const response = await fetch('/api/api-keys', {
        credentials: 'include'
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Failed to load API keys: ${response.status} - ${errorData.error || 'Unknown error'}`)
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
        errorMessage += ` (Status: ${(err as any).status})`
      }
      setApiKeysError(errorMessage)
    } finally {
      setApiKeysLoading(false)
    }
  }

  // Create new API key
  const createApiKey = async (e: Event) => {
    e.preventDefault()
    
    if (!newKeyData.name.trim() || newKeyData.scopes.length === 0) {
      setApiKeysError('Name and at least one scope are required')
      return
    }

    try {
      setApiKeysError(null)
      
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(newKeyData)
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
      setNewKeyData({ name: '', scopes: [], expires_in_days: 30 })
      await loadApiKeys()
    } catch (err) {
      console.error('Failed to create API key:', err)
      setApiKeysError(err instanceof Error ? err.message : 'Failed to create API key')
    }
  }

  // Revoke API key
  const revokeApiKey = async (keyId: string) => {
    try {
      setApiKeysError(null)
      
      const response = await fetch(`/api/api-keys/${keyId}/revoke`, {
        method: 'PATCH',
        credentials: 'include'
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = `Failed to revoke API key: ${response.status} - ${errorData.error || 'Unknown error'}`
        if (errorData.details) {
          throw new Error(`${errorMessage}. Details: ${JSON.stringify(errorData.details)}`)
        }
        throw new Error(errorMessage)
      }
      
      setRevokeConfirm(null)
      await loadApiKeys()
    } catch (err) {
      console.error('Failed to revoke API key:', err)
      setApiKeysError(err instanceof Error ? err.message : 'Failed to revoke API key')
    }
  }

  const toggleScope = (scope: string) => {
    setNewKeyData(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope]
    }))
  }

  useEffect(() => {
    loadAdmins()
    loadApiKeys()
  }, [])

  return (
    <div>
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
      
      {/* Admin Management Section */}
      <div class="bg-white shadow rounded-lg mb-6">
        <div class="px-4 py-5 sm:p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Admin Management</h3>
          
          {error && (
            <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p class="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Add Admin Form */}
          <form onSubmit={addAdmin} class="mb-6">
            <div class="flex gap-2">
              <input
                type="text"
                value={newUsername}
                onInput={(e) => setNewUsername((e.target as HTMLInputElement).value)}
                placeholder="GitHub username (e.g., meso)"
                class="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={adding}
              />
              <button
                type="submit"
                disabled={adding || !newUsername.trim()}
                class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Adding...' : 'Add Admin'}
              </button>
            </div>
          </form>

          {/* Admins List */}
          {loading ? (
            <div class="text-center py-4">
              <p class="text-gray-500">Loading admins...</p>
            </div>
          ) : (
            <div class="space-y-2">
              <h4 class="text-sm font-medium text-gray-700 mb-2">Current Admins</h4>
              {admins.length === 0 ? (
                <p class="text-sm text-gray-500">No admins found</p>
              ) : (
                <div class="space-y-2">
                  {admins.map((admin) => (
                    <div key={admin.id} class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div class="flex items-center space-x-3">
                        <div>
                          <p class="text-sm font-medium text-gray-900">
                            {admin.github_username}
                            {admin.is_root && (
                              <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Root Admin
                              </span>
                            )}
                          </p>
                          <p class="text-xs text-gray-500">
                            Added {new Date(admin.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {!admin.is_root && (
                        <button
                          onClick={() => setRemoveConfirm({ id: admin.id, username: admin.github_username })}
                          class="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* API Keys Management Section */}
      <div class="bg-white shadow rounded-lg mb-6">
        <div class="px-4 py-5 sm:p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900">API Keys</h3>
            <div class="flex items-center space-x-2">
              <button
                onClick={() => setShowCreateKey(true)}
                class="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Create API Key
              </button>
            </div>
          </div>
          
          {apiKeysError && (
            <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p class="text-sm text-red-600">{apiKeysError}</p>
            </div>
          )}

          {/* API Keys List */}
          {apiKeysLoading ? (
            <div class="text-center py-4">
              <p class="text-gray-500">Loading API keys...</p>
            </div>
          ) : (
            <div class="space-y-2">
              {apiKeys.length === 0 ? (
                <p class="text-sm text-gray-500">No API keys found. Create one to get started.</p>
              ) : (
                <div class="space-y-3">
                  {apiKeys.map((key) => (
                    <div key={key.id} class="border border-gray-200 rounded-lg p-4">
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="flex items-center space-x-2 mb-2">
                            <h4 class="text-sm font-medium text-gray-900">{key.name}</h4>
                            <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              key.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {key.is_active ? 'Active' : 'Revoked'}
                            </span>
                          </div>
                          <div class="text-sm text-gray-600 space-y-1">
                            <p><span class="font-medium">Key:</span> {key.key_prefix}</p>
                            <p><span class="font-medium">Scopes:</span> {key.scopes.join(', ')}</p>
                            <p><span class="font-medium">Created:</span> {new Date(key.created_at).toLocaleDateString()}</p>
                            {key.expires_at && (
                              <p><span class="font-medium">Expires:</span> {new Date(key.expires_at).toLocaleDateString()}</p>
                            )}
                            {key.last_used_at && (
                              <p><span class="font-medium">Last used:</span> {new Date(key.last_used_at).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                        {key.is_active && (
                          <button
                            onClick={() => setRevokeConfirm({ id: key.id, name: key.name })}
                            class="text-red-600 hover:text-red-800 text-sm font-medium"
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
        </div>
      </div>

      {/* Create API Key Modal */}
      {showCreateKey && (
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div class="mt-3">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Create New API Key</h3>
              <form onSubmit={createApiKey}>
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={newKeyData.name}
                      onInput={(e) => setNewKeyData(prev => ({ ...prev, name: (e.target as HTMLInputElement).value }))}
                      placeholder="My Backend Service"
                      class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                    <div class="space-y-2 max-h-32 overflow-y-auto">
                      {availableScopes.map(scope => (
                        <label key={scope} class="flex items-center">
                          <input
                            type="checkbox"
                            checked={newKeyData.scopes.includes(scope)}
                            onChange={() => toggleScope(scope)}
                            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span class="ml-2 text-sm text-gray-700">{scope}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Expires in (days)</label>
                    <select
                      value={newKeyData.expires_in_days || ''}
                      onChange={(e) => setNewKeyData(prev => ({ 
                        ...prev, 
                        expires_in_days: (e.target as HTMLSelectElement).value ? parseInt((e.target as HTMLSelectElement).value) : undefined 
                      }))}
                      class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="7">7 days</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="365">1 year</option>
                      <option value="">Never</option>
                    </select>
                  </div>
                </div>
                
                <div class="flex space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateKey(false)}
                    class="flex-1 px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    Create Key
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Created Key Display Modal */}
      {createdKey && (
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div class="mt-3">
              <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 class="text-lg font-medium text-gray-900 text-center mb-4">API Key Created</h3>
              <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                <p class="text-sm text-yellow-800 mb-2">
                  <strong>Important:</strong> Save this key securely. It will not be shown again.
                </p>
                <div class="bg-white p-3 rounded border">
                  <code class="text-sm break-all">{createdKey.key}</code>
                </div>
              </div>
              <div class="text-sm text-gray-600 space-y-1 mb-4">
                <p><strong>Name:</strong> {createdKey.name}</p>
                <p><strong>Scopes:</strong> {createdKey.scopes.join(', ')}</p>
                {createdKey.expires_at && (
                  <p><strong>Expires:</strong> {new Date(createdKey.expires_at).toLocaleDateString()}</p>
                )}
              </div>
              <button
                onClick={() => setCreatedKey(null)}
                class="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                I've saved the key safely
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke API Key Confirmation Modal */}
      {revokeConfirm && (
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div class="mt-3 text-center">
              <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 class="text-lg font-medium text-gray-900 mt-2">Revoke API Key</h3>
              <div class="mt-2 px-7 py-3">
                <p class="text-sm text-gray-500">
                  Are you sure you want to revoke the API key "{revokeConfirm.name}"? This action cannot be undone and will immediately disable the key.
                </p>
              </div>
              <div class="items-center px-4 py-3">
                <div class="flex space-x-3">
                  <button
                    onClick={() => setRevokeConfirm(null)}
                    class="flex-1 px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => revokeApiKey(revokeConfirm.id)}
                    class="flex-1 px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removeConfirm && (
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div class="mt-3 text-center">
              <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 class="text-lg font-medium text-gray-900 mt-2">Remove Admin</h3>
              <div class="mt-2 px-7 py-3">
                <p class="text-sm text-gray-500">
                  Are you sure you want to remove admin "{removeConfirm.username}"? This action cannot be undone.
                </p>
              </div>
              <div class="items-center px-4 py-3">
                <div class="flex space-x-3">
                  <button
                    onClick={() => setRemoveConfirm(null)}
                    class="flex-1 px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => removeAdmin(removeConfirm.id)}
                    class="flex-1 px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}