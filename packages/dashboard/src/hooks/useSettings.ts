import { useState } from 'preact/hooks'
import type { SettingsSection } from '../types/settings'

export interface SettingsNavigationState {
  activeSection: SettingsSection
  error: string | null
}

export interface SettingsNavigationActions {
  setActiveSection: (section: SettingsSection) => void
  setError: (error: string | null) => void
  clearError: () => void
}

/**
 * Custom hook for managing Settings page navigation and common state
 */
export const useSettings = (): SettingsNavigationState & SettingsNavigationActions => {
  const [state, setState] = useState<SettingsNavigationState>({
    activeSection: 'app-settings',
    error: null,
  })

  const setActiveSection = (section: SettingsSection) => {
    setState((prev) => ({
      ...prev,
      activeSection: section,
      error: null, // Clear error when switching sections
    }))
  }

  const setError = (error: string | null) => {
    setState((prev) => ({ ...prev, error }))
  }

  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }))
  }

  return {
    ...state,
    setActiveSection,
    setError,
    clearError,
  }
}
