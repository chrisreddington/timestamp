import { describe, expect, it } from 'vitest';

import {
  createLandingAmbient,
  positionLandingAmbient,
  updateLandingAmbientMotion,
} from './ambient';

function mockRect(element: HTMLElement, rect: DOMRectInit): void {
  element.getBoundingClientRect = () =>
    ({
      x: rect.x ?? 0,
      y: rect.y ?? 0,
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      top: rect.top ?? 0,
      left: rect.left ?? 0,
      right: rect.right ?? 0,
      bottom: rect.bottom ?? 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe('landing ambient helpers', () => {
  it('creates a single faint prompt line', () => {
    const container = document.createElement('div');
    const elements = createLandingAmbient(container);

    expect(container.children).toHaveLength(1);
    expect(elements.line.querySelector('.chrisreddington-chevron-icon')).toBeTruthy();
    expect(elements.line.querySelector('.chrisreddington-cursor')).toBeTruthy();
  });

  it('toggles breathing based on animation state', () => {
    const container = document.createElement('div');
    const elements = createLandingAmbient(container);

    updateLandingAmbientMotion(elements, () => ({ shouldAnimate: true, prefersReducedMotion: false }));
    expect(elements.line.classList.contains('is-breathing')).toBe(true);

    updateLandingAmbientMotion(elements, () => ({ shouldAnimate: true, prefersReducedMotion: true }));
    expect(elements.line.classList.contains('is-breathing')).toBe(false);
  });

  it('shifts line below exclusion card when center is blocked', () => {
    const container = document.createElement('div');
    const exclusionElement = document.createElement('div');
    const elements = createLandingAmbient(container);

    mockRect(container, { top: 0, left: 0, width: 1000, height: 700, right: 1000, bottom: 700 });
    mockRect(exclusionElement, { top: 240, left: 200, width: 600, height: 280, right: 800, bottom: 520 });

    positionLandingAmbient(elements, container, exclusionElement);

    expect(elements.line.style.top).toBe('380px');
  });
});
