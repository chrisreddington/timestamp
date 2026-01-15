/**
 * Sun & Moon Shadow Time Page Renderer
 *
 * A dynamic theme featuring celestial bodies (sun and moon) that orbit
 * across the sky, casting realistic shadows on the countdown digits.
 *
 * Features:
 * - Sun/Moon orbit animation with day/night cycle
 * - Dynamic shadow rotation based on light source position
 * - Twinkling stars at night
 * - Celebration mode with both celestial bodies visible
 *
 * Key patterns: State object, resource tracking, 30fps throttling, pause/resume hooks
 */

import { cancelAll, createResourceTracker, DEFAULT_ANIMATION_STATE, shouldEnableAnimations } from '@themes/shared';
import type {
  AnimationStateContext,
  CelebrationOptions,
  MountContext,
  TimePageRenderer,
  TimeRemaining,
} from '@themes/shared/types';

import type { RendererState } from '../utils/time-page';
import {
  clearContainer,
  handleAnimationStateChange,
  resetToCounting,
  showStaticCelebration,
  startCelebrating,
  startOrbitAnimation,
} from '../utils/time-page';
import { buildThemeDOM, updateCountdown } from '../utils/ui/ui-builder';
import { createShadowOverlay, type ShadowOverlayController } from './shadow-overlay';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default completion message shown at countdown end. */
const DEFAULT_COMPLETION_MESSAGE = '🎉 Time is up!';

// =============================================================================
// RENDERER FACTORY
// =============================================================================

/**
 * Create a Sun & Moon Shadow time page renderer.
 *
 * Features celestial bodies orbiting the sky, casting dynamic shadows
 * on the countdown digits. The shadow direction follows the sun during
 * day and the moon during night.
 *
 * Day/Night cycle:
 * - Day: Sun rises from left, arcs overhead, sets to right
 * - Night: Moon rises from right, arcs overhead, sets to left
 * - Stars twinkle during night phase
 *
 * @param _targetDate - The countdown target date (unused, time comes from updateTime)
 * @returns TimePageRenderer instance for akhil-square-shadow theme
 */
export function akhilSquareShadowTimePageRenderer(_targetDate: Date): TimePageRenderer {
  const state: RendererState = {
    container: null,
    elements: null,
    resourceTracker: createResourceTracker(),
    getAnimationState: () => DEFAULT_ANIMATION_STATE,
    animationPhase: 'idle',
    orbitStartTime: 0,
    lastFrameTime: 0,
    currentBody: 'sun',
    celebrationProgress: 0,
  };
  let shadowOverlay: ShadowOverlayController | null = null;

  return {
    mount(targetContainer: HTMLElement, context?: MountContext): void {
      state.container = targetContainer;
      state.container.setAttribute('data-testid', 'theme-container');

      // Store the getter from orchestrator
      if (context?.getAnimationState) {
        state.getAnimationState = context.getAnimationState;
      }

      // Build theme DOM structure
      state.elements = buildThemeDOM(state.container);

      // Create shadow overlay calculator
      shadowOverlay = createShadowOverlay(state.container);

      // Start orbit animation if allowed
      if (shouldEnableAnimations(state.getAnimationState)) {
        startOrbitAnimation(state);
      }
    },

    updateTime(time: TimeRemaining): void {
      if (state.container === null || state.elements === null) return;

      // Update countdown display
      updateCountdown(state.elements, time.days, time.hours, time.minutes, time.seconds);
    },

    // === LIFECYCLE HOOKS ===

    onAnimationStateChange(_context: AnimationStateContext): void {
      handleAnimationStateChange(state);
    },

    onCounting(): void {
      resetToCounting(state);
    },

    onCelebrating(options?: CelebrationOptions): void {
      const message = options?.message?.forTextContent ?? options?.fullMessage ?? DEFAULT_COMPLETION_MESSAGE;
      startCelebrating(state, message);
    },

    onCelebrated(options?: CelebrationOptions): void {
      const message = options?.message?.forTextContent ?? options?.fullMessage ?? DEFAULT_COMPLETION_MESSAGE;
      showStaticCelebration(state, message);
    },

    async destroy(): Promise<void> {
      shadowOverlay?.destroy();
      shadowOverlay = null;
      cancelAll(state.resourceTracker);
      clearContainer(state);
    },

    updateContainer(newContainer: HTMLElement): void {
      state.container = newContainer;
    },

    getResourceTracker() {
      return state.resourceTracker;
    },
  };
}
