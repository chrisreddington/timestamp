/**
 * Shared utilities for image generation scripts
 * Contains common helpers for browser setup, registry access, and URL building
 */

import { existsSync } from 'node:fs';
import { register } from 'node:module';
import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import type { ThemeRegistryEntry } from '../../src/themes/registry/index';

// =============================================================================
// Constants
// =============================================================================

/** Default timer duration for countdown capture in seconds (1 second for fast capture) */
export const TIMER_DURATION_SECONDS = 1;

/** Delay after page load before countdown timer starts ticking */
export const CAPTURE_DELAY_MS = 1000;

/** Default development server port */
export const DEFAULT_PORT = '5173';

// =============================================================================
// Types
// =============================================================================

/** Theme registry structure imported from registry/index.ts */
export interface ThemeRegistry {
  THEME_REGISTRY: Record<string, ThemeRegistryEntry>;
  DEFAULT_THEME_ID: string;
}

/** Theme data extracted for image generation */
export interface ThemeData {
  id: string;
  displayName: string;
}

/** Base configuration shared by OG and preview configs */
export interface BaseImageConfig {
  port: string;
  baseUrl: string;
  outputDir: string;
  completionMessage: string;
}

// =============================================================================
// Module Loader
// =============================================================================

/**
 * Registers a custom module loader that mocks `.webp` and `.css` imports.
 *
 * @remarks
 * Vite appends `?url` to asset imports in the registry; substring matching
 * ensures both plain and query-suffixed specifiers are mocked when executing
 * scripts directly with tsx (Node.js loader without Vite).
 *
 * @returns Nothing. Side-effect registers a loader globally for the process.
 *
 * @example
 * ```typescript
 * registerWebpMockLoader();
 * const { THEME_REGISTRY } = await import(registryPath);
 * ```
 *
 * @see {@link loadThemeRegistry} for usage after the loader is registered.
 */
export function registerWebpMockLoader(): void {
  register(
    'data:text/javascript,' +
      encodeURIComponent(`
    export async function resolve(specifier, context, nextResolve) {
      if (specifier.includes('.webp')) {
        return { 
          url: 'data:text/javascript,export default "mocked-preview.webp"', 
          shortCircuit: true 
        };
      }
      if (specifier.includes('.css')) {
        return {
          url: 'data:text/javascript,export default {}',
          shortCircuit: true
        };
      }
      return nextResolve(specifier, context);
    }
    export async function load(url, context, nextLoad) {
      return nextLoad(url, context);
    }
  `)
  );
}

// =============================================================================
// Registry Access
// =============================================================================

/**
 * Loads the theme registry dynamically from the registry file.
 * @param registryPath - Absolute path to the registry/index.ts file
 * @returns Theme registry containing all themes and default theme ID
 */
export async function loadThemeRegistry(registryPath: string): Promise<ThemeRegistry> {
  return (await import(registryPath)) as ThemeRegistry;
}

/**
 * Extracts theme data from registry for image generation.
 * @param registry - Theme registry object
 * @returns Array of theme data with id and display name
 */
export function extractThemeData(registry: ThemeRegistry): ThemeData[] {
  return Object.entries(registry.THEME_REGISTRY).map(([id, entry]) => ({
    id,
    displayName: entry.name,
  }));
}

// =============================================================================
// URL Building
// =============================================================================

/**
 * Constructs a countdown URL with the specified parameters.
 * @param baseUrl - Base URL for the countdown page
 * @param themeId - Theme identifier
 * @param message - Completion message to display
 * @param timerDurationSeconds - Timer duration in seconds (defaults to TIMER_DURATION_SECONDS)
 * @param hideChrome - When true, adds chrome=none to hide all UI elements (for video recording)
 * @returns Fully constructed URL with query parameters
 */
export function buildCountdownUrl(
  baseUrl: string,
  themeId: string,
  message: string,
  timerDurationSeconds: number = TIMER_DURATION_SECONDS,
  hideChrome = false
): string {
  let url = `${baseUrl}/?mode=timer&duration=${timerDurationSeconds}&theme=${themeId}&message=${encodeURIComponent(message)}`;
  if (hideChrome) {
    url += '&chrome=none';
  }
  return url;
}

