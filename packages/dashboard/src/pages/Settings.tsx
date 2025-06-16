import { useState, useEffect } from 'preact/hooks'
import { api } from '../lib/api'

interface Admin {
  id: string
  github_username: string
  is_root: boolean
  created_at: string
}

export function SettingsPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [adding, setAdding] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; username: string } | null>(null)

  // Load admins
  const loadAdmins = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin')
      
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
        method: 'DELETE'
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

  useEffect(() => {
    loadAdmins()
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