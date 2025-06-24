/**
 * NotificationRules component
 * Displays and manages notification rules list
 */

import type { NotificationRule } from '../../types/push'

interface NotificationRulesProps {
  rules: NotificationRule[]
  onCreateRule: () => void
  onEditRule: (rule: NotificationRule) => void
  onToggleRule: (rule: NotificationRule) => void
  onDeleteRule: (ruleId: string) => void
}

export function NotificationRules({
  rules,
  onCreateRule,
  onEditRule,
  onToggleRule,
  onDeleteRule,
}: NotificationRulesProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Notification Rules</h3>
        <button
          type="button"
          onClick={onCreateRule}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Create Rule
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {rules.map((rule) => (
            <li key={rule.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <h4 className="text-lg font-medium text-gray-900">{rule.name}</h4>
                    <span
                      className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                  )}
                  <div className="mt-2 text-sm text-gray-500">
                    <span className="bg-gray-100 px-2 py-1 rounded mr-2">{rule.triggerType}</span>
                    {rule.tableName && (
                      <span className="bg-blue-100 px-2 py-1 rounded mr-2">{rule.tableName}</span>
                    )}
                    {rule.eventType && (
                      <span className="bg-purple-100 px-2 py-1 rounded mr-2">{rule.eventType}</span>
                    )}
                    <span className="bg-yellow-100 px-2 py-1 rounded">{rule.recipientType}</span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => onToggleRule(rule)}
                    className={`px-3 py-1 text-sm rounded-md ${
                      rule.enabled
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditRule(rule)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteRule(rule.id)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded-md hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {rules.length === 0 && (
          <output className="text-center py-8 text-gray-500" aria-live="polite">
            No notification rules configured yet
          </output>
        )}
      </div>
    </div>
  )
}
