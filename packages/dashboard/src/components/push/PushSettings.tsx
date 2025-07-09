/**
 * PushSettings component
 * Displays VAPID configuration and API endpoints information
 */

import { useState } from 'preact/hooks'
import { Modal } from '../ui/Modal'

interface PushSettingsProps {
  vapidPublicKey: string
  onReinitializeVapid: () => void
  loading: boolean
}

export function PushSettings({ vapidPublicKey, onReinitializeVapid, loading }: PushSettingsProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const handleReinitializeClick = () => {
    setShowConfirmModal(true)
  }

  const handleConfirmReinitialize = () => {
    setShowConfirmModal(false)
    onReinitializeVapid()
  }

  const handleCancelReinitialize = () => {
    setShowConfirmModal(false)
  }
  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">VAPID Configuration</h3>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="vapid-public-key"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Public Key
            </label>
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
            <label htmlFor="vapid-subject" className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <div id="vapid-subject" className="bg-gray-50 p-3 rounded-md">
              <code className="text-sm text-gray-800">mailto:support@vibebase.app</code>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              VAPID subject for push notification identification
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-700">Re-initialize VAPID Keys</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Generate new VAPID keys if having issues with push notifications
                </p>
              </div>
              <button
                type="button"
                onClick={handleReinitializeClick}
                disabled={loading}
                className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50 text-sm"
              >
                {loading ? 'Generating...' : 'Re-initialize Keys'}
              </button>
            </div>
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-xs text-yellow-800">
                ⚠️ This will invalidate all existing subscriptions. Users will need to re-subscribe to receive notifications.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="api-endpoints" className="block text-sm font-medium text-gray-700 mb-2">
              API Endpoints
            </label>
            <section
              id="api-endpoints"
              className="bg-gray-50 p-3 rounded-md space-y-2"
              aria-label="API endpoints information"
            >
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
            </section>
            <p className="text-xs text-gray-500 mt-1">
              Use these endpoints in your application for end-user push notification management
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={handleCancelReinitialize}
        title="⚠️ Re-initialize VAPID Keys"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="text-2xl">🚨</div>
              </div>
              <div className="ml-3 text-left">
                <h3 className="text-sm font-medium text-red-800">
                  This action will invalidate all existing subscriptions
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>All current push notification subscriptions will be invalidated</li>
                    <li>Users will need to re-subscribe to receive notifications</li>
                    <li>This cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="text-2xl">💡</div>
              </div>
              <div className="ml-3 text-left">
                <h3 className="text-sm font-medium text-blue-800">
                  When should you re-initialize?
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Push notifications are not working</li>
                    <li>VAPID key corruption is suspected</li>
                    <li>Starting fresh with a clean slate</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCancelReinitialize}
              className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReinitialize}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Generating...' : 'Yes, Re-initialize Keys'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
