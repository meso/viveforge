import { useState } from 'preact/hooks'
import { NotificationLogs } from '../components/push/NotificationLogs'
import { NotificationRules } from '../components/push/NotificationRules'
import { PushSettings } from '../components/push/PushSettings'
import { PushTest } from '../components/push/PushTest'
import { RuleForm } from '../components/push/RuleForm'
import { Modal } from '../components/ui/Modal'
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
    vapidConfigured,
    setActiveTab,
    setLoading,
    handleAdminSubscribe,
    handleAdminUnsubscribe,
    handleAdminTestNotification,
    handleDeleteRule,
    handleToggleRule,
    fetchRules,
    initializeVapid,
    checkVapidStatus,
  } = usePushNotifications()

  const [showRuleForm, setShowRuleForm] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)
  const [messageModal, setMessageModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    isError: boolean
  }>({
    isOpen: false,
    title: '',
    message: '',
    isError: false,
  })

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

  const handleInitializeVapid = async () => {
    try {
      const result = await initializeVapid()
      setMessageModal({
        isOpen: true,
        title: '🎉 Success!',
        message: `${result.message}\n\n${result.note}`,
        isError: false,
      })
      await checkVapidStatus()
    } catch (error) {
      setMessageModal({
        isOpen: true,
        title: 'Error',
        message: `Failed to initialize VAPID keys: ${error}`,
        isError: true,
      })
    }
  }

  const closeMessageModal = () => {
    setMessageModal({
      isOpen: false,
      title: '',
      message: '',
      isError: false,
    })
  }

  // Show initialization screen if VAPID is not configured
  if (vapidConfigured === false) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Push Notifications Setup Required</h1>
          <p className="mt-2 text-gray-600 max-w-md mx-auto">
            Push notifications are not configured yet. You need to initialize VAPID keys to enable Web Push functionality.
          </p>
          <div className="mt-8 bg-gray-50 rounded-lg p-6 max-w-2xl mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">What are VAPID keys?</h3>
            <p className="text-sm text-gray-600 mb-4">
              VAPID (Voluntary Application Server Identification) keys are required for sending push notifications to browsers.
              They authenticate your server with push services like Google's FCM.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Automatic Setup
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>
                      VAPID keys will be automatically generated and securely stored in your database. 
                      No manual configuration required - just click the button below!
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleInitializeVapid}
              disabled={loading}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating VAPID Keys...
                </>
              ) : (
                'Initialize Push Notifications'
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show loading state while checking configuration
  if (vapidConfigured === null) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Checking push notification configuration...</p>
        </div>
      </div>
    )
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

      {/* Message Modal */}
      <Modal
        isOpen={messageModal.isOpen}
        onClose={closeMessageModal}
        title={messageModal.title}
        size="md"
      >
        <div className="space-y-4">
          <div className={`p-4 rounded-md ${messageModal.isError ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="text-2xl">
                  {messageModal.isError ? '❌' : '✅'}
                </div>
              </div>
              <div className="ml-3">
                <div className={`text-sm ${messageModal.isError ? 'text-red-700' : 'text-green-700'}`}>
                  <pre className="whitespace-pre-wrap font-sans">{messageModal.message}</pre>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeMessageModal}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
