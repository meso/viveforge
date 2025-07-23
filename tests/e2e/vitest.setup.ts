/**
 * Vitest setup file for E2E tests
 * E2Eテスト用のsetupファイル
 */

import { vi } from 'vitest';
import { EventSource } from 'eventsource';

// EventSource polyfill for Node.js environment
if (typeof globalThis.EventSource === 'undefined') {
  globalThis.EventSource = EventSource as any;
}

// Optional: Add other global polyfills if needed
// WebSocket polyfill (if needed in the future)
// if (typeof WebSocket === 'undefined') {
//   const WebSocket = await import('ws');
//   (global as any).WebSocket = WebSocket.default;
// }