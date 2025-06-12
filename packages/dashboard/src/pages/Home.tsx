export function HomePage() {
  return (
    <div>
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
      
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Database"
          description="Manage your D1 databases and tables"
          href="/database"
          stats="0 tables"
        />
        <DashboardCard
          title="Storage"
          description="Manage files in R2 storage"
          href="/storage"
          stats="0 MB used"
        />
        <DashboardCard
          title="Authentication"
          description="Configure auth providers and users"
          href="/auth"
          stats="0 users"
        />
      </div>

      <div class="mt-8">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <div class="space-y-3">
              <button class="text-indigo-600 hover:text-indigo-500">
                Create new table →
              </button>
              <button class="text-indigo-600 hover:text-indigo-500 block">
                Upload files →
              </button>
              <button class="text-indigo-600 hover:text-indigo-500 block">
                View API documentation →
              </button>
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
}

function DashboardCard({ title, description, href, stats }: DashboardCardProps) {
  return (
    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="px-4 py-5 sm:p-6">
        <dt class="text-sm font-medium text-gray-500 truncate">{title}</dt>
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