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
})) as any

EventSourceMock.CONNECTING = 0
EventSourceMock.OPEN = 1
EventSourceMock.CLOSED = 2

global.EventSource = EventSourceMock
