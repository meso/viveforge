/**
 * PushTest component
 * Handles admin test notifications functionality
 */

interface PushTestProps {
  isAdminSubscribed: boolean
  permission: NotificationPermission | null
  loading: boolean
  statusMessage: { type: 'success' | 'error'; message: string } | null
  onAdminSubscribe: () => void
  onAdminUnsubscribe: () => void
  onAdminTestNotification: () => void
  onClearStatusMessage: () => void
}

export function PushTest({
  isAdminSubscribed,
  permission,
  loading,
  statusMessage,
  onAdminSubscribe,
  onAdminUnsubscribe,
  onAdminTestNotification,
  onClearStatusMessage,
}: PushTestProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Admin Test Notifications</h3>
        <p className="text-sm text-gray-600 mb-6">
          Test push notifications by subscribing your browser and sending test messages
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="browser-permission" className="block text-sm font-medium text-gray-700">
              Browser Permission
            </label>
            <output
              id="browser-permission"
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                permission === 'granted'
                  ? 'bg-green-100 text-green-800'
                  : permission === 'denied'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
              }`}
              aria-label={`Browser notification permission status: ${permission || 'Unknown'}`}
            >
              {permission || 'Unknown'}
            </output>
          </div>

          <div>
            <label
              htmlFor="admin-subscription-status"
              className="block text-sm font-medium text-gray-700"
            >
              Admin Subscription Status
            </label>
            <output
              id="admin-subscription-status"
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                isAdminSubscribed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
              aria-label={`Admin subscription status: ${isAdminSubscribed ? 'Subscribed' : 'Not Subscribed'}`}
            >
              {isAdminSubscribed ? 'Subscribed' : 'Not Subscribed'}
            </output>
          </div>

          <div className="flex space-x-3">
            {!isAdminSubscribed ? (
              <button
                type="button"
                onClick={onAdminSubscribe}
                disabled={loading || permission === 'denied'}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Subscribing...' : 'Subscribe for Testing'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onAdminUnsubscribe}
                  disabled={loading}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Unsubscribing...' : 'Unsubscribe'}
                </button>
                <button
                  type="button"
                  onClick={onAdminTestNotification}
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Test Notification'}
                </button>
              </>
            )}
          </div>

          {statusMessage && (
            <div
              className={`border rounded-md p-4 ${
                statusMessage.type === 'success'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
              role="alert"
              aria-live="polite"
            >
              <div className="flex justify-between items-start">
                <div className="flex">
                  <div className="flex-shrink-0">
                    {statusMessage.type === 'success' ? (
                      <svg
                        className="h-5 w-5 text-green-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-label="Success"
                      >
                        <title>Success</title>
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5 text-red-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-label="Error"
                      >
                        <title>Error</title>
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p
                      className={`text-sm font-medium ${
                        statusMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      {statusMessage.message}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClearStatusMessage}
                  className={`ml-3 text-sm ${
                    statusMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
                  } hover:opacity-75`}
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {permission === 'denied' && (
            <div
              className="bg-yellow-50 border border-yellow-200 rounded-md p-4"
              role="alert"
              aria-live="polite"
            >
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
}
