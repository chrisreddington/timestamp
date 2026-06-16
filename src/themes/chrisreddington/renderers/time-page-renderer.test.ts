import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestContainer, removeTestContainer } from '@/test-utils/theme-test-helpers';

import { chrisreddingtonTimePageRenderer } from './time-page-renderer';

describe('chrisreddington time-page renderer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createTestContainer('chrisreddington-renderer-test');
  });

  afterEach(async () => {
    vi.useRealTimers();
    removeTestContainer(container);
  });

  it('mounts with required countdown selectors', () => {
    const renderer = chrisreddingtonTimePageRenderer(new Date());
    renderer.mount(container, { getAnimationState: () => ({ shouldAnimate: true, prefersReducedMotion: false }) });

    expect(container.getAttribute('data-testid')).toBe('theme-container');
    expect(container.querySelector('[data-testid="countdown-display"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="countdown-days"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="countdown-hours"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="countdown-minutes"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="countdown-seconds"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="celebration-message"]')).toBeTruthy();
    expect(container.querySelector('.chrisreddington-value-group')?.classList.contains('value--numeric')).toBe(true);
    expect(container.querySelector('.chrisreddington-transition-text')?.classList.contains('value--word')).toBe(true);
  });

  it('updates countdown digits with zero-padded values', () => {
    const renderer = chrisreddingtonTimePageRenderer(new Date());
    renderer.mount(container);
    renderer.updateTime({ days: 4, hours: 3, minutes: 2, seconds: 1, total: 1000 });

    expect(container.querySelector('[data-testid="countdown-days"]')?.textContent).toBe('04');
    expect(container.querySelector('[data-testid="countdown-hours"]')?.textContent).toBe('03');
    expect(container.querySelector('[data-testid="countdown-minutes"]')?.textContent).toBe('02');
    expect(container.querySelector('[data-testid="countdown-seconds"]')?.textContent).toBe('01');
  });

  it('snaps directly to resting state on onCelebrated', () => {
    const renderer = chrisreddingtonTimePageRenderer(new Date());
    renderer.mount(container);
    renderer.onCelebrated();

    expect(container.querySelector('[data-testid="countdown-display"]')?.getAttribute('data-layout')).toBe('resting');
  });

  it('aborts celebration and returns to counting when onCounting is called', async () => {
    vi.useFakeTimers();

    const renderer = chrisreddingtonTimePageRenderer(new Date());
    renderer.mount(container, { getAnimationState: () => ({ shouldAnimate: true, prefersReducedMotion: false }) });
    renderer.updateTime({ days: 0, hours: 0, minutes: 0, seconds: 5, total: 5000 });
    renderer.onCelebrating();
    await vi.advanceTimersByTimeAsync(110);
    renderer.onCounting();

    expect(container.querySelector('[data-testid="countdown-display"]')?.getAttribute('data-layout')).toBe(
      'counting'
    );
  });

  it('cleans tracked resources on destroy', async () => {
    const renderer = chrisreddingtonTimePageRenderer(new Date());
    renderer.mount(container);
    await renderer.destroy();

    const tracker = renderer.getResourceTracker();
    expect(tracker.timeouts).toEqual([]);
    expect(tracker.intervals).toEqual([]);
    expect(container.children.length).toBe(0);
  });
});
