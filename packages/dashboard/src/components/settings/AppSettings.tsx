import { useEffect, useState } from 'preact/hooks'
import type { AppSetting } from '../../types/settings'

interface AppSettingsProps {
  onError: (error: string | null) => void
}

export function AppSettings({ onError }: AppSettingsProps) {
  const [appSettings, setAppSettings] = useState<AppSetting[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Load app settings
  const loadAppSettings = async () => {
    try {
      setLoading(true)
      onError(null)
      const response = await fetch('/api/app-settings', {
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok || data.success === false) {
        const errorMessage = data.error
          ? typeof data.error === 'object'
            ? data.error.message || JSON.stringify(data.error)
            : data.error
          : 'Failed to load app settings'
        throw new Error(errorMessage)
      }

      // Handle both old and new response formats
      const settings = data.success
        ? data.data?.settings || data.data || data.settings
        : data.settings
      setAppSettings(settings)

      // Initialize form data
      const formData: Record<string, string> = {}
      settings.forEach((setting: AppSetting) => {
        formData[setting.key] = setting.value
      })
      setForm(formData)
    } catch (err) {
      console.error('Failed to load app settings:', err)
      onError(err instanceof Error ? err.message : 'Failed to load app settings')
    } finally {
      setLoading(false)
    }
  }

  // Save app settings
  const saveAppSettings = async () => {
    try {
      setSaving(true)
      onError(null)

      // Don't send oauth_user_agent - let the backend auto-generate it
      const { oauth_user_agent: _oauth_user_agent, ...formWithoutUserAgent } = form

      const response = await fetch('/api/app-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formWithoutUserAgent),
      })

      const data = await response.json()

      if (!response.ok || data.success === false) {
        const errorMessage = data.error
          ? typeof data.error === 'object'
            ? data.error.message || JSON.stringify(data.error)
            : data.error
          : 'Failed to save app settings'
        throw new Error(errorMessage)
      }

      setEditing(false)
      await loadAppSettings()
    } catch (err) {
      console.error('Failed to save app settings:', err)
      onError(err instanceof Error ? err.message : 'Failed to save app settings')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    // Reset form data
    const formData: Record<string, string> = {}
    appSettings.forEach((setting) => {
      formData[setting.key] = setting.value
    })
    setForm(formData)
  }

  useEffect(() => {
    loadAppSettings()
  }, [])

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Application Settings</h3>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Edit Settings
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-gray-500">Loading app settings...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="app-name" className="block text-sm font-medium text-gray-700 mb-1">
                Application Name
              </label>
              <input
                id="app-name"
                type="text"
                value={form.app_name || ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    app_name: (e.target as HTMLInputElement).value,
                  }))
                }
                disabled={!editing}
                className={`w-full px-3 py-2 border ${
                  editing ? 'border-gray-300' : 'border-gray-200 bg-gray-50'
                } rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                placeholder="My Vibebase App"
              />
              <p className="mt-1 text-sm text-gray-500">Used as User-Agent for OAuth providers</p>
            </div>

            <div>
              <label htmlFor="app-url" className="block text-sm font-medium text-gray-700 mb-1">
                Application URL (optional)
              </label>
              <input
                id="app-url"
                type="url"
                value={form.app_url || ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    app_url: (e.target as HTMLInputElement).value,
                  }))
                }
                disabled={!editing}
                className={`w-full px-3 py-2 border ${
                  editing ? 'border-gray-300' : 'border-gray-200 bg-gray-50'
                } rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                placeholder="https://myapp.com"
              />
            </div>

            <div>
              <label
                htmlFor="support-email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Support Email (optional)
              </label>
              <input
                id="support-email"
                type="email"
                value={form.support_email || ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    support_email: (e.target as HTMLInputElement).value,
                  }))
                }
                disabled={!editing}
                className={`w-full px-3 py-2 border ${
                  editing ? 'border-gray-300' : 'border-gray-200 bg-gray-50'
                } rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                placeholder="support@myapp.com"
              />
            </div>

            {editing && (
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-700 bg-gray-100 text-sm font-medium rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveAppSettings}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
