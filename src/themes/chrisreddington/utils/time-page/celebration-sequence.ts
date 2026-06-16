import { cancelAll, shouldEnableAnimations } from '@themes/shared';

import {
  centerToRestingPrompt,
  clearCountdownValue,
  deleteReadyWord,
  holdReadyWord,
  snapToRestingPrompt,
  typeReadyWord,
} from './celebration-steps';
import {
  cancelCelebrationController,
  type ChrisReddingtonTimePageState,
  createCelebrationSignal,
  isTimePageRendererReady,
  setCelebrationPhase,
} from './state';

function shouldSnapToResting(state: ChrisReddingtonTimePageState): boolean {
  const animationState = state.getAnimationState();
  return animationState.prefersReducedMotion || !shouldEnableAnimations(state.getAnimationState);
}

function finishAbortedSequence(state: ChrisReddingtonTimePageState): void {
  if (state.phase !== 'resting') {
    setCelebrationPhase(state, 'idle');
  }
}

export async function runCelebrationSequence(state: ChrisReddingtonTimePageState): Promise<void> {
  if (!isTimePageRendererReady(state)) {
    return;
  }

  cancelAll(state.resourceTracker);
  const signal = createCelebrationSignal(state);

  if (shouldSnapToResting(state)) {
    snapToRestingPrompt(state);
    cancelCelebrationController(state);
    return;
  }

  const steps = [
    clearCountdownValue,
    typeReadyWord,
    holdReadyWord,
    deleteReadyWord,
    centerToRestingPrompt,
  ] as const;

  for (const step of steps) {
    if (!(await step(state, signal))) {
      finishAbortedSequence(state);
      return;
    }
  }

  cancelCelebrationController(state);
}

export function cancelCelebrationSequence(state: ChrisReddingtonTimePageState): void {
  cancelCelebrationController(state);
  cancelAll(state.resourceTracker);
  if (state.phase !== 'resting') {
    setCelebrationPhase(state, 'idle');
  }
}
