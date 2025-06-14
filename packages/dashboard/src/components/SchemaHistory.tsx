import { useState, useEffect } from 'preact/hooks'
import { api, type SchemaSnapshot, type TimeTravelInfo, type RestorePoint } from '../lib/api'

interface SchemaHistoryProps {
  onClose: () => void
  onRestore?: () => void
}

export function SchemaHistory({ onClose, onRestore }: SchemaHistoryProps) {
  const [activeTab, setActiveTab] = useState<'snapshots' | 'timetravel'>('snapshots')
  const [snapshots, setSnapshots] = useState<SchemaSnapshot[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = useState<SchemaSnapshot | null>(null)
  const [timeTravelInfo, setTimeTravelInfo] = useState<TimeTravelInfo | null>(null)
  const [restorePoints, setRestorePoints] = useState<RestorePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSnapshot, setNewSnapshot] = useState({ name: '', description: '' })
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [confirmRestore, setConfirmRestore] = useState<{ type: 'snapshot' | 'timetravel'; id?: string; timestamp?: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      if (activeTab === 'snapshots') {
        const result = await api.getSnapshots()
        setSnapshots(result.snapshots)
      } else {
        const [info, points] = await Promise.all([
          api.getTimeTravelInfo(),
          api.getRestorePoints()
        ])
        setTimeTravelInfo(info)
        setRestorePoints(points.points)
      }
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
      await api.createSnapshot(newSnapshot)
      setShowCreateForm(false)
      setNewSnapshot({ name: '', description: '' })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create snapshot')
    }
  }

  const handleRestore = async () => {
    if (!confirmRestore) return
    
    try {
      setError(null)
      if (confirmRestore.type === 'snapshot' && confirmRestore.id) {
        await api.restoreSnapshot(confirmRestore.id)
      } else if (confirmRestore.type === 'timetravel' && confirmRestore.timestamp) {
        await api.restoreTimeTravel({ timestamp: confirmRestore.timestamp })
      }
      
      setConfirmRestore(null)
      if (onRestore) onRestore()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore')
      setConfirmRestore(null)
    }
  }

  const formatDate = (dateString: string) => {
    // SQLiteのDATETIME文字列をUTC時刻として解釈
    const utcDate = new Date(dateString + 'Z') // 'Z'を追加してUTCとして解釈
    
    return utcDate.toLocaleString(undefined, {
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
    const date = new Date(dateString + 'Z') // UTC時刻として解釈
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  // Convert UTC datetime string to local datetime-local format for HTML input
  const toLocalDateTimeString = (utcDateString: string) => {
    const date = new Date(utcDateString + 'Z') // Interpret as UTC
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
    return localDate.toISOString().slice(0, 16)
  }

  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div class="px-6 py-4 border-b flex items-center justify-between">
          <h2 class="text-xl font-semibold text-gray-900">Schema History & Recovery</h2>
          <button
            onClick={onClose}
            class="text-gray-400 hover:text-gray-600"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div class="border-b px-6">
          <nav class="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('snapshots')}
              class={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'snapshots'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Snapshots
            </button>
            <button
              onClick={() => setActiveTab('timetravel')}
              class={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'timetravel'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Time Travel
              {timeTravelInfo && (
                <span class={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  timeTravelInfo.plan === 'paid' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {timeTravelInfo.maxDays} days
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Error Display */}
        {error && (
          <div class="mx-6 mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div class="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Content */}
        <div class="flex-1 overflow-auto p-6">
          {loading ? (
            <div class="text-center py-8">
              <div class="text-gray-500">Loading...</div>
            </div>
          ) : activeTab === 'snapshots' ? (
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
                          class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Create
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
                        <div class="ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmRestore({ type: 'snapshot', id: snapshot.id })
                            }}
                            class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            Restore
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* Time Travel Info */}
              {timeTravelInfo && (
                <div class="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div class="flex">
                    <div class="flex-shrink-0">
                      <svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <div class="ml-3">
                      <h3 class="text-sm font-medium text-blue-800">
                        Time Travel - {timeTravelInfo.plan === 'paid' ? 'Paid Plan' : 'Free Plan'}
                      </h3>
                      <div class="mt-2 text-sm text-blue-700">
                        <p>You can restore your database to any point within the last {timeTravelInfo.maxDays} days.</p>
                        {timeTravelInfo.plan === 'free' && (
                          <p class="mt-1">Upgrade to a paid plan to extend history to 30 days.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Date/Time Selector */}
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Select a point in time to restore
                </label>
                <input
                  type="datetime-local"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate((e.target as HTMLInputElement).value)}
                  max={toLocalDateTimeString(new Date().toISOString())}
                  min={timeTravelInfo ? toLocalDateTimeString(timeTravelInfo.earliestAvailable) : undefined}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <p class="mt-1 text-xs text-gray-500">
                  Select any time between {timeTravelInfo && formatDate(timeTravelInfo.earliestAvailable)} and now
                </p>
              </div>

              {/* Quick Restore Points */}
              <div class="mb-6">
                <h3 class="text-sm font-medium text-gray-700 mb-3">Quick Restore Points</h3>
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {restorePoints.slice(0, 8).map((point, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(toLocalDateTimeString(point.timestamp))}
                      class="relative rounded-lg border border-gray-300 bg-white px-4 py-3 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <div class="text-sm font-medium text-gray-900">
                        {point.type === 'hourly' ? `${idx + 1} hour${idx > 0 ? 's' : ''} ago` : `${idx} days ago`}
                      </div>
                      <div class="text-xs text-gray-500 mt-1">
                        {new Date(point.timestamp).toLocaleTimeString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Restore Button */}
              <div class="flex justify-end">
                <button
                  onClick={() => {
                    if (selectedDate) {
                      setConfirmRestore({ type: 'timetravel', timestamp: new Date(selectedDate).toISOString() })
                    }
                  }}
                  disabled={!selectedDate}
                  class={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                    selectedDate
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  Restore to Selected Time
                </button>
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
                  {confirmRestore.type === 'snapshot'
                    ? 'This will restore your database schema to the selected snapshot. All current tables and data will be replaced.'
                    : `This will restore your entire database to ${formatDate(confirmRestore.timestamp || '')}.`}
                </p>
                <p class="text-sm text-red-600 mt-2 font-medium">
                  This action cannot be undone. Make sure you have a backup of your current data.
                </p>
              </div>
              
              <div class="flex space-x-3">
                <button
                  onClick={handleRestore}
                  class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Restore
                </button>
                <button
                  onClick={() => setConfirmRestore(null)}
                  class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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