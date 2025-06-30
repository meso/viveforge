/**
 * Centralized authentication error handling
 */

export function handleAuthenticationError() {
  // Prevent redirect loop
  if (window.location.pathname === '/auth/login') {
    return
  }

  console.warn('Authentication required, redirecting to login page...')
  // Direct redirect to login page instead of reload
  window.location.href = '/auth/login'
}
