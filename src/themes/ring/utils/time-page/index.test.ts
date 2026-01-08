import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestContainer, removeTestContainer } from '@/test-utils/theme-test-helpers';
import { createResourceTracker, DEFAULT_ANIMATION_STATE } from '@themes/shared';

import type { RendererState } from './index';
import {
  BASE_PULSE_SPEED,
  calculateIntensityLevel,
  clearContainer,
  handleAnimationStateChange,
  INTENSITY_LEVELS,
  isRendererReady,
  resetToCounting,
  showStaticCelebration,
  startCelebrating,
  startPulsingAnimation,
  stopPulsingAnimation,
  TARGET_FRAME_INTERVAL_MS,
  updateIntensity,
} from './index';
import { buildThemeDOM } from '../ui/ui-builder';

describe('Time Page Helpers', () => {
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
      pulseProgress: 0,
      intensityLevel: 'CALM',
      totalSecondsRemaining: Infinity,
      lastFrameTime: 0,
    };
  });

  afterEach(() => {
    removeTestContainer(container);
  });

  describe('Constants', () => {
    it('should export INTENSITY_LEVELS configuration', () => {
      expect(INTENSITY_LEVELS.CALM).toBeDefined();
      expect(INTENSITY_LEVELS.BUILDING).toBeDefined();
      expect(INTENSITY_LEVELS.INTENSE).toBeDefined();
      expect(INTENSITY_LEVELS.FINALE).toBeDefined();
    });

    it('should export BASE_PULSE_SPEED', () => {
      expect(BASE_PULSE_SPEED).toBe(0.002);
    });

    it('should export TARGET_FRAME_INTERVAL_MS', () => {
      expect(TARGET_FRAME_INTERVAL_MS).toBe(33);
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

  describe('calculateIntensityLevel', () => {
    it('should return CALM for times > 60 seconds', () => {
      expect(calculateIntensityLevel(120)).toBe('CALM');
      expect(calculateIntensityLevel(61)).toBe('CALM');
    });

    it('should return BUILDING for times between 30-60 seconds', () => {
      expect(calculateIntensityLevel(60)).toBe('BUILDING');
      expect(calculateIntensityLevel(45)).toBe('BUILDING');
      expect(calculateIntensityLevel(31)).toBe('BUILDING');
    });

    it('should return INTENSE for times between 10-30 seconds', () => {
      expect(calculateIntensityLevel(30)).toBe('INTENSE');
      expect(calculateIntensityLevel(20)).toBe('INTENSE');
      expect(calculateIntensityLevel(11)).toBe('INTENSE');
    });

    it('should return FINALE for times <= 10 seconds', () => {
      expect(calculateIntensityLevel(10)).toBe('FINALE');
      expect(calculateIntensityLevel(5)).toBe('FINALE');
      expect(calculateIntensityLevel(0)).toBe('FINALE');
    });
  });

  describe('updateIntensity', () => {
    it('should update totalSecondsRemaining', () => {
      updateIntensity(state, 45000); // 45 seconds
      expect(state.totalSecondsRemaining).toBe(45);
    });

    it('should update intensityLevel when level changes', () => {
      updateIntensity(state, 120000); // 2 minutes = CALM
      expect(state.intensityLevel).toBe('CALM');

      updateIntensity(state, 45000); // 45 seconds = BUILDING
      expect(state.intensityLevel).toBe('BUILDING');
    });

    it('should update dataset.intensity on pulsing ring', () => {
      updateIntensity(state, 45000); // BUILDING
      expect(state.elements?.pulsingRing.dataset.intensity).toBe('building');
    });

    it('should not update dataset if intensity level stays the same', () => {
      updateIntensity(state, 120000); // CALM
      const dataset1 = state.elements?.pulsingRing.dataset.intensity;

      updateIntensity(state, 90000); // Still CALM
      const dataset2 = state.elements?.pulsingRing.dataset.intensity;

      expect(dataset1).toBe(dataset2);
      expect(dataset2).toBe('calm');
    });
  });

  describe('clearContainer', () => {
    it('should remove all children from container', () => {
      clearContainer(state);
      expect(container.children.length).toBe(0);
    });

    it('should reset container to null', () => {
      clearContainer(state);
      expect(state.container).toBeNull();
    });

    it('should reset elements to null', () => {
      clearContainer(state);
      expect(state.elements).toBeNull();
    });

    it('should set animationPhase to idle', () => {
      state.animationPhase = 'pulsing';
      clearContainer(state);
      expect(state.animationPhase).toBe('idle');
    });
  });

  describe('Animation Control', () => {
    it('should start pulsing animation when called', () => {
      startPulsingAnimation(state);
      expect(state.animationPhase).toBe('pulsing');
    });

    it('should not start pulsing if already pulsing', () => {
      startPulsingAnimation(state);
      const phase1 = state.animationPhase;
      startPulsingAnimation(state);
      expect(state.animationPhase).toBe(phase1);
    });

    it('should stop pulsing animation', () => {
      startPulsingAnimation(state);
      stopPulsingAnimation(state);
      expect(state.animationPhase).toBe('idle');
      expect(state.pulseProgress).toBe(0);
    });

    it('should not error when stopping if not pulsing', () => {
      expect(() => stopPulsingAnimation(state)).not.toThrow();
    });
  });

  describe('handleAnimationStateChange', () => {
    it('should start animation when shouldAnimate becomes true', () => {
      state.getAnimationState = () => ({ shouldAnimate: true, prefersReducedMotion: false });
      handleAnimationStateChange(state);
      expect(state.animationPhase).toBe('pulsing');
    });

    it('should stop animation when shouldAnimate becomes false', () => {
      startPulsingAnimation(state);
      state.getAnimationState = () => ({ shouldAnimate: false, prefersReducedMotion: true });
      handleAnimationStateChange(state);
      expect(state.animationPhase).toBe('idle');
    });

    it('should not error when renderer not ready', () => {
      state.container = null;
      expect(() => handleAnimationStateChange(state)).not.toThrow();
    });
  });

  describe('Lifecycle Helpers', () => {
    describe('resetToCounting', () => {
      it('should reset intensity to CALM', () => {
        state.intensityLevel = 'FINALE';
        state.totalSecondsRemaining = 5;
        resetToCounting(state);
        expect(state.intensityLevel).toBe('CALM');
        expect(state.totalSecondsRemaining).toBe(Infinity);
      });

      it('should set animationPhase to idle initially', () => {
        startPulsingAnimation(state);
        resetToCounting(state);
        // Will be idle initially, then restart if animations allowed
        expect(['idle', 'pulsing']).toContain(state.animationPhase);
      });

      it('should show countdown display', () => {
        const celebration = state.elements?.celebration;
        if (celebration) celebration.hidden = false;

        resetToCounting(state);

        expect(state.elements?.countdown.hidden).toBe(false);
        expect(celebration?.hidden).toBe(true);
      });
    });

    describe('startCelebrating', () => {
      it('should switch to celebrating phase', () => {
        startCelebrating(state, 'Test Message');
        expect(state.animationPhase).toBe('celebrating');
      });

      it('should show celebration message', () => {
        startCelebrating(state, 'Happy New Year!');
        expect(state.elements?.celebration.textContent).toBe('Happy New Year!');
        expect(state.elements?.celebration.hidden).toBe(false);
      });

      it('should hide countdown display', () => {
        startCelebrating(state, 'Done!');
        expect(state.elements?.countdown.hidden).toBe(true);
      });
    });

    describe('showStaticCelebration', () => {
      it('should set animationPhase to idle', () => {
        state.animationPhase = 'pulsing';
        showStaticCelebration(state, 'Static');
        expect(state.animationPhase).toBe('idle');
      });

      it('should show celebration message', () => {
        showStaticCelebration(state, 'Static Message');
        expect(state.elements?.celebration.textContent).toBe('Static Message');
        expect(state.elements?.celebration.hidden).toBe(false);
      });
    });
  });
});
