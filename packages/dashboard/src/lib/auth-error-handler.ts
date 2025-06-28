/**
 * Centralized authentication error handling
 */

export function handleAuthenticationError() {
  // Prevent redirect loop - no need to redirect since server will show login page
  if (window.location.pathname === '/auth/login') {
    return
  }

  console.warn('Authentication required, reloading page to show login...')
  // Reload the page to trigger server-side login page display
  window.location.reload()
}
