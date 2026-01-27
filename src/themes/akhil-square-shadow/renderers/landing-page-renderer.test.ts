import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AnimationStateContext } from '@themes/shared/types';

import { akhilSquareShadowLandingPageRenderer } from './landing-page-renderer';
import { createThemeTestContainer, mountLandingPageRenderer } from '../test-utils';

describe('AkhilSquareShadow Landing Page Renderer', () => {
  let container: HTMLElement;
  let cleanup: () => void;

  beforeEach(() => {
    const testContainer = createThemeTestContainer();
    container = testContainer.container;
    cleanup = testContainer.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  describe('mount', () => {
    it('should create background element', () => {
      const renderer = mountLandingPageRenderer(container);
      expect(container.children.length).toBeGreaterThan(0);
      renderer.destroy();
    });

    it('should set aria-hidden on background', () => {
      const renderer = mountLandingPageRenderer(container);
      // aria-hidden is set on the container itself (not a child wrapper)
      expect(container.getAttribute('aria-hidden')).toBe('true');
      renderer.destroy();
    });

    it('should not mount twice', () => {
      const renderer = akhilSquareShadowLandingPageRenderer(container);
      renderer.mount(container);
      const childCount = container.children.length;
      renderer.mount(container); // Second mount should be ignored
      expect(container.children.length).toBe(childCount);
      renderer.destroy();
    });
  });

  describe('destroy', () => {
    it('should clean up all elements', () => {
      const renderer = akhilSquareShadowLandingPageRenderer(container);
      renderer.mount(container);
      renderer.destroy();
      expect(container.children.length).toBe(0);
    });

    it('should be safe to call multiple times', () => {
      const renderer = akhilSquareShadowLandingPageRenderer(container);
      renderer.mount(container);
      renderer.destroy();
      expect(() => renderer.destroy()).not.toThrow();
    });
  });

  describe('setSize', () => {
    it('should handle size updates', () => {
      const renderer = mountLandingPageRenderer(container);
      expect(() => {
        renderer.setSize(800, 600);
      }).not.toThrow();
      renderer.destroy();
    });
  });

  describe('onAnimationStateChange', () => {
    it('should handle animation being paused', () => {
      const renderer = mountLandingPageRenderer(container);
      const context: AnimationStateContext = { shouldAnimate: false, prefersReducedMotion: false, reason: 'page-hidden' };
      expect(() => {
        renderer.onAnimationStateChange(context);
      }).not.toThrow();
      renderer.destroy();
    });

    it('should handle reduced motion preference', () => {
      const renderer = mountLandingPageRenderer(container);
      const context: AnimationStateContext = { shouldAnimate: true, prefersReducedMotion: true, reason: 'reduced-motion' };
      expect(() => {
        renderer.onAnimationStateChange(context);
      }).not.toThrow();
      renderer.destroy();
    });
  });

  describe('getElementCount', () => {
    it('should return element counts', () => {
      const renderer = mountLandingPageRenderer(container);
      const counts = renderer.getElementCount();
      expect(counts).toHaveProperty('total');
      expect(counts).toHaveProperty('animated');
      expect(typeof counts.total).toBe('number');
      expect(typeof counts.animated).toBe('number');
      renderer.destroy();
    });

    it('should report zero animated elements when destroyed', () => {
      const renderer = mountLandingPageRenderer(container);
      renderer.destroy();
      const counts = renderer.getElementCount();
      expect(counts.animated).toBe(0);
    });
  });
});
