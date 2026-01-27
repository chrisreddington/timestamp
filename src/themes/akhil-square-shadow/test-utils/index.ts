/**
 * Test helpers for akhil-square-shadow theme tests.
 */



import type { LandingPageRenderer } from '@themes/shared/types';

import { createTestContainer, removeTestContainer } from '@/test-utils/theme-test-helpers';

import { akhilSquareShadowLandingPageRenderer } from '../renderers/landing-page-renderer';

interface ThemeTestContainer {
  container: HTMLElement;
  cleanup: () => void;
}

/**
 * Create a DOM container for theme tests.
 *
 * @returns Container element and cleanup function
 * @internal
 */
export function createThemeTestContainer(id = 'akhil-square-shadow-test-container'): ThemeTestContainer {
  const container = createTestContainer(id);
  return {
    container,
    cleanup: () => removeTestContainer(container),
  };
}

/**
 * Mount a landing page renderer into the container.
 *
 * @param container - Container element to mount into
 * @returns Mounted landing page renderer
 * @internal
 */
export function mountLandingPageRenderer(container: HTMLElement): LandingPageRenderer {
  const renderer = akhilSquareShadowLandingPageRenderer(container);
  renderer.mount(container);
  return renderer;
}
