import { useEffect, useState } from 'preact/hooks'
import type { Admin } from '../../types/settings'

interface AdminsManagementProps {
  onError: (error: string | null) => void
}

export function AdminsManagement({ onError }: AdminsManagementProps) {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [adding, setAdding] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; username: string } | null>(null)

  // Load admins
  const loadAdmins = async () => {
    try {
      setLoading(true)
      onError(null)
      const response = await fetch('/api/admin', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load admins')
      }

      const data = await response.json()
      setAdmins(data.admins)
    } catch (err) {
      console.error('Failed to load admins:', err)
      onError(err instanceof Error ? err.message : 'Failed to load admins')
    } finally {
      setLoading(false)
    }
  }

  // Add new admin
  const addAdmin = async (e: Event) => {
    e.preventDefault()

    if (!newUsername.trim()) {
      onError('GitHub username is required')
      return
    }

    try {
      setAdding(true)
      onError(null)

      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          github_username: newUsername.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add admin')
      }

      setNewUsername('')
      await loadAdmins()
    } catch (err) {
      console.error('Failed to add admin:', err)
      onError(err instanceof Error ? err.message : 'Failed to add admin')
    } finally {
      setAdding(false)
    }
  }

  // Remove admin
  const removeAdmin = async (adminId: string) => {
    try {
      onError(null)

      const response = await fetch(`/api/admin/${adminId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove admin')
      }

      setRemoveConfirm(null)
      await loadAdmins()
    } catch (err) {
      console.error('Failed to remove admin:', err)
      onError(err instanceof Error ? err.message : 'Failed to remove admin')
    }
  }

  useEffect(() => {
    loadAdmins()
  }, [])

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Admin Management</h3>

        {/* Add Admin Form */}
        <form onSubmit={addAdmin} className="mb-6">
          <div className="flex space-x-3">
            <div className="flex-1">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername((e.target as HTMLInputElement).value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="GitHub username"
                disabled={adding}
              />
            </div>
            <button
              type="submit"
              disabled={adding || !newUsername.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add Admin'}
            </button>
          </div>
        </form>

        {/* Admins List */}
        {loading ? (
          <div className="text-center py-4">
            <p className="text-gray-500">Loading admins...</p>
          </div>
        ) : (
          <div>
            {admins.length === 0 ? (
              <p className="text-sm text-gray-500">No admins found</p>
            ) : (
              <div className="space-y-2">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {admin.github_username}
                          {admin.is_root && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Root Admin
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          Added {new Date(admin.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {!admin.is_root && (
                      <button
                        type="button"
                        onClick={() =>
                          setRemoveConfirm({
                            id: admin.id,
                            username: admin.github_username,
                          })
                        }
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
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

        {/* Remove Confirmation Modal */}
        {removeConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Remove Admin</h3>
              <p className="text-gray-700 mb-6">
                Are you sure you want to remove{' '}
                <span className="font-medium">{removeConfirm.username}</span> as an admin? This
                action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setRemoveConfirm(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 text-sm font-medium rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => removeAdmin(removeConfirm.id)}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
                >
                  Remove Admin
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
