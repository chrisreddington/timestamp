/**
 * Vitest setup file for global test mocks and configuration
 *
 * Console output is suppressed via vitest.config.ts onConsoleLog option.
 * To debug, set onConsoleLog to undefined in vitest.config.ts.
 */

import { vi, beforeEach, afterEach } from 'vitest';
import { injectTemplates, removeTemplates } from '@/test-utils/templates';

(globalThis as unknown as { __PROFILING__: boolean }).__PROFILING__ = true;

// Inject HTML templates for JSDOM environment (once, in head to survive cleanupDOM)
// Templates must be available for cloneTemplate() utility to work in tests
// NOTE: Templates remain in document.head but cleanup DOM to prevent accumulation
let templateContainerCreated = false;

beforeEach(() => {
  if (!templateContainerCreated) {
    injectTemplates();
    templateContainerCreated = true;
  }
});

// Clean up document body and timers between tests but preserve templates in head
afterEach(() => {
  // Clear body but keep head templates
  document.body.innerHTML = '';
  
  // Clear any pending timers if fake timers are active
  if (vi.isFakeTimers()) {
    vi.clearAllTimers();
  }
});

// Suppress jsdom 'Not implemented: navigation' warnings that leak to stderr
// These occur when code reads/writes location properties in jsdom
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = String(args[0] ?? '');
  if (message.includes('Not implemented:')) {
    return; // Suppress jsdom limitation warnings
  }
  originalConsoleError.apply(console, args);
};

// Mock window.matchMedia for jsdom environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});

// Mock window.scrollTo to suppress jsdom warnings
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// Mock canvas getContext to suppress jsdom warnings
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn().mockReturnValue({ data: [] }),
  putImageData: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 0 }),
  fillText: vi.fn(),
  canvas: { width: 0, height: 0 },
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
