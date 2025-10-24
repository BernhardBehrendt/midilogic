// Vitest globals are configured in vitest.config.ts
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Initialize Angular testing environment globally
getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock addEventListener and removeEventListener for window events
const mockEventListeners: { [key: string]: Array<(event: any) => void> } = {};

const originalAddEventListener = window.addEventListener;
const originalRemoveEventListener = window.removeEventListener;

window.addEventListener = ((event: string, callback: any) => {
  if (!mockEventListeners[event]) {
    mockEventListeners[event] = [];
  }
  mockEventListeners[event].push(callback);
}) as any;

window.removeEventListener = ((event: string, callback: any) => {
  if (mockEventListeners[event]) {
    const index = mockEventListeners[event].indexOf(callback);
    if (index > -1) {
      mockEventListeners[event].splice(index, 1);
    }
  }
}) as any;

// Mock service worker
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    register: () =>
      Promise.resolve({
        update: () => {},
        unregister: () => {},
      }),
    ready: Promise.resolve({
      update: () => {},
      unregister: () => {},
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  writable: true,
});

// Mock MIDI API for future use
Object.defineProperty(navigator, 'requestMIDIAccess', {
  value: () =>
    Promise.resolve({
      inputs: new Map(),
      outputs: new Map(),
      onstatechange: null,
      sysexEnabled: false,
    }),
  writable: true,
});

// Helper function to trigger events in tests
(globalThis as any).triggerEvent = (eventType: string, eventData?: any) => {
  if (mockEventListeners[eventType]) {
    mockEventListeners[eventType].forEach((callback) => {
      callback(eventData || { type: eventType });
    });
  }
};

// Helper to simulate online/offline status changes
(globalThis as any).setOnlineStatus = (online: boolean) => {
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: online,
  });

  // Trigger the appropriate event synchronously to avoid hanging
  const eventType = online ? 'online' : 'offline';
  if (mockEventListeners[eventType]) {
    mockEventListeners[eventType].forEach((callback) => {
      try {
        callback({ type: eventType });
      } catch (error) {
        // Ignore callback errors in tests
      }
    });
  }
};

// Clean up function for tests
export const cleanupMocks = () => {
  // Only use vi functions if in test environment
  if (typeof globalThis !== 'undefined' && (globalThis as any).vi) {
    (globalThis as any).vi.clearAllMocks();
    (globalThis as any).vi.clearAllTimers();
  }
  Object.keys(mockEventListeners).forEach((key) => {
    mockEventListeners[key] = [];
  });

  // Reset online status
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: true,
  });
};

// Export for direct access in tests if needed
export { mockEventListeners };
