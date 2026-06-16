import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestContainer, removeTestContainer } from '@/test-utils/theme-test-helpers';

import { chrisreddingtonLandingPageRenderer } from './landing-page-renderer';

describe('chrisreddington landing renderer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createTestContainer('chrisreddington-landing-renderer-test');
  });

  afterEach(() => {
    removeTestContainer(container);
  });

  it('mounts ambient prompt and cursor elements', () => {
    const renderer = chrisreddingtonLandingPageRenderer(container);
    renderer.mount(container, { getAnimationState: () => ({ shouldAnimate: true, prefersReducedMotion: false }) });

    expect(container.querySelector('.chrisreddington-landing-line')).toBeTruthy();
    expect(renderer.getElementCount()).toEqual({ total: 2, animated: 1 });
  });

  it('disables breathing under reduced-motion', () => {
    const renderer = chrisreddingtonLandingPageRenderer(container);
    renderer.mount(container);
    renderer.onAnimationStateChange({ shouldAnimate: true, prefersReducedMotion: true, reason: 'reduced-motion' });

    expect(container.querySelector('.chrisreddington-landing-line')?.classList.contains('is-breathing')).toBe(false);
    expect(renderer.getElementCount()).toEqual({ total: 2, animated: 0 });
  });

  it('positions ambient line below exclusion element when center is blocked', () => {
    const exclusionElement = document.createElement('div');
    const renderer = chrisreddingtonLandingPageRenderer(container);

    container.getBoundingClientRect = () =>
      ({ top: 0, left: 0, right: 1000, bottom: 700, width: 1000, height: 700, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    exclusionElement.getBoundingClientRect = () =>
      ({
        top: 220,
        left: 200,
        right: 800,
        bottom: 500,
        width: 600,
        height: 280,
        x: 200,
        y: 220,
        toJSON: () => ({}),
      }) as DOMRect;

    renderer.mount(container, {
      getAnimationState: () => ({ shouldAnimate: true, prefersReducedMotion: false }),
      exclusionElement,
    });
    renderer.setSize(1000, 700);

    expect((container.querySelector('.chrisreddington-landing-line') as HTMLElement).style.top).toBe('360px');
  });
});
