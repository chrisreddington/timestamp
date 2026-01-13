/**
 * Vitest setup file for global test mocks and configuration
 *
 * Console output is suppressed via vitest.config.ts onConsoleLog option.
 * To debug, set onConsoleLog to undefined in vitest.config.ts.
 */

import { injectTemplates, removeTemplates } from '@/test-utils/templates';
import { afterEach, beforeEach, vi } from 'vitest';

(globalThis as unknown as { __PROFILING__: boolean }).__PROFILING__ = true;

// Inject HTML templates for JSDOM environment (once, in head to survive cleanupDOM)
// Templates must be available for cloneTemplate() utility to work in tests
beforeEach(() => {
  injectTemplates();
});

afterEach(() => {
  removeTemplates();
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

// Mock ResizeObserver for jsdom environment (used by canvas-based renderers)
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(_callback: ResizeObserverCallback) {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// Mock IntersectionObserver for jsdom environment (used by video-playback-controller)
class MockIntersectionObserverSetup implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  
  constructor(_callback: IntersectionObserverCallback) {}
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserverSetup);

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
  closePath: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 0 }),
  fillText: vi.fn(),
  setTransform: vi.fn(),
  quadraticCurveTo: vi.fn(),
  globalAlpha: 1,
  fillStyle: '',
  canvas: { width: 0, height: 0 },
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
