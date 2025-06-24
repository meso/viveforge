import type { SettingsSection } from '../../types/settings'

interface SettingsNavigationProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}

export function SettingsNavigation({ activeSection, onSectionChange }: SettingsNavigationProps) {
  const sections = [
    { id: 'app-settings' as const, label: 'App Settings', icon: '⚙️' },
    { id: 'admins' as const, label: 'Admins', icon: '👥' },
    { id: 'api-keys' as const, label: 'API Keys', icon: '🔑' },
  ]

  return (
    <div className="w-64 bg-gray-50 p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Settings</h2>
      <nav className="space-y-2">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionChange(section.id)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeSection === section.id
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <span className="mr-2">{section.icon}</span>
            {section.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
