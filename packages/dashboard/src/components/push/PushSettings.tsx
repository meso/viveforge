/**
 * PushSettings component
 * Displays VAPID configuration and API endpoints information
 */

interface PushSettingsProps {
  vapidPublicKey: string
}

export function PushSettings({ vapidPublicKey }: PushSettingsProps) {
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
    </div>
  )
}
