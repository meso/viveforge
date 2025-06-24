/**
 * Authentication client utilities
 * Handles authentication errors and provides secure fetch wrapper
 */

// Helper function to handle authentication errors
function handleAuthError() {
  // Prevent redirect loop
  if (window.location.pathname === '/auth/login') {
    return
  }

  console.warn('Authentication required, redirecting to login...')
  window.location.href = '/auth/login'
}

// Enhanced fetch with authentication error handling
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, options)

  // Check for authentication errors
  if (response.status === 401) {
    handleAuthError()
    // Throw error to prevent further processing
    throw new Error('Authentication required')
  }

  return response
}
