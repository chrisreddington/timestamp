import type { LandingPageRenderer } from '@core/types';

import { createTestContainer, removeTestContainer } from '@/test-utils/theme-test-helpers';

import { chrisreddingtonLandingPageRenderer } from '../renderers/landing-page-renderer';

export function createThemeTestContainer(id = 'chrisreddington-test-container'): {
  container: HTMLElement;
  cleanup: () => void;
} {
  const container = createTestContainer(id);
  return {
    container,
    cleanup: () => removeTestContainer(container),
  };
}

export function mountLandingPageRenderer(container: HTMLElement): LandingPageRenderer {
  const renderer = chrisreddingtonLandingPageRenderer(container);
  renderer.mount(container);
  return renderer;
}
