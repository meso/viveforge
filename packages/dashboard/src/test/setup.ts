import '@testing-library/jest-dom'

// Mock fetch globally
global.fetch = vi.fn()

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000',
  },
  writable: true,
})

beforeEach(() => {
  vi.clearAllMocks()
})
