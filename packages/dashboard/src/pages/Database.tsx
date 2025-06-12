import { useState } from 'preact/hooks'

export function DatabasePage() {
  const [tables, setTables] = useState<any[]>([])

  return (
    <div>
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h2 class="text-2xl font-bold text-gray-900">Database</h2>
          <p class="mt-2 text-sm text-gray-700">
            Manage your D1 database tables and data
          </p>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            Create Table
          </button>
        </div>
      </div>

      <div class="mt-8 flex flex-col">
        <div class="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              {tables.length === 0 ? (
                <div class="text-center py-12 bg-white">
                  <svg
                    class="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 class="mt-2 text-sm font-medium text-gray-900">No tables</h3>
                  <p class="mt-1 text-sm text-gray-500">
                    Get started by creating a new table.
                  </p>
                  <div class="mt-6">
                    <button
                      type="button"
                      class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Create Table
                    </button>
                  </div>
                </div>
              ) : (
                <table class="min-w-full divide-y divide-gray-300">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Table Name
                      </th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Records
                      </th>
                      <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Last Modified
                      </th>
                      <th class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span class="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 bg-white">
                    {/* Table rows will go here */}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}