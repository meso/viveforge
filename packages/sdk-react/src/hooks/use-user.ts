/**
 * Current user hook
 */
import { useAuth } from './use-auth'

/**
 * Hook to access the current authenticated user
 * This is a convenience hook that extracts just the user from useAuth
 */
export function useUser() {
  const { user, isAuthenticated, isLoading } = useAuth()

  return {
    user,
    isAuthenticated,
    isLoading,
  }
}
