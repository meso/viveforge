import clsx from 'clsx'
import type { ComponentChildren } from 'preact'
import { route } from 'preact-router'
import { useAuthMonitor } from '../hooks/useAuthMonitor'

interface LayoutProps {
  children: ComponentChildren
}

export function Layout({ children }: LayoutProps) {
  // Monitor authentication status
  useAuthMonitor()

  return (
    <div class="min-h-screen bg-gray-50">
      <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex">
              <div class="flex-shrink-0 flex items-center">
                <h1 class="text-xl font-bold text-gray-900">Vibebase</h1>
              </div>
              <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
                <NavLink href="/">Dashboard</NavLink>
                <NavLink href="/database">Database</NavLink>
                <NavLink href="/custom-sql">Custom SQL</NavLink>
                <NavLink href="/storage">Storage</NavLink>
                <NavLink href="/push">Push</NavLink>
                <NavLink href="/auth">Auth</NavLink>
                <NavLink href="/settings">Settings</NavLink>
              </div>
            </div>
            <div class="flex items-center space-x-4">
              <a
                href="/api/docs/swagger"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                📚 API Docs
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}

interface NavLinkProps {
  href: string
  children: ComponentChildren
}

function NavLink({ href, children }: NavLinkProps) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        route(href)
      }}
      class={clsx(
        'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
        'hover:border-gray-300 hover:text-gray-700',
        'border-transparent text-gray-500 cursor-pointer'
      )}
    >
      {children}
    </a>
  )
}
