/**
 * Test setup
 */
import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock fetch
global.fetch = vi.fn()

// Mock EventSource
const EventSourceMock = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  onmessage: vi.fn(),
  onerror: vi.fn(),
  onopen: vi.fn(),
  readyState: 0,
  url: '',
  withCredentials: false,
})) as unknown as typeof EventSource

// Set EventSource constants
Object.defineProperty(EventSourceMock, 'CONNECTING', { value: 0 })
Object.defineProperty(EventSourceMock, 'OPEN', { value: 1 })
Object.defineProperty(EventSourceMock, 'CLOSED', { value: 2 })

global.EventSource = EventSourceMock
