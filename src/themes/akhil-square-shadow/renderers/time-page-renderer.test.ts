import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestContainer, removeTestContainer } from '@/test-utils/theme-test-helpers';
import type { AnimationStateContext, MountContext } from '@themes/shared/types';

import { akhilSquareShadowTimePageRenderer } from './time-page-renderer';

/** Creates a mock MountContext with the given animation state. */
function createMockMountContext(state: Partial<AnimationStateContext> = {}): MountContext {
  const animationState: AnimationStateContext = {
    shouldAnimate: state.shouldAnimate ?? true,
    prefersReducedMotion: state.prefersReducedMotion ?? false,
    reason: state.reason,
  };
  return { getAnimationState: () => animationState };
}

describe('Sun & Moon Shadow Time Page Renderer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createTestContainer();
  });

  afterEach(() => {
    removeTestContainer(container);
  });

  describe('mount', () => {
    it('should mount successfully with countdown display', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      expect(container.querySelector('[data-testid="countdown-display"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="celebration-message"]')).toBeTruthy();
    });

    it('should create sun element', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      expect(container.querySelector('.shadow-theme-sun')).toBeTruthy();
    });

    it('should create moon element', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      expect(container.querySelector('.shadow-theme-moon')).toBeTruthy();
    });

    it('should create stars element', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      expect(container.querySelector('.shadow-theme-stars')).toBeTruthy();
    });

    it('should create sky element', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      expect(container.querySelector('.shadow-theme-sky')).toBeTruthy();
    });

    it('should set data-testid on container', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      expect(container.getAttribute('data-testid')).toBe('theme-container');
    });

    it('should have celebration message hidden by default', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      const celebrationEl = container.querySelector('[data-testid="celebration-message"]') as HTMLElement;
      expect(celebrationEl?.hidden).toBe(true);
    });

    it('should accept MountContext with animation state getter', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      const context = createMockMountContext({ shouldAnimate: false, prefersReducedMotion: true });
      expect(() => {
        theme.mount(container, context);
      }).not.toThrow();
    });
  });

  describe('updateTime', () => {
    it('should update countdown display values', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      theme.updateTime({ days: 5, hours: 12, minutes: 30, seconds: 45, total: 500000000 });
      const daysEl = container.querySelector('[data-testid="countdown-days"] .shadow-value');
      const hoursEl = container.querySelector('[data-testid="countdown-hours"] .shadow-value');
      const minsEl = container.querySelector('[data-testid="countdown-minutes"] .shadow-value');
      const secsEl = container.querySelector('[data-testid="countdown-seconds"] .shadow-value');
      expect(daysEl?.textContent).toBe('05');
      expect(hoursEl?.textContent).toBe('12');
      expect(minsEl?.textContent).toBe('30');
      expect(secsEl?.textContent).toBe('45');
    });

    it('should handle zero values with padding', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      theme.updateTime({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
      const daysEl = container.querySelector('[data-testid="countdown-days"] .shadow-value');
      const secsEl = container.querySelector('[data-testid="countdown-seconds"] .shadow-value');
      expect(daysEl?.textContent).toBe('00');
      expect(secsEl?.textContent).toBe('00');
    });
  });

  describe('onAnimationStateChange', () => {
    it('should handle animation being paused', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      expect(() => {
        theme.onAnimationStateChange({ shouldAnimate: false, prefersReducedMotion: false, reason: 'page-hidden' });
      }).not.toThrow();
    });

    it('should handle animation being resumed', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      const context = createMockMountContext({ shouldAnimate: false });
      theme.mount(container, context);
      expect(() => {
        theme.onAnimationStateChange({ shouldAnimate: true, prefersReducedMotion: false });
      }).not.toThrow();
    });

    it('should handle reduced motion preference changes', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      expect(() => {
        theme.onAnimationStateChange({ shouldAnimate: true, prefersReducedMotion: true, reason: 'reduced-motion' });
      }).not.toThrow();
    });
  });

  describe('lifecycle hooks', () => {
    it('should show celebration when onCelebrating is called', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      theme.onCelebrating({ message: { forTextContent: 'Done!', forInnerHTML: 'Done!' }, fullMessage: 'Done!' });
      const celebrationEl = container.querySelector('[data-testid="celebration-message"]') as HTMLElement;
      expect(celebrationEl?.textContent).toBe('Done!');
      expect(celebrationEl?.hidden).toBe(false);
    });

    it('should add celebrating class to root when celebrating', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      theme.onCelebrating({ message: { forTextContent: 'Done!', forInnerHTML: 'Done!' }, fullMessage: 'Done!' });
      const root = container.querySelector('.akhil-square-shadow-theme');
      expect(root?.classList.contains('is-celebrating')).toBe(true);
    });

    it('should hide countdown when celebrating', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      theme.onCelebrating({ message: { forTextContent: 'Done!', forInnerHTML: 'Done!' }, fullMessage: 'Done!' });
      const countdownEl = container.querySelector('[data-testid="countdown-display"]') as HTMLElement;
      expect(countdownEl?.hidden).toBe(true);
    });

    it('should show both sun and moon during celebration', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      theme.onCelebrating({ message: { forTextContent: 'Done!', forInnerHTML: 'Done!' }, fullMessage: 'Done!' });
      const sun = container.querySelector('.shadow-theme-sun');
      const moon = container.querySelector('.shadow-theme-moon');
      expect(sun?.classList.contains('is-hidden')).toBe(false);
      expect(moon?.classList.contains('is-hidden')).toBe(false);
    });

    it('should reset celebration UI when onCounting is called', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      theme.onCelebrating({ message: { forTextContent: 'Done!', forInnerHTML: 'Done!' }, fullMessage: 'Done!' });
      theme.onCounting();
      const celebrationEl = container.querySelector('[data-testid="celebration-message"]') as HTMLElement;
      expect(celebrationEl?.hidden).toBe(true);
      const countdownEl = container.querySelector('[data-testid="countdown-display"]') as HTMLElement;
      expect(countdownEl?.hidden).toBe(false);
    });

    it('should remove celebrating class from root when counting', () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      theme.onCelebrating({ message: { forTextContent: 'Done!', forInnerHTML: 'Done!' }, fullMessage: 'Done!' });
      theme.onCounting();
      const root = container.querySelector('.akhil-square-shadow-theme');
      expect(root?.classList.contains('is-celebrating')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean up all resources on destroy', async () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      await theme.destroy();
      const tracker = theme.getResourceTracker();
      expect(tracker.intervals).toHaveLength(0);
      expect(tracker.timeouts).toHaveLength(0);
      expect(tracker.rafs).toHaveLength(0);
      expect(tracker.observers).toHaveLength(0);
      expect(tracker.listeners).toHaveLength(0);
    });

    it('should clear container on destroy', async () => {
      const theme = akhilSquareShadowTimePageRenderer(new Date());
      theme.mount(container);
      await theme.destroy();
      expect(container.children.length).toBe(0);
    });
  });
});
