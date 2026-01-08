/**
 * Ring Time Page Renderer
 *
 * Pulsing ring animation that intensifies as countdown approaches zero.
 *
 * Intensity levels: CALM (\>60s) → BUILDING (30-60s) → INTENSE (10-30s) → FINALE (\<10s)
 * Celebration: Traveling light effect around ring circumference
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
  startPulsingAnimation,
  updateIntensity,
} from '../utils/time-page';
import { buildThemeDOM, updateCountdown } from '../utils/ui/ui-builder';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default completion message shown at countdown end. */
const DEFAULT_COMPLETION_MESSAGE = '🎉 Happy New Year!';

// =============================================================================
// RENDERER FACTORY
// =============================================================================

/**
 * Create a Ring time page renderer.
 *
 * Features a pulsing ring animation that intensifies as countdown approaches zero:
 * - CALM (\>60s): Slow, gentle pulse
 * - BUILDING (30-60s): Faster pulse, increased glow
 * - INTENSE (10-30s): Rapid pulse, dramatic glow
 * - FINALE (\<10s): Maximum intensity
 *
 * On celebration, a light travels around the ring creating a dynamic effect.
 *
 * @param _targetDate - The countdown target date (unused, time comes from updateTime)
 * @returns TimePageRenderer instance for ring theme
 */
export function ringTimePageRenderer(_targetDate: Date): TimePageRenderer {
  const state: RendererState = {
    container: null,
    elements: null,
    resourceTracker: createResourceTracker(),
    getAnimationState: () => DEFAULT_ANIMATION_STATE,
    animationPhase: 'idle',
    pulseProgress: 0,
    intensityLevel: 'CALM',
    totalSecondsRemaining: Infinity,
    lastFrameTime: 0,
  };

  return {
    mount(targetContainer: HTMLElement, context?: MountContext): void {
      state.container = targetContainer;
      state.container.setAttribute('data-testid', 'theme-container');

      // Store the getter from orchestrator (call it to get current state, never cache)
      if (context?.getAnimationState) {
        state.getAnimationState = context.getAnimationState;
      }

      // Build theme DOM structure
      state.elements = buildThemeDOM(state.container);

      // Start animation if allowed
      if (shouldEnableAnimations(state.getAnimationState)) {
        startPulsingAnimation(state);
      }
    },

    updateTime(time: TimeRemaining): void {
      // Only called during COUNTING state by orchestrator
      if (state.container === null || state.elements === null) return;

      // Update intensity based on time remaining
      updateIntensity(state, time.total);

      // Update countdown display
      updateCountdown(state.elements, time.days, time.hours, time.minutes, time.seconds);
    },

    // === LIFECYCLE HOOKS ===

    onAnimationStateChange(_context: AnimationStateContext): void {
      // Orchestrator notifies us state changed - update our local animation
      handleAnimationStateChange(state);
    },

    onCounting(): void {
      // Called when entering COUNTING state (e.g., timezone switch)
      resetToCounting(state);
    },

    onCelebrating(options?: CelebrationOptions): void {
      // Called when timer hits zero - show celebration with traveling light
      const message = options?.message?.forTextContent ?? options?.fullMessage ?? DEFAULT_COMPLETION_MESSAGE;
      startCelebrating(state, message);
    },

    onCelebrated(options?: CelebrationOptions): void {
      // Called when entering CELEBRATED state without animation (e.g., TZ switch)
      const message = options?.message?.forTextContent ?? options?.fullMessage ?? DEFAULT_COMPLETION_MESSAGE;
      showStaticCelebration(state, message);
    },

    async destroy(): Promise<void> {
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
