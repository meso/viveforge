import { useEffect, useState } from 'preact/hooks'
import { pushManager } from '../lib/push-manager'

interface NotificationRule {
  id: string
  name: string
  description?: string
  triggerType: 'db_change' | 'api'
  tableName?: string
  eventType?: 'insert' | 'update' | 'delete'
  recipientType: 'specific_user' | 'column_reference' | 'all_users'
  recipientValue?: string
  titleTemplate: string
  bodyTemplate: string
  iconUrl?: string
  imageUrl?: string
  clickAction?: string
  priority: 'high' | 'normal' | 'low'
  ttl: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

interface NotificationLog {
  id: string
  ruleId?: string
  userId: string
  provider: string
  title: string
  body: string
  status: 'sent' | 'failed' | 'pending'
  errorMessage?: string
  sentAt?: string
  createdAt: string
}

export default function PushNotifications() {
  const [isAdminSubscribed, setIsAdminSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [loading, setLoading] = useState(false)
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [vapidPublicKey, setVapidPublicKey] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'settings' | 'test' | 'rules' | 'logs'>('settings')
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)

  useEffect(() => {
    initializePush()
    fetchRules()
    fetchLogs()
    fetchVapidPublicKey()
    checkAdminSubscription()
  }, [])

  const initializePush = async () => {
    await pushManager.initialize()
    setPermission(pushManager.getPermissionStatus())
  }

  const fetchVapidPublicKey = async () => {
    try {
      const response = await fetch('/api/push/vapid-public-key')
      if (response.ok) {
        const data = await response.json()
        setVapidPublicKey(data.publicKey)
      }
    } catch (error) {
      console.error('Failed to fetch VAPID public key:', error)
    }
  }

  const checkAdminSubscription = async () => {
    try {
      const response = await fetch('/api/push/admin/subscription', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setIsAdminSubscribed(data.isSubscribed)
      }
    } catch (error) {
      console.error('Failed to check admin subscription:', error)
    }
  }

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/push/rules', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setRules(data.rules || [])
      }
    } catch (error) {
      console.error('Failed to fetch rules:', error)
    }
  }

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/push/logs?limit=50', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    }
  }

  const handleAdminSubscribe = async () => {
    setLoading(true)
    try {
      const result = await pushManager.adminSubscribe()
      if (result.success) {
        setIsAdminSubscribed(true)
        setPermission('granted')
        alert('Successfully subscribed to push notifications for testing!')
      } else {
        alert(`Failed to subscribe: ${result.error}`)
      }
    } catch (error) {
      alert(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAdminUnsubscribe = async () => {
    setLoading(true)
    try {
      const result = await pushManager.adminUnsubscribe()
      if (result.success) {
        setIsAdminSubscribed(false)
        alert('Successfully unsubscribed from push notifications!')
      } else {
        alert(`Failed to unsubscribe: ${result.error}`)
      }
    } catch (error) {
      alert(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAdminTestNotification = async () => {
    setLoading(true)
    try {
      const result = await pushManager.sendAdminTestNotification()
      if (result.success) {
        alert('Test notification sent! Check your notifications.')
        fetchLogs() // Refresh logs after sending
      } else {
        alert(`Failed to send test notification: ${result.error}`)
      }
    } catch (error) {
      alert(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return

    try {
      const response = await fetch(`/api/push/rules/${ruleId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        fetchRules()
        alert('Rule deleted successfully')
      } else {
        alert('Failed to delete rule')
      }
    } catch (error) {
      console.error('Failed to delete rule:', error)
      alert('Error deleting rule')
    }
  }

  const handleToggleRule = async (rule: NotificationRule) => {
    try {
      const response = await fetch(`/api/push/rules/${rule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...rule,
          enabled: !rule.enabled,
        }),
      })

      if (response.ok) {
        fetchRules()
      } else {
        alert('Failed to toggle rule')
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error)
      alert('Error toggling rule')
    }
  }

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">VAPID Configuration</h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="vapid-public-key" className="block text-sm font-medium text-gray-700 mb-2">Public Key</label>
            <div id="vapid-public-key" className="bg-gray-50 p-3 rounded-md">
              <code className="text-sm text-gray-800 break-all">
                {vapidPublicKey || 'Loading...'}
              </code>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Use this public key in your client application for Web Push subscriptions
            </p>
          </div>

          <div>
            <label htmlFor="vapid-subject" className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <div id="vapid-subject" className="bg-gray-50 p-3 rounded-md">
              <code className="text-sm text-gray-800">mailto:support@vibebase.app</code>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              VAPID subject for push notification identification
            </p>
          </div>

          <div>
            <label htmlFor="api-endpoints" className="block text-sm font-medium text-gray-700 mb-2">API Endpoints</label>
            <div id="api-endpoints" className="bg-gray-50 p-3 rounded-md space-y-2">
              <div>
                <strong>Subscribe:</strong>{' '}
                <code className="text-sm">POST /api/push/subscribe</code>
              </div>
              <div>
                <strong>Unsubscribe:</strong>{' '}
                <code className="text-sm">POST /api/push/unsubscribe</code>
              </div>
              <div>
                <strong>Send Notification:</strong>{' '}
                <code className="text-sm">POST /api/push/send</code>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Use these endpoints in your application for end-user push notification management
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  const renderTest = () => (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Admin Test Notifications</h3>
        <p className="text-sm text-gray-600 mb-6">
          Test push notifications by subscribing your browser and sending test messages
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="browser-permission" className="block text-sm font-medium text-gray-700">Browser Permission</label>
            <span
              id="browser-permission"
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                permission === 'granted'
                  ? 'bg-green-100 text-green-800'
                  : permission === 'denied'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {permission || 'Unknown'}
            </span>
          </div>

          <div>
            <label htmlFor="admin-subscription-status" className="block text-sm font-medium text-gray-700">
              Admin Subscription Status
            </label>
            <span
              id="admin-subscription-status"
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                isAdminSubscribed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {isAdminSubscribed ? 'Subscribed' : 'Not Subscribed'}
            </span>
          </div>

          <div className="flex space-x-3">
            {!isAdminSubscribed ? (
              <button
                type="button"
                onClick={handleAdminSubscribe}
                disabled={loading || permission === 'denied'}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Subscribing...' : 'Subscribe for Testing'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleAdminUnsubscribe}
                  disabled={loading}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Unsubscribing...' : 'Unsubscribe'}
                </button>
                <button
                  type="button"
                  onClick={handleAdminTestNotification}
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Test Notification'}
                </button>
              </>
            )}
          </div>

          {permission === 'denied' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Notifications Blocked</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>Browser notifications are blocked. To test push notifications, please:</p>
                    <ol className="list-decimal list-inside mt-1">
                      <li>Click the lock icon in your browser's address bar</li>
                      <li>Set notifications to "Allow"</li>
                      <li>Refresh this page</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderRules = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Notification Rules</h3>
        <button
          type="button"
          onClick={() => setShowRuleForm(true)}
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
                    onClick={() => handleToggleRule(rule)}
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
                    onClick={() => {
                      setEditingRule(rule)
                      setShowRuleForm(true)
                    }}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
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
          <div className="text-center py-8 text-gray-500">No notification rules configured yet</div>
        )}
      </div>
    </div>
  )

  const renderRuleForm = () => {
    const [formData, setFormData] = useState({
      name: editingRule?.name || '',
      description: editingRule?.description || '',
      triggerType: editingRule?.triggerType || ('db_change' as 'db_change' | 'api'),
      tableName: editingRule?.tableName || '',
      eventType: editingRule?.eventType || ('insert' as 'insert' | 'update' | 'delete'),
      recipientType:
        editingRule?.recipientType ||
        ('all_users' as 'specific_user' | 'column_reference' | 'all_users'),
      recipientValue: editingRule?.recipientValue || '',
      titleTemplate: editingRule?.titleTemplate || '',
      bodyTemplate: editingRule?.bodyTemplate || '',
      iconUrl: editingRule?.iconUrl || '',
      imageUrl: editingRule?.imageUrl || '',
      clickAction: editingRule?.clickAction || '',
      priority: editingRule?.priority || ('normal' as 'high' | 'normal' | 'low'),
      ttl: editingRule?.ttl || 86400,
      enabled: editingRule?.enabled ?? true,
    })

    const handleSubmit = async (e: any) => {
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
          setShowRuleForm(false)
          setEditingRule(null)
          fetchRules()
        } else {
          const errorData = await response.json()
          console.error('API Error:', errorData)
          if (errorData.details) {
            console.error('Validation errors:', errorData.details)
          }
          alert(
            `Failed to ${editingRule ? 'update' : 'create'} rule: ${errorData.error}${errorData.details ? '\n\nValidation errors: ' + JSON.stringify(errorData.details, null, 2) : ''}`
          )
        }
      } catch (error) {
        alert(`Error ${editingRule ? 'updating' : 'creating'} rule: ${error}`)
      } finally {
        setLoading(false)
      }
    }

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
          <div className="mt-3">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingRule ? 'Edit Notification Rule' : 'Create Notification Rule'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rule-name" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    id="rule-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: (e.target as HTMLInputElement).value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="rule-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    id="rule-description"
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: (e.target as HTMLInputElement).value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="rule-trigger-type" className="block text-sm font-medium text-gray-700 mb-1">
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
                      <label htmlFor="rule-table-name" className="block text-sm font-medium text-gray-700 mb-1">
                        Table Name *
                      </label>
                      <input
                        id="rule-table-name"
                        type="text"
                        required
                        value={formData.tableName}
                        onChange={(e) => setFormData({ ...formData, tableName: (e.target as HTMLInputElement).value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="rule-event-type" className="block text-sm font-medium text-gray-700 mb-1">
                        Event Type *
                      </label>
                      <select
                        id="rule-event-type"
                        value={formData.eventType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            eventType: (e.target as HTMLSelectElement).value as 'insert' | 'update' | 'delete',
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
                  <label htmlFor="rule-recipient-type" className="block text-sm font-medium text-gray-700 mb-1">
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
                    <label htmlFor="rule-recipient-value" className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.recipientType === 'specific_user' ? 'User ID' : 'Column Name'} *
                    </label>
                    <input
                      id="rule-recipient-value"
                      type="text"
                      required
                      value={formData.recipientValue}
                      onChange={(e) => setFormData({ ...formData, recipientValue: (e.target as HTMLInputElement).value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="rule-title-template" className="block text-sm font-medium text-gray-700 mb-1">
                    Title Template *
                  </label>
                  <input
                    id="rule-title-template"
                    type="text"
                    required
                    value={formData.titleTemplate}
                    onChange={(e) => setFormData({ ...formData, titleTemplate: (e.target as HTMLInputElement).value })}
                    placeholder="e.g., New message from {{user_name}}"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="rule-body-template" className="block text-sm font-medium text-gray-700 mb-1">
                    Body Template *
                  </label>
                  <input
                    id="rule-body-template"
                    type="text"
                    required
                    value={formData.bodyTemplate}
                    onChange={(e) => setFormData({ ...formData, bodyTemplate: (e.target as HTMLInputElement).value })}
                    placeholder="e.g., {{message}}"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="rule-icon-url" className="block text-sm font-medium text-gray-700 mb-1">Icon URL</label>
                  <input
                    id="rule-icon-url"
                    type="url"
                    value={formData.iconUrl}
                    onChange={(e) => setFormData({ ...formData, iconUrl: (e.target as HTMLInputElement).value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="rule-image-url" className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    id="rule-image-url"
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: (e.target as HTMLInputElement).value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="rule-click-action" className="block text-sm font-medium text-gray-700 mb-1">
                    Click Action URL
                  </label>
                  <input
                    id="rule-click-action"
                    type="text"
                    value={formData.clickAction}
                    onChange={(e) => setFormData({ ...formData, clickAction: (e.target as HTMLInputElement).value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="rule-priority" className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
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
                    onChange={(e) => setFormData({ ...formData, ttl: parseInt((e.target as HTMLInputElement).value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: (e.target as HTMLInputElement).checked })}
                  className="mr-2"
                />
                <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                  Enabled
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRuleForm(false)
                    setEditingRule(null)
                  }}
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

  const renderLogs = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Notification Logs</h3>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {logs.map((log) => (
            <li key={log.id} className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <h4 className="text-sm font-medium text-gray-900">{log.title}</h4>
                    <span
                      className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        log.status === 'sent'
                          ? 'bg-green-100 text-green-800'
                          : log.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{log.body}</p>
                  {log.errorMessage && (
                    <p className="text-sm text-red-600 mt-1">{log.errorMessage}</p>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    User: {log.userId} | Provider: {log.provider} |{' '}
                    {new Date(log.createdAt).toLocaleString(undefined, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {logs.length === 0 && (
          <div className="text-center py-8 text-gray-500">No notification logs available</div>
        )}
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Push Notifications</h1>
        <p className="mt-2 text-gray-600">
          Manage push notification settings, rules, and view delivery logs
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'settings', name: 'Settings' },
            { id: 'test', name: 'Test' },
            { id: 'rules', name: 'Rules' },
            { id: 'logs', name: 'Logs' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'settings' && renderSettings()}
      {activeTab === 'test' && renderTest()}
      {activeTab === 'rules' && renderRules()}
      {activeTab === 'logs' && renderLogs()}

      {/* Rule Form Modal */}
      {showRuleForm && renderRuleForm()}
    </div>
  )
}
