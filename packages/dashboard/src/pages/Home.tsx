import { useEffect, useState } from 'preact/hooks'
import { api } from '../lib/api'

export function HomePage() {
  const [stats, setStats] = useState({
    userTables: 0,
    dbStatus: 'checking...',
    oauthProviders: 0,
    pushRules: 0,
  })

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      // Load health status
      const health = await api.health()

      // Load tables
      const tablesResult = await api.getTables()
      const userTables = tablesResult.tables.filter((t) => t.type === 'user').length

      // Load OAuth providers
      let oauthProviders = 0
      try {
        const response = await fetch('/api/admin/oauth/providers', { credentials: 'include' })
        if (response.ok) {
          const providers = await response.json()
          oauthProviders =
            providers.providers?.filter((p: { is_enabled: boolean }) => p.is_enabled)?.length || 0
        }
      } catch {
        // Ignore errors for OAuth providers
      }

      // Load push notification rules
      let pushRules = 0
      try {
        const response = await fetch('/api/push/rules', { credentials: 'include' })
        if (response.ok) {
          const rules = await response.json()
          pushRules = rules.rules?.filter((r: { enabled: boolean }) => r.enabled)?.length || 0
        }
      } catch {
        // Ignore errors for push rules
      }

      setStats({
        userTables,
        dbStatus:
          (health as { database?: string })?.database === 'connected'
            ? 'connected'
            : 'disconnected',
        oauthProviders,
        pushRules,
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
      setStats((prev) => ({ ...prev, dbStatus: 'error' }))
    }
  }

  return (
    <div>
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          title="User Tables"
          description="User-defined tables in D1"
          href="/database"
          stats={`${stats.userTables} tables`}
          status={stats.dbStatus}
        />
        <DashboardCard
          title="Storage"
          description="R2 object storage for files"
          href="/storage"
          stats="Ready"
          status="connected"
        />
        <DashboardCard
          title="OAuth Providers"
          description="Active authentication providers"
          href="/auth"
          stats={`${stats.oauthProviders} enabled`}
        />
        <DashboardCard
          title="Push Rules"
          description="Active notification rules"
          href="/push"
          stats={`${stats.pushRules} rules`}
        />
      </div>

      <div class="mt-8">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <div class="space-y-3">
              <a href="/database" class="text-indigo-600 hover:text-indigo-500 block">
                Create new table →
              </a>
              <a href="/database" class="text-indigo-600 hover:text-indigo-500 block">
                Browse database →
              </a>
              <a href="/storage" class="text-indigo-600 hover:text-indigo-500 block">
                Upload files →
              </a>
              <a
                href="/api/health"
                target="_blank"
                class="text-indigo-600 hover:text-indigo-500 block"
                rel="noopener"
              >
                View API health →
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-8">
        <h3 class="text-lg font-medium text-gray-900 mb-4">API Endpoints</h3>
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <code class="text-gray-600">GET /api/health</code>
                <span class="text-green-600">Health check</span>
              </div>
              <div class="flex justify-between">
                <code class="text-gray-600">GET /api/tables</code>
                <span class="text-green-600">List tables</span>
              </div>
              <div class="flex justify-between">
                <code class="text-gray-600">POST /api/tables</code>
                <span class="text-green-600">Create table</span>
              </div>
              <div class="flex justify-between">
                <code class="text-gray-600">GET /api/tables/:name/data</code>
                <span class="text-green-600">Get table data</span>
              </div>
              <div class="flex justify-between">
                <code class="text-gray-600">GET /api/storage/files</code>
                <span class="text-green-600">List files</span>
              </div>
              <div class="flex justify-between">
                <code class="text-gray-600">POST /api/storage/files</code>
                <span class="text-green-600">Upload file</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface DashboardCardProps {
  title: string
  description: string
  href: string
  stats: string
  status?: string
}

function DashboardCard({ title, description, href, stats, status }: DashboardCardProps) {
  return (
    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="px-4 py-5 sm:p-6">
        <div class="flex items-center justify-between">
          <dt class="text-sm font-medium text-gray-500 truncate">{title}</dt>
          {status && (
            <span
              class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                status === 'connected'
                  ? 'bg-green-100 text-green-800'
                  : status === 'error'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
              }`}
            >
              {status}
            </span>
          )}
        </div>
        <dd class="mt-1 text-3xl font-semibold text-gray-900">{stats}</dd>
        <p class="mt-2 text-sm text-gray-600">{description}</p>
        <a
          href={href}
          class="mt-3 text-indigo-600 hover:text-indigo-500 text-sm font-medium inline-block"
        >
          Manage →
        </a>
      </div>
    </div>
  )
}
