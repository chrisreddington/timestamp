import type { Browser, Page } from 'playwright';
import { vi } from 'vitest';

/**
 * Creates a mock Playwright Page object for testing.
 */
export function createMockPage(overrides?: Partial<Page>): Page {
  return {
    goto: vi.fn(),
    waitForTimeout: vi.fn(),
    evaluate: vi.fn(),
    screenshot: vi.fn(),
    addInitScript: vi.fn(),
    addStyleTag: vi.fn(),
    emulateMedia: vi.fn(),
    locator: vi.fn().mockReturnValue({
      isVisible: vi.fn().mockResolvedValue(false),
      click: vi.fn(),
    }),
    ...overrides,
  } as unknown as Page;
}

/**
 * Creates a mock Playwright Browser object for testing.
 */
export function createMockBrowser(mockPage?: Page): Browser {
  return {
    newPage: vi.fn().mockResolvedValue(mockPage || createMockPage()),
    close: vi.fn(),
  } as unknown as Browser;
}

/**
 * Creates a mock theme registry for testing.
 */
export function createMockRegistry(themes: Record<string, { name: string; description?: string }>) {
  const THEME_REGISTRY: Record<string, { id: string; name: string; description: string }> = {};

  Object.entries(themes).forEach(([id, { name, description }]) => {
    THEME_REGISTRY[id] = {
      id,
      name,
      description: description || 'Test description',
    };
  });

  return {
    THEME_REGISTRY,
    DEFAULT_THEME_ID: Object.keys(themes)[0] || 'contribution-graph',
  };
}
