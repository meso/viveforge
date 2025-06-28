import { useEffect } from 'preact/hooks'

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
          // Prevent redirect loop
          if (window.location.pathname !== '/auth/login') {
            console.warn('Session expired, reloading to show login...')
            window.location.reload()
          }
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
