import type {
  AnimationStateContext,
  CelebrationOptions,
  MountContext,
  ResourceTracker,
  TimePageRenderer,
  TimeRemaining,
} from '@core/types';
import { cancelAll, shouldEnableAnimations } from '@themes/shared';

import { cancelCelebrationSequence, runCelebrationSequence } from '../utils/time-page/celebration-sequence';
import { updateCountdownDigits } from '../utils/time-page/digit-flick';
import {
  type ChrisReddingtonTimePageState,
  createTimePageRendererState,
  isTimePageRendererReady,
  setCelebrationPhase,
} from '../utils/time-page/state';
import {
  buildChrisReddingtonTimePageUI,
  clearRestingPromptAlignment,
  setAnimationPlayback,
  setCelebrationMessage,
  setCenteringTransition,
  setCursorBlinking,
  setDisplayLayout,
  setRestingFontVariant,
  setTransitionText,
  setupInkCentering,
  updateRestingPromptAlignment,
} from '../utils/ui/ui-builder';

function mountRendererState(
  state: ChrisReddingtonTimePageState,
  container: HTMLElement,
  context?: MountContext
): void {
  state.container = container;
  state.container.setAttribute('data-testid', 'theme-container');
  state.getAnimationState = context?.getAnimationState ?? state.getAnimationState;
  state.elements = buildChrisReddingtonTimePageUI(container);
  setupInkCentering(state.elements, state.resourceTracker);
  setDisplayLayout(state.elements, 'counting');
  setCursorBlinking(state.elements, true);
  setAnimationPlayback(state.elements, shouldEnableAnimations(state.getAnimationState));
}

function resetToCounting(state: ChrisReddingtonTimePageState): void {
  if (!isTimePageRendererReady(state)) {
    return;
  }

  cancelCelebrationSequence(state);
  setCelebrationPhase(state, 'idle');
  setDisplayLayout(state.elements, 'counting');
  setRestingFontVariant(state.elements, false);
  setCenteringTransition(state.elements, false);
  clearRestingPromptAlignment(state.elements);
  setTransitionText(state.elements, '');
  setCelebrationMessage(state.elements, '');
  setCursorBlinking(state.elements, true);
  setAnimationPlayback(state.elements, shouldEnableAnimations(state.getAnimationState));
}

function snapCelebrationState(state: ChrisReddingtonTimePageState): void {
  if (!isTimePageRendererReady(state)) {
    return;
  }

  cancelCelebrationSequence(state);
  setDisplayLayout(state.elements, 'resting');
  setRestingFontVariant(state.elements, true);
  setCenteringTransition(state.elements, false);
  updateRestingPromptAlignment(state.elements);
  setTransitionText(state.elements, '');
  setCelebrationMessage(state.elements, '');
  setCursorBlinking(state.elements, true);
  setCelebrationPhase(state, 'resting');
}

function updateAnimationState(state: ChrisReddingtonTimePageState): void {
  if (!isTimePageRendererReady(state)) {
    return;
  }

  const canAnimate = shouldEnableAnimations(state.getAnimationState);
  setAnimationPlayback(state.elements, canAnimate);
  setCursorBlinking(state.elements, true);

  if (state.phase !== 'idle' && state.getAnimationState().prefersReducedMotion) {
    snapCelebrationState(state);
  }
}

export function chrisreddingtonTimePageRenderer(_targetDate: Date): TimePageRenderer {
  const state = createTimePageRendererState();

  return {
    mount(container: HTMLElement, context?: MountContext): void {
      mountRendererState(state, container, context);
    },

    updateTime(time: TimeRemaining): void {
      if (!isTimePageRendererReady(state)) {
        return;
      }

      const snapshot = updateCountdownDigits(
        state.elements,
        time,
        shouldEnableAnimations(state.getAnimationState)
      );

      state.latestCountdownText = snapshot.full;

      if (state.phase === 'resting') {
        updateRestingPromptAlignment(state.elements);
      }
    },

    onAnimationStateChange(context: AnimationStateContext): void {
      state.getAnimationState = () => context;
      updateAnimationState(state);
    },

    onCounting(): void {
      resetToCounting(state);
    },

    onCelebrating(_options?: CelebrationOptions): void {
      void runCelebrationSequence(state);
    },

    onCelebrated(_options?: CelebrationOptions): void {
      snapCelebrationState(state);
    },

    async destroy(): Promise<void> {
      state.isDestroyed = true;
      cancelCelebrationSequence(state);
      cancelAll(state.resourceTracker);
      state.container?.replaceChildren();
      state.container = null;
      state.elements = null;
    },

    updateContainer(newContainer: HTMLElement): void {
      if (!state.elements) {
        state.container = newContainer;
        return;
      }

      newContainer.setAttribute('data-testid', 'theme-container');
      newContainer.replaceChildren(state.elements.root);
      state.container = newContainer;

      if (state.phase === 'resting') {
        updateRestingPromptAlignment(state.elements);
      }
    },

    getResourceTracker(): ResourceTracker {
      return { ...state.resourceTracker };
    },
  };
}
