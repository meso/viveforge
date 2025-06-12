import { ComponentChildren } from 'preact'
import { Link } from 'preact-router/match'
import clsx from 'clsx'

interface LayoutProps {
  children: ComponentChildren
}

export function Layout({ children }: LayoutProps) {
  return (
    <div class="min-h-screen bg-gray-50">
      <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex">
              <div class="flex-shrink-0 flex items-center">
                <h1 class="text-xl font-bold text-gray-900">Ourforge</h1>
              </div>
              <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
                <NavLink href="/">Dashboard</NavLink>
                <NavLink href="/database">Database</NavLink>
                <NavLink href="/storage">Storage</NavLink>
                <NavLink href="/auth">Auth</NavLink>
                <NavLink href="/settings">Settings</NavLink>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

interface NavLinkProps {
  href: string
  children: ComponentChildren
}

function NavLink({ href, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      class={clsx(
        'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
        'hover:border-gray-300 hover:text-gray-700'
      )}
      activeClassName="border-indigo-500 text-gray-900"
      inactiveClassName="border-transparent text-gray-500"
    >
      {children}
    </Link>
  )
}