/**
 * Contribution Graph Theme - Time Page Renderer
 *
 * GitHub contribution graph style countdown with pixel-art digits.
 * State and utilities live in utils/ui/state/time-renderer-state.ts.
 */

import type { CelebrationOptions } from '@core/types';
import { shouldEnableAnimations } from '@themes/shared';
import type {
  AnimationStateContext,
  MountContext,
  ResourceTracker,
  TimePageRenderer,
  TimeRemaining,
} from '@themes/shared/types';

import { formatCountdown } from '../utils/grid';
import {
  clearCelebrationVisuals,
  destroyRendererState,
  executeAnimatedCelebration,
  handleRendererAnimationStateChange,
  prepareCelebration,
  resetToCounting,
  showCompletionMessageWithAmbient,
  startCountdownAmbient,
  stopActivity,
} from '../utils/ui/animation';
import {
  createTimePageRendererState,
  isRendererReady,
  setupRendererMount,
  type TimePageRendererState,
  updateActivityPhase,
  updateTimeRendererContainer,
} from '../utils/ui/state';
import { renderDigits } from '../utils/ui/text-rendering';
import { createShadowOverlay, type ShadowOverlayController } from './shadow-overlay';

/** Create a Contribution Graph time page renderer. */
export function contributionGraphTimePageRenderer(_targetDate: Date): TimePageRenderer {
  const state: TimePageRendererState = createTimePageRendererState();
  let shadowOverlay: ShadowOverlayController | null = null;

  return {
    mount(targetContainer: HTMLElement, context?: MountContext): void {
      setupRendererMount(state, targetContainer, context);
      startCountdownAmbient(state);
      shadowOverlay = createShadowOverlay(targetContainer);
    },

    updateTime(time: TimeRemaining): void {
      if (!isRendererReady(state)) return;

      state.lastTime = time;
      updateActivityPhase(state, time);

      const shouldPulse = shouldEnableAnimations(state.getAnimationState);
      const lines = formatCountdown(time.days, time.hours, time.minutes, time.seconds, state.gridState!.cols);
      renderDigits(state.gridState!, lines, shouldPulse);
    },

    onAnimationStateChange(context: AnimationStateContext): void {
      handleRendererAnimationStateChange(state, context);
    },

    onCounting(): void {
      if (!isRendererReady(state)) return;

      prepareCelebration(state);
      stopActivity(state);
      resetToCounting(state.gridState!);
      startCountdownAmbient(state);
    },

    onCelebrating(options?: CelebrationOptions): void {
      if (!isRendererReady(state)) return;

      const message = options?.message?.forTextContent ?? options?.fullMessage ?? '';
      const signal = prepareCelebration(state);

      if (shouldEnableAnimations(state.getAnimationState)) {
        executeAnimatedCelebration(state, message, signal);
      } else {
        stopActivity(state);
        state.completionMessage = message;
        showCompletionMessageWithAmbient(state, message);
      }
    },

    onCelebrated(options?: CelebrationOptions): void {
      if (!isRendererReady(state)) return;

      const message = options?.message?.forTextContent ?? options?.fullMessage ?? '';
      
      prepareCelebration(state);
      stopActivity(state);
      clearCelebrationVisuals(state.gridState!);
      state.completionMessage = message;
      showCompletionMessageWithAmbient(state, message);
    },

    async destroy(): Promise<void> {
      shadowOverlay?.destroy();
      shadowOverlay = null;
      await destroyRendererState(state);
    },

    updateContainer(newContainer: HTMLElement): void {
      updateTimeRendererContainer(state, newContainer);
    },

    getResourceTracker(): ResourceTracker {
      // Expose cleanup handles for validation in tests (e.g., verifying all timers cleared)
      return state.resourceTracker;
    },
  };
}
