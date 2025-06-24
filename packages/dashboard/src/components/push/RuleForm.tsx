/**
 * RuleForm component
 * Modal form for creating and editing notification rules
 */

import { useState } from 'preact/hooks'
import type { NotificationRule, RuleFormData } from '../../types/push'

interface RuleFormProps {
  editingRule: NotificationRule | null
  loading: boolean
  onSubmit: (formData: RuleFormData) => Promise<void>
  onClose: () => void
  setLoading: (loading: boolean) => void
}

export function RuleForm({ editingRule, loading, onSubmit, onClose, setLoading }: RuleFormProps) {
  const [formData, setFormData] = useState<RuleFormData>({
    name: editingRule?.name || '',
    description: editingRule?.description || '',
    triggerType: editingRule?.triggerType || 'db_change',
    tableName: editingRule?.tableName || '',
    eventType: editingRule?.eventType || 'insert',
    recipientType: editingRule?.recipientType || 'all_users',
    recipientValue: editingRule?.recipientValue || '',
    titleTemplate: editingRule?.titleTemplate || '',
    bodyTemplate: editingRule?.bodyTemplate || '',
    iconUrl: editingRule?.iconUrl || '',
    imageUrl: editingRule?.imageUrl || '',
    clickAction: editingRule?.clickAction || '',
    priority: editingRule?.priority || 'normal',
    ttl: editingRule?.ttl || 86400,
    enabled: editingRule?.enabled ?? true,
  })

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = editingRule ? `/api/push/rules/${editingRule.id}` : '/api/push/rules'
      const method = editingRule ? 'PUT' : 'POST'

      // Clean up data before sending
      const cleanedData = {
        ...formData,
        iconUrl: formData.iconUrl.trim() || undefined,
        imageUrl: formData.imageUrl.trim() || undefined,
        clickAction: formData.clickAction.trim() || undefined,
        description: formData.description.trim() || undefined,
        tableName: formData.triggerType === 'db_change' ? formData.tableName : undefined,
        eventType: formData.triggerType === 'db_change' ? formData.eventType : undefined,
        recipientValue:
          formData.recipientType !== 'all_users' ? formData.recipientValue : undefined,
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(cleanedData),
      })

      if (response.ok) {
        alert(editingRule ? 'Rule updated successfully' : 'Rule created successfully')
        await onSubmit(formData)
      } else {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        if (errorData.details) {
          console.error('Validation errors:', errorData.details)
        }
        alert(
          `Failed to ${editingRule ? 'update' : 'create'} rule: ${errorData.error}${errorData.details ? `\n\nValidation errors: ${JSON.stringify(errorData.details, null, 2)}` : ''}`
        )
      }
    } catch (error) {
      alert(`Error ${editingRule ? 'updating' : 'creating'} rule: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rule-form-title"
    >
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 id="rule-form-title" className="text-lg font-medium text-gray-900 mb-4">
            {editingRule ? 'Edit Notification Rule' : 'Create Notification Rule'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rule-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  id="rule-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: (e.target as HTMLInputElement).value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="rule-description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <input
                  id="rule-description"
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      description: (e.target as HTMLInputElement).value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="rule-trigger-type"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Trigger Type *
                </label>
                <select
                  id="rule-trigger-type"
                  value={formData.triggerType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      triggerType: (e.target as HTMLSelectElement).value as 'db_change' | 'api',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="db_change">Database Change</option>
                  <option value="api">API Trigger</option>
                </select>
              </div>

              {formData.triggerType === 'db_change' && (
                <>
                  <div>
                    <label
                      htmlFor="rule-table-name"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Table Name *
                    </label>
                    <input
                      id="rule-table-name"
                      type="text"
                      required
                      value={formData.tableName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tableName: (e.target as HTMLInputElement).value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="rule-event-type"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Event Type *
                    </label>
                    <select
                      id="rule-event-type"
                      value={formData.eventType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eventType: (e.target as HTMLSelectElement).value as
                            | 'insert'
                            | 'update'
                            | 'delete',
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="insert">Insert</option>
                      <option value="update">Update</option>
                      <option value="delete">Delete</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="rule-recipient-type"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Recipient Type *
                </label>
                <select
                  id="rule-recipient-type"
                  value={formData.recipientType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipientType: (e.target as HTMLSelectElement).value as
                        | 'specific_user'
                        | 'column_reference'
                        | 'all_users',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all_users">All Users</option>
                  <option value="specific_user">Specific User</option>
                  <option value="column_reference">Column Reference</option>
                </select>
              </div>

              {formData.recipientType !== 'all_users' && (
                <div>
                  <label
                    htmlFor="rule-recipient-value"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {formData.recipientType === 'specific_user' ? 'User ID' : 'Column Name'} *
                  </label>
                  <input
                    id="rule-recipient-value"
                    type="text"
                    required
                    value={formData.recipientValue}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        recipientValue: (e.target as HTMLInputElement).value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="rule-title-template"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Title Template *
                </label>
                <input
                  id="rule-title-template"
                  type="text"
                  required
                  value={formData.titleTemplate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      titleTemplate: (e.target as HTMLInputElement).value,
                    })
                  }
                  placeholder="e.g., New message from {{user_name}}"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="rule-body-template"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Body Template *
                </label>
                <input
                  id="rule-body-template"
                  type="text"
                  required
                  value={formData.bodyTemplate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bodyTemplate: (e.target as HTMLInputElement).value,
                    })
                  }
                  placeholder="e.g., {{message}}"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="rule-icon-url"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Icon URL
                </label>
                <input
                  id="rule-icon-url"
                  type="url"
                  value={formData.iconUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, iconUrl: (e.target as HTMLInputElement).value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="rule-image-url"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Image URL
                </label>
                <input
                  id="rule-image-url"
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, imageUrl: (e.target as HTMLInputElement).value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="rule-click-action"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Click Action URL
                </label>
                <input
                  id="rule-click-action"
                  type="text"
                  value={formData.clickAction}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      clickAction: (e.target as HTMLInputElement).value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="rule-priority"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Priority
                </label>
                <select
                  id="rule-priority"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: (e.target as HTMLSelectElement).value as 'high' | 'normal' | 'low',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label htmlFor="rule-ttl" className="block text-sm font-medium text-gray-700 mb-1">
                  TTL (seconds)
                </label>
                <input
                  id="rule-ttl"
                  type="number"
                  value={formData.ttl}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ttl: parseInt((e.target as HTMLInputElement).value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) =>
                  setFormData({ ...formData, enabled: (e.target as HTMLInputElement).checked })
                }
                className="mr-2"
              />
              <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                Enabled
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
