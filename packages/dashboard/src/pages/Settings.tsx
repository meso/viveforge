import { AdminsManagement } from '../components/settings/AdminsManagement'
import { APIKeysManagement } from '../components/settings/APIKeysManagement'
import { AppSettings } from '../components/settings/AppSettings'
import { SettingsNavigation } from '../components/settings/SettingsNavigation'
import { useSettings } from '../hooks/useSettings'

export function SettingsPage() {
  const { activeSection, error, setActiveSection, setError } = useSettings()

  const renderContent = () => {
    switch (activeSection) {
      case 'app-settings':
        return <AppSettings onError={setError} />
      case 'admins':
        return <AdminsManagement onError={setError} />
      case 'api-keys':
        return <APIKeysManagement onError={setError} />
      default:
        return <AppSettings onError={setError} />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">
            Manage your application settings, administrators, and API keys
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex justify-between items-center">
              <p className="text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 text-sm underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-6">
          {/* Navigation Sidebar */}
          <SettingsNavigation activeSection={activeSection} onSectionChange={setActiveSection} />

          {/* Content Area */}
          <div className="flex-1">{renderContent()}</div>
        </div>
      </div>
    </div>
  )
}
