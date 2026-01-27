import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestContainer, removeTestContainer } from '@/test-utils/theme-test-helpers';
import { createResourceTracker, DEFAULT_ANIMATION_STATE } from '@themes/shared';

import type { RendererState } from './index';
import {
  calculateOrbitState,
  clearContainer,
  getLightSourcePosition,
  HALF_CYCLE_MS,
  handleAnimationStateChange,
  isRendererReady,
  resetToCounting,
  showStaticCelebration,
  startCelebrating,
  startOrbitAnimation,
  stopOrbitAnimation,
  TARGET_FRAME_INTERVAL_MS,
} from './index';
import { buildThemeDOM } from '../ui/ui-builder';

describe('Time Page Helpers - Sun & Moon Shadow Theme', () => {
  let container: HTMLElement;
  let state: RendererState;

  beforeEach(() => {
    container = createTestContainer();
    const elements = buildThemeDOM(container);

    state = {
      container,
      elements,
      resourceTracker: createResourceTracker(),
      getAnimationState: () => DEFAULT_ANIMATION_STATE,
      animationPhase: 'idle',
      orbitStartTime: 0,
      lastFrameTime: 0,
      currentBody: 'sun',
      celebrationProgress: 0,
    };
  });

  afterEach(() => {
    removeTestContainer(container);
  });

  describe('Constants', () => {
    it('should export TARGET_FRAME_INTERVAL_MS for throttling', () => {
      expect(TARGET_FRAME_INTERVAL_MS).toBe(33);
    });

    it('should export HALF_CYCLE_MS for day/night duration', () => {
      expect(HALF_CYCLE_MS).toBeGreaterThan(0);
    });
  });

  describe('isRendererReady', () => {
    it('should return true when container and elements are present', () => {
      expect(isRendererReady(state)).toBe(true);
    });

    it('should return false when container is null', () => {
      state.container = null;
      expect(isRendererReady(state)).toBe(false);
    });

    it('should return false when elements are null', () => {
      state.elements = null;
      expect(isRendererReady(state)).toBe(false);
    });
  });

  describe('calculateOrbitState', () => {
    it('should return sun as active body in first half of cycle', () => {
      const result = calculateOrbitState(0);
      expect(result.activeBody).toBe('sun');
      expect(result.isNight).toBe(false);
    });

    it('should return moon as active body in second half of cycle', () => {
      const result = calculateOrbitState(HALF_CYCLE_MS + 1000);
      expect(result.activeBody).toBe('moon');
      expect(result.isNight).toBe(true);
    });

    it('should return progress 0 at start of sun cycle', () => {
      const result = calculateOrbitState(0);
      expect(result.progress).toBe(0);
    });

    it('should return progress near 0.5 at mid-day', () => {
      const result = calculateOrbitState(HALF_CYCLE_MS / 2);
      expect(result.progress).toBeCloseTo(0.5, 1);
    });

    it('should cycle back to sun after full orbit', () => {
      const fullCycle = HALF_CYCLE_MS * 2;
      const result = calculateOrbitState(fullCycle + 100);
      expect(result.activeBody).toBe('sun');
    });
  });

  describe('getLightSourcePosition', () => {
    it('should return position for sun at sunrise (left side)', () => {
      const pos = getLightSourcePosition(0, 'sun');
      expect(pos.x).toBeLessThan(50); // Left of center
    });

    it('should return position for sun at noon (center)', () => {
      const pos = getLightSourcePosition(0.5, 'sun');
      expect(pos.x).toBeCloseTo(50, 0); // Near center
    });

    it('should return position for sun at sunset (right side)', () => {
      const pos = getLightSourcePosition(1, 'sun');
      expect(pos.x).toBeGreaterThan(50); // Right of center
    });

    it('should return position for moon at moonrise (right side)', () => {
      const pos = getLightSourcePosition(0, 'moon');
      expect(pos.x).toBeGreaterThan(50); // Right of center
    });

    it('should return position for moon at midnight (center)', () => {
      const pos = getLightSourcePosition(0.5, 'moon');
      expect(pos.x).toBeCloseTo(50, 0); // Near center
    });
  });

  describe('Animation Control', () => {
    it('should start orbit animation and set phase', () => {
      startOrbitAnimation(state);
      expect(state.animationPhase).toBe('orbiting');
    });

    it('should not restart if already orbiting', () => {
      startOrbitAnimation(state);
      const startTime = state.orbitStartTime;
      startOrbitAnimation(state);
      expect(state.orbitStartTime).toBe(startTime);
    });

    it('should stop orbit animation', () => {
      startOrbitAnimation(state);
      stopOrbitAnimation(state);
      expect(state.animationPhase).toBe('idle');
    });

    it('should not stop if not orbiting', () => {
      state.animationPhase = 'celebrating';
      stopOrbitAnimation(state);
      expect(state.animationPhase).toBe('celebrating');
    });
  });

  describe('handleAnimationStateChange', () => {
    it('should start orbiting when animations allowed and idle', () => {
      state.getAnimationState = () => ({
        shouldAnimate: true,
        prefersReducedMotion: false,
      });
      handleAnimationStateChange(state);
      expect(state.animationPhase).toBe('orbiting');
    });

    it('should not change phase if not ready', () => {
      state.container = null;
      handleAnimationStateChange(state);
      expect(state.animationPhase).toBe('idle');
    });
  });

  describe('Lifecycle Helpers', () => {
    describe('resetToCounting', () => {
      it('should reset to counting state', () => {
        state.animationPhase = 'celebrating';
        state.celebrationProgress = 0.5;
        // Disable animations to test idle state
        state.getAnimationState = () => ({
          shouldAnimate: false,
          prefersReducedMotion: false,
        });
        resetToCounting(state);
        expect(state.animationPhase).toBe('idle');
        expect(state.celebrationProgress).toBe(0);
      });

      it('should start orbiting when animations enabled', () => {
        state.animationPhase = 'celebrating';
        state.getAnimationState = () => ({
          shouldAnimate: true,
          prefersReducedMotion: false,
        });
        resetToCounting(state);
        expect(state.animationPhase).toBe('orbiting');
      });

      it('should show countdown display', () => {
        resetToCounting(state);
        expect(state.elements!.countdown.hidden).toBe(false);
        expect(state.elements!.celebration.hidden).toBe(true);
      });
    });

    describe('startCelebrating', () => {
      it('should switch to celebrating phase', () => {
        startCelebrating(state, 'Test Message');
        expect(state.animationPhase).toBe('celebrating');
      });

      it('should show celebration message', () => {
        startCelebrating(state, 'Happy New Year!');
        expect(state.elements!.celebration.textContent).toBe('Happy New Year!');
        expect(state.elements!.celebration.hidden).toBe(false);
      });

      it('should hide countdown during celebration', () => {
        startCelebrating(state, 'Test');
        expect(state.elements!.countdown.hidden).toBe(true);
      });

      it('should show both celestial bodies during celebration', () => {
        startCelebrating(state, 'Test');
        expect(state.elements!.sun.classList.contains('is-hidden')).toBe(false);
        expect(state.elements!.moon.classList.contains('is-hidden')).toBe(false);
      });
    });

    describe('showStaticCelebration', () => {
      it('should show static celebration without animation', () => {
        showStaticCelebration(state, 'Static Message');
        expect(state.animationPhase).toBe('idle');
        expect(state.elements!.celebration.textContent).toBe('Static Message');
      });
    });
  });

  describe('Cleanup', () => {
    describe('clearContainer', () => {
      it('should clear container contents', () => {
        clearContainer(state);
        expect(state.container).toBe(null);
        expect(state.elements).toBe(null);
      });

      it('should reset animation phase', () => {
        state.animationPhase = 'orbiting';
        clearContainer(state);
        expect(state.animationPhase).toBe('idle');
      });

      it('should handle already null container', () => {
        state.container = null;
        expect(() => clearContainer(state)).not.toThrow();
      });
    });
  });
});
