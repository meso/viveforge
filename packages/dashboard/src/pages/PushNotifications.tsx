import { useState } from 'preact/hooks'
import { NotificationLogs } from '../components/push/NotificationLogs'
import { NotificationRules } from '../components/push/NotificationRules'
import { PushSettings } from '../components/push/PushSettings'
import { PushTest } from '../components/push/PushTest'
import { RuleForm } from '../components/push/RuleForm'
import { usePushNotifications } from '../hooks/usePushNotifications'
import type { NotificationRule, RuleFormData } from '../types/push'

export default function PushNotifications() {
  const {
    isAdminSubscribed,
    permission,
    loading,
    rules,
    logs,
    vapidPublicKey,
    activeTab,
    setActiveTab,
    setLoading,
    handleAdminSubscribe,
    handleAdminUnsubscribe,
    handleAdminTestNotification,
    handleDeleteRule,
    handleToggleRule,
    fetchRules,
  } = usePushNotifications()

  const [showRuleForm, setShowRuleForm] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)

  const handleCreateRule = () => {
    setEditingRule(null)
    setShowRuleForm(true)
  }

  const handleEditRule = (rule: NotificationRule) => {
    setEditingRule(rule)
    setShowRuleForm(true)
  }

  const handleCloseRuleForm = () => {
    setShowRuleForm(false)
    setEditingRule(null)
  }

  const handleRuleFormSubmit = async (_formData: RuleFormData) => {
    await fetchRules()
    handleCloseRuleForm()
  }

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
        <div
          className="-mb-px flex space-x-8"
          role="tablist"
          aria-label="Push notifications navigation"
        >
          {[
            { id: 'settings', name: 'Settings' },
            { id: 'test', name: 'Test' },
            { id: 'rules', name: 'Rules' },
            { id: 'logs', name: 'Logs' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              onClick={() => setActiveTab(tab.id as 'settings' | 'test' | 'rules' | 'logs')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div role="tabpanel" id="settings-panel" aria-labelledby="settings-tab">
        {activeTab === 'settings' && <PushSettings vapidPublicKey={vapidPublicKey} />}
      </div>
      <div role="tabpanel" id="test-panel" aria-labelledby="test-tab">
        {activeTab === 'test' && (
          <PushTest
            isAdminSubscribed={isAdminSubscribed}
            permission={permission}
            loading={loading}
            onAdminSubscribe={handleAdminSubscribe}
            onAdminUnsubscribe={handleAdminUnsubscribe}
            onAdminTestNotification={handleAdminTestNotification}
          />
        )}
      </div>
      <div role="tabpanel" id="rules-panel" aria-labelledby="rules-tab">
        {activeTab === 'rules' && (
          <NotificationRules
            rules={rules}
            onCreateRule={handleCreateRule}
            onEditRule={handleEditRule}
            onToggleRule={handleToggleRule}
            onDeleteRule={handleDeleteRule}
          />
        )}
      </div>
      <div role="tabpanel" id="logs-panel" aria-labelledby="logs-tab">
        {activeTab === 'logs' && <NotificationLogs logs={logs} />}
      </div>

      {/* Rule Form Modal */}
      {showRuleForm && (
        <RuleForm
          editingRule={editingRule}
          loading={loading}
          onSubmit={handleRuleFormSubmit}
          onClose={handleCloseRuleForm}
          setLoading={setLoading}
        />
      )}
    </div>
  )
}