/**
 * Resolves port and base URL from environment variables.
 * Shared by both OG image and preview configs.
 * @returns Object with port and base URL
 */
export function resolvePortAndBaseUrl(): { port: string; baseUrl: string } {
  const port = process.env.OG_PORT || process.env.PORT || DEFAULT_PORT;
  const baseUrl = process.env.OG_BASE_URL || `http://localhost:${port}/timestamp`;
  return { port, baseUrl };
}

// =============================================================================
// Browser Factory
// =============================================================================

/**
 * Creates a Playwright browser instance in headless mode.
 * @returns Playwright browser instance
 */
export async function createBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

/**
 * Creates a Playwright page with specified viewport dimensions.
 * @param browser - Playwright browser instance
 * @param width - Viewport width in pixels
 * @param height - Viewport height in pixels
 * @returns Playwright page instance with configured viewport
 */
export async function createPage(
  browser: Browser,
  width: number,
  height: number
): Promise<Page> {
  return browser.newPage({
    viewport: { width, height },
  });
}

// =============================================================================
// File System Utilities
// =============================================================================

/**
 * Check if a file already exists at the given path.
 * @param filePath - Absolute path to check
 * @returns true if file exists, false otherwise
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

// =============================================================================
// UI Element Hiding
// =============================================================================

/**
 * CSS selectors for UI chrome elements to hide in generated images.
 * Used by both OG image and theme preview generators.
 */
export const UI_ELEMENTS_TO_HIDE = [
  // Data-testid selectors (preferred)
  '[data-testid="share-button"]',
  '[data-testid="back-button"]',
  '[data-testid="theme-switcher"]',
  '[data-testid="favorite-button"]',
  '[data-testid="github-button"]',
  '[data-testid="timezone-selector"]',
  '[data-testid="world-map"]',
  '[data-testid="offline-indicator"]',
  '[data-testid="fullscreen-button"]',
  '[data-testid="exit-fullscreen-button"]',
  '[data-testid="mobile-menu-button"]',
  '[data-testid="timer-play-pause"]',
  '[data-testid="timer-reset"]',
  '[data-testid="fullscreen-timer-controls"]',
  '[data-testid="color-mode-toggle"]',
  // Class selectors (fallback)
  '.share-button',
  '.back-button',
  '.theme-switcher',
  '.favorite-button',
  '.github-button',
  '.countdown-button-container',
  '.fullscreen-button',
  '.exit-fullscreen-button',
  '.mobile-menu-button',
  '.hamburger-button',
  '.timer-controls',
  '.fullscreen-timer-controls',
  '.color-mode-toggle',
  // PWA update prompt (may appear in dev)
  '.update-prompt-container',
  // Additional button containers
  '.countdown-buttons',
  '.button-container',
  'button',
  // Header elements
  'header',
  '.header',
  '[role="banner"]',
] as const;

/**
 * Hides UI chrome elements that shouldn't appear in generated images.
 * Uses CSS injection for persistent hiding across all frames.
 * @param page - Playwright page instance
 */
export async function hideUIElements(page: Page): Promise<void> {
  // Inject CSS with !important to ensure elements stay hidden
  await page.addStyleTag({
    content: UI_ELEMENTS_TO_HIDE.map(selector => 
      `${selector} { display: none !important; visibility: hidden !important; opacity: 0 !important; }`
    ).join('\n'),
  });
  
  // Also directly hide all matching elements (belt and suspenders approach)
  await page.evaluate((selectors: readonly string[]) => {
    selectors.forEach((selector) => {
      // Use querySelectorAll to hide ALL matching elements, not just the first
      document.querySelectorAll(selector).forEach((el) => {
        (el as HTMLElement).style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
      });
    });
  }, UI_ELEMENTS_TO_HIDE);
}
