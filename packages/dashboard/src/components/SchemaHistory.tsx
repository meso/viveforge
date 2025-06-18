import { useState, useEffect } from 'preact/hooks'
import { api, type SchemaSnapshot } from '../lib/api'

interface SchemaHistoryProps {
  onClose: () => void
  onRestore?: () => void
}

// Spinner component
function Spinner({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
  return (
    <svg class={`animate-spin ${sizeClasses} text-white`} fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  )
}

export function SchemaHistory({ onClose, onRestore }: SchemaHistoryProps) {
  const [snapshots, setSnapshots] = useState<SchemaSnapshot[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = useState<SchemaSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSnapshot, setNewSnapshot] = useState({ name: '', description: '' })
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId) {
        const target = event.target as Element
        // Don't close if clicking inside the menu or on menu buttons
        if (!target.closest('[data-menu-container]') && !target.closest('[data-menu-button]')) {
          setOpenMenuId(null)
        }
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenuId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await api.getSnapshots()
      setSnapshots(result.snapshots)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSnapshot = async (e: Event) => {
    e.preventDefault()
    try {
      setError(null)
      setIsCreating(true)
      await api.createSnapshot(newSnapshot)
      setShowCreateForm(false)
      setNewSnapshot({ name: '', description: '' })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create snapshot')
    } finally {
      setIsCreating(false)
    }
  }

  const handleRestore = async () => {
    if (!confirmRestore) return
    
    try {
      setError(null)
      setIsRestoring(true)
      await api.restoreSnapshot(confirmRestore)
      setConfirmRestore(null)
      if (onRestore) onRestore()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore')
      setConfirmRestore(null)
    } finally {
      setIsRestoring(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    
    try {
      setError(null)
      setIsDeleting(true)
      await api.deleteSnapshot(confirmDelete)
      setConfirmDelete(null)
      setOpenMenuId(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete snapshot')
      setConfirmDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    // All dates are now in ISO format with timezone info
    const date = new Date(dateString)
    
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short'
    })
  }

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    return 'Just now'
  }


  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div class="px-6 py-4 border-b flex items-center justify-between">
          <h2 class="text-xl font-semibold text-gray-900">Schema Snapshots</h2>
          <button
            onClick={onClose}
            class="text-gray-400 hover:text-gray-600"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>


        {/* Error Display */}
        {error && (
          <div class="mx-6 mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div class="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Time Travel Info Box */}
        <div class="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-blue-800">
                💡 CloudflareのTime Travel機能について
              </h3>
              <p class="mt-1 text-sm text-blue-700">
                Cloudflareの管理画面から、D1データベースを過去の任意の時点（無料プランで7日間、有料プランで30日間）に復元できるTime Travel機能が利用可能です。
                詳しくは
                <a 
                  href="https://developers.cloudflare.com/d1/reference/time-travel/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="font-medium underline hover:no-underline"
                >
                  Cloudflare D1 Time Travelドキュメント
                </a>
                をご確認ください。
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-auto p-6">
          {loading ? (
            <div class="text-center py-8">
              <div class="text-gray-500">Loading...</div>
            </div>
          ) : (
            <div>
              {/* Create Snapshot Button */}
              {!showCreateForm && (
                <div class="mb-6">
                  <button
                    onClick={() => setShowCreateForm(true)}
                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Create Snapshot
                  </button>
                </div>
              )}

              {/* Create Snapshot Form */}
              {showCreateForm && (
                <div class="mb-6 bg-gray-50 rounded-lg p-4">
                  <h3 class="text-sm font-medium text-gray-900 mb-3">Create New Snapshot</h3>
                  <form onSubmit={handleCreateSnapshot}>
                    <div class="space-y-3">
                      <div>
                        <label class="block text-sm font-medium text-gray-700">Name</label>
                        <input
                          type="text"
                          value={newSnapshot.name}
                          onInput={(e) => setNewSnapshot({ ...newSnapshot, name: (e.target as HTMLInputElement).value })}
                          class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder="e.g., Before major refactoring"
                        />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                          value={newSnapshot.description}
                          onInput={(e) => setNewSnapshot({ ...newSnapshot, description: (e.target as HTMLTextAreaElement).value })}
                          class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          rows={2}
                          placeholder="Optional description of current state"
                        />
                      </div>
                      <div class="flex space-x-3">
                        <button
                          type="submit"
                          disabled={isCreating}
                          class={`inline-flex justify-center items-center space-x-2 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                            isCreating 
                              ? 'bg-indigo-400 cursor-not-allowed' 
                              : 'bg-indigo-600 hover:bg-indigo-700'
                          }`}
                        >
                          {isCreating && <Spinner size="sm" />}
                          <span>{isCreating ? 'Creating...' : 'Create'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateForm(false)
                            setNewSnapshot({ name: '', description: '' })
                          }}
                          class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* Snapshots List */}
              <div class="space-y-3">
                {snapshots.length === 0 ? (
                  <div class="text-center py-8 text-gray-500">
                    No snapshots yet. Create your first snapshot to start tracking schema changes.
                  </div>
                ) : (
                  snapshots.map(snapshot => (
                    <div
                      key={snapshot.id}
                      class={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                        selectedSnapshot?.id === snapshot.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedSnapshot(snapshot)}
                    >
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="flex items-center space-x-3">
                            <h4 class="text-sm font-medium text-gray-900">
                              {snapshot.name || `Snapshot v${snapshot.version}`}
                            </h4>
                            <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              snapshot.snapshotType === 'manual' ? 'bg-blue-100 text-blue-800' :
                              snapshot.snapshotType === 'auto' ? 'bg-green-100 text-green-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {snapshot.snapshotType}
                            </span>
                          </div>
                          {snapshot.description && (
                            <p class="mt-1 text-sm text-gray-600">{snapshot.description}</p>
                          )}
                          <div class="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                            <span>Version {snapshot.version}</span>
                            <span>{formatDate(snapshot.createdAt)}</span>
                            <span>{getRelativeTime(snapshot.createdAt)}</span>
                          </div>
                        </div>
                        <div class="ml-4 flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmRestore(snapshot.id)
                            }}
                            class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Restore
                          </button>
                          
                          <div class="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(openMenuId === snapshot.id ? null : snapshot.id)
                              }}
                              data-menu-button="true"
                              class="inline-flex items-center p-1.5 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md"
                            >
                              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                            
                            {/* Dropdown Menu */}
                            {openMenuId === snapshot.id && (
                              <div class="absolute right-0 top-full mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 z-10" data-menu-container="true">
                                <div class="py-1">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setOpenMenuId(null)
                                      setConfirmDelete(snapshot.id)
                                    }}
                                    class="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 focus:outline-none"
                                  >
                                    <div class="flex items-center space-x-2">
                                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      <span>Delete</span>
                                    </div>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Restore Confirmation Modal */}
        {confirmRestore && (
          <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div class="flex items-center mb-4">
                <div class="flex-shrink-0">
                  <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div class="ml-3">
                  <h3 class="text-lg font-medium text-gray-900">Confirm Restore</h3>
                </div>
              </div>
              
              <div class="mb-6">
                <p class="text-sm text-gray-700">
                  This will restore your database schema to the selected snapshot. All current tables and data will be replaced.
                </p>
                <p class="text-sm text-red-600 mt-2 font-medium">
                  This action cannot be undone. Make sure you have a backup of your current data.
                </p>
              </div>
              
              <div class="flex space-x-3">
                <button
                  onClick={handleRestore}
                  disabled={isRestoring}
                  class={`inline-flex justify-center items-center space-x-2 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                    isRestoring 
                      ? 'bg-red-400 cursor-not-allowed' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isRestoring && <Spinner size="sm" />}
                  <span>{isRestoring ? 'Restoring...' : 'Restore'}</span>
                </button>
                <button
                  onClick={() => setConfirmRestore(null)}
                  disabled={isRestoring}
                  class={`inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                    isRestoring 
                      ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
                      : 'text-gray-700 bg-white hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDelete && (
          <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div class="flex items-center mb-4">
                <div class="flex-shrink-0">
                  <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div class="ml-3">
                  <h3 class="text-lg font-medium text-gray-900">Delete Snapshot</h3>
                </div>
              </div>
              
              <div class="mb-6">
                <p class="text-sm text-gray-700">
                  Are you sure you want to delete this snapshot? This action cannot be undone.
                </p>
              </div>
              
              <div class="flex space-x-3">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  class={`inline-flex justify-center items-center space-x-2 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                    isDeleting 
                      ? 'bg-red-400 cursor-not-allowed' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isDeleting && <Spinner size="sm" />}
                  <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  disabled={isDeleting}
                  class={`inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                    isDeleting 
                      ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
                      : 'text-gray-700 bg-white hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}