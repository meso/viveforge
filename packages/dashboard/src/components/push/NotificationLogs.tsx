/**
 * NotificationLogs component
 * Displays notification delivery logs
 */

import type { NotificationLog } from '../../types/push'
import { formatDateTime } from '../../utils/database'

interface NotificationLogsProps {
  logs: NotificationLog[]
}

export function NotificationLogs({ logs }: NotificationLogsProps) {
  return (
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
                    User: {log.userId} | Provider: {log.provider} | {formatDateTime(log.createdAt)}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {logs.length === 0 && (
          <output className="text-center py-8 text-gray-500" aria-live="polite">
            No notification logs available
          </output>
        )}
      </div>
    </div>
  )
}
