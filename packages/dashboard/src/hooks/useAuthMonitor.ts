import { useEffect } from 'preact/hooks'
import { handleAuthenticationError } from '../lib/auth-error-handler'

/**
 * Monitor authentication status on window focus
 */
export function useAuthMonitor() {
  useEffect(() => {
    // Check auth status when window regains focus
    const handleFocus = async () => {
      try {
        // Simple auth status check
        const response = await fetch(`${window.location.origin}/auth/status`)

        if (response.status === 401) {
          handleAuthenticationError()
        }
      } catch (error) {
        // Ignore network errors on focus check
        console.debug('Auth check failed on focus:', error)
      }
    }

    // Add event listener
    window.addEventListener('focus', handleFocus)

    // Check immediately on mount
    handleFocus()

    // Cleanup
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [])
}
