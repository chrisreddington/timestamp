import type { AnimationStateGetter, ResourceTracker } from '@core/types';
import { createResourceTracker, DEFAULT_ANIMATION_STATE } from '@themes/shared';

import type { ChrisReddingtonTimePageElements } from '../ui/ui-builder';

export type CelebrationPhase =
  | 'idle'
  | 'clearing-value'
  | 'typing-ready'
  | 'holding'
  | 'deleting-ready'
  | 'centering'
  | 'resting';

export interface ChrisReddingtonTimePageState {
  container: HTMLElement | null;
  elements: ChrisReddingtonTimePageElements | null;
  resourceTracker: ResourceTracker;
  getAnimationState: AnimationStateGetter;
  phase: CelebrationPhase;
  latestCountdownText: string;
  celebrationAbortController: AbortController | null;
  isDestroyed: boolean;
}

export interface ReadyChrisReddingtonTimePageState extends ChrisReddingtonTimePageState {
  container: HTMLElement;
  elements: ChrisReddingtonTimePageElements;
}

export function createTimePageRendererState(): ChrisReddingtonTimePageState {
  return {
    container: null,
    elements: null,
    resourceTracker: createResourceTracker(),
    getAnimationState: () => DEFAULT_ANIMATION_STATE,
    phase: 'idle',
    latestCountdownText: '00:00:00:00',
    celebrationAbortController: null,
    isDestroyed: false,
  };
}

export function isTimePageRendererReady(
  state: ChrisReddingtonTimePageState
): state is ReadyChrisReddingtonTimePageState {
  return !state.isDestroyed && state.container !== null && state.elements !== null;
}

export function setCelebrationPhase(state: ChrisReddingtonTimePageState, phase: CelebrationPhase): void {
  state.phase = phase;
}

export function cancelCelebrationController(state: ChrisReddingtonTimePageState): void {
  if (state.celebrationAbortController) {
    state.celebrationAbortController.abort();
    state.celebrationAbortController = null;
  }
}

export function createCelebrationSignal(state: ChrisReddingtonTimePageState): AbortSignal {
  cancelCelebrationController(state);
  const controller = new AbortController();
  state.celebrationAbortController = controller;
  return controller.signal;
}
