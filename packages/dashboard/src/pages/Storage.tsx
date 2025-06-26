import { useEffect, useState } from 'preact/hooks'
import { formatDateTime } from '../utils/database'

interface StorageObject {
  key: string
  size: number
  uploaded: string
  contentType?: string
  customMetadata?: Record<string, string>
}

interface StorageListResponse {
  objects: StorageObject[]
  truncated: boolean
  cursor?: string
  delimitedPrefixes: string[]
}

export function StoragePage() {
  const [objects, setObjects] = useState<StorageObject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadObjects()
  }, [])

  const loadObjects = async (prefix?: string, cursor?: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (prefix) params.set('prefix', prefix)
      if (cursor) params.set('cursor', cursor)

      const response = await fetch(`/api/storage?${params}`)
      if (!response.ok) throw new Error('Failed to load files')

      const data: StorageListResponse = await response.json()
      setObjects(cursor ? [...objects, ...data.objects] : data.objects)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const files = input.files
    if (!files?.length) return

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/storage/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) throw new Error(`Failed to upload ${file.name}`)
      }

      await loadObjects()
      input.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete ${key}?`)) return

    try {
      const response = await fetch(`/api/storage/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete file')

      setObjects(objects.filter((obj) => obj.key !== key))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return
    if (!confirm(`Delete ${selectedFiles.size} files?`)) return

    try {
      const response = await fetch('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: Array.from(selectedFiles) }),
      })

      if (!response.ok) throw new Error('Failed to delete files')

      setObjects(objects.filter((obj) => !selectedFiles.has(obj.key)))
      setSelectedFiles(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk delete failed')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
  }

  const toggleFileSelection = (key: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedFiles(newSelected)
  }

  if (loading && objects.length === 0) {
    return (
      <div class="flex items-center justify-center h-64">
        <div class="text-gray-500">Loading files...</div>
      </div>
    )
  }

  return (
    <div>
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-gray-900">Storage</h2>
        <div class="flex gap-2">
          {selectedFiles.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete Selected ({selectedFiles.size})
            </button>
          )}
          <label class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
            {uploading ? 'Uploading...' : 'Upload Files'}
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              disabled={uploading}
              class="hidden"
            />
          </label>
        </div>
      </div>

      {error && (
        <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p class="text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            class="mt-2 text-sm text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      <div class="bg-white shadow rounded-lg overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="w-12 px-6 py-3">
                <input
                  type="checkbox"
                  checked={selectedFiles.size === objects.length && objects.length > 0}
                  onChange={(e) => {
                    const target = e.target as HTMLInputElement
                    if (target.checked) {
                      setSelectedFiles(new Set(objects.map((obj) => obj.key)))
                    } else {
                      setSelectedFiles(new Set())
                    }
                  }}
                />
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Uploaded
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {objects.length === 0 ? (
              <tr>
                <td colSpan={6} class="px-6 py-4 text-center text-gray-500">
                  No files uploaded yet
                </td>
              </tr>
            ) : (
              objects.map((obj) => (
                <tr key={obj.key} class="hover:bg-gray-50">
                  <td class="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(obj.key)}
                      onChange={() => toggleFileSelection(obj.key)}
                    />
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">{obj.key}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">{formatFileSize(obj.size)}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">{obj.contentType || 'Unknown'}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">{formatDateTime(obj.uploaded)}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <a
                      href={`/api/storage/download/${encodeURIComponent(obj.key)}`}
                      class="text-blue-600 hover:text-blue-900 mr-4"
                      download
                    >
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(obj.key)}
                      class="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
