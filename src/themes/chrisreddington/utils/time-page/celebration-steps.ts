import { CHRISREDDINGTON_SEQUENCE } from '../../config';
import {
  clearRestingPromptAlignment,
  setCelebrationMessage,
  setDisplayLayout,
  setRestingFontVariant,
  setTransitionText,
  updateRestingPromptAlignment,
} from '../ui/ui-builder';
import { deleteCharByChar, typeCharByChar, waitForPhaseDelay } from './celebration-helpers';
import { type ChrisReddingtonTimePageState,isTimePageRendererReady, setCelebrationPhase } from './state';

export async function clearCountdownValue(
  state: ChrisReddingtonTimePageState,
  signal: AbortSignal
): Promise<boolean> {
  if (!isTimePageRendererReady(state)) {
    return false;
  }

  setCelebrationPhase(state, 'clearing-value');

  // Hold the final zero value in the counting layout (numeric alignment) so it
  // is readable before the clear-and-type sequence begins.
  if (!(await waitForPhaseDelay(state, CHRISREDDINGTON_SEQUENCE.holdFinalMs, signal))) {
    return false;
  }

  setDisplayLayout(state.elements, 'transition');
  setRestingFontVariant(state.elements, false);
  clearRestingPromptAlignment(state.elements);

  return deleteCharByChar(
    state,
    state.latestCountdownText,
    CHRISREDDINGTON_SEQUENCE.deleteCharMs,
    signal,
    (value) => setTransitionText(state.elements!, value)
  );
}

export async function typeReadyWord(
  state: ChrisReddingtonTimePageState,
  signal: AbortSignal
): Promise<boolean> {
  if (!isTimePageRendererReady(state)) {
    return false;
  }

  setCelebrationPhase(state, 'typing-ready');
  setCelebrationMessage(state.elements, CHRISREDDINGTON_SEQUENCE.readyWord);

  return typeCharByChar(
    state,
    CHRISREDDINGTON_SEQUENCE.readyWord,
    CHRISREDDINGTON_SEQUENCE.typeCharMs,
    signal,
    (value) => setTransitionText(state.elements!, value)
  );
}

export async function holdReadyWord(
  state: ChrisReddingtonTimePageState,
  signal: AbortSignal
): Promise<boolean> {
  if (!isTimePageRendererReady(state)) {
    return false;
  }

  setCelebrationPhase(state, 'holding');
  return waitForPhaseDelay(state, CHRISREDDINGTON_SEQUENCE.holdReadyMs, signal);
}

export async function deleteReadyWord(
  state: ChrisReddingtonTimePageState,
  signal: AbortSignal
): Promise<boolean> {
  if (!isTimePageRendererReady(state)) {
    return false;
  }

  setCelebrationPhase(state, 'deleting-ready');
  return deleteCharByChar(
    state,
    CHRISREDDINGTON_SEQUENCE.readyWord,
    CHRISREDDINGTON_SEQUENCE.deleteCharMs,
    signal,
    (value) => setTransitionText(state.elements!, value)
  );
}

export async function centerToRestingPrompt(
  state: ChrisReddingtonTimePageState,
  signal: AbortSignal
): Promise<boolean> {
  if (!isTimePageRendererReady(state)) {
    return false;
  }

  setCelebrationPhase(state, 'centering');
  setDisplayLayout(state.elements, 'resting');
  setRestingFontVariant(state.elements, true);
  updateRestingPromptAlignment(state.elements);
  setTransitionText(state.elements, '');
  setCelebrationMessage(state.elements, '');

  const didCenter = await waitForPhaseDelay(state, CHRISREDDINGTON_SEQUENCE.centeringMs, signal);
  if (didCenter) {
    setCelebrationPhase(state, 'resting');
  }

  return didCenter;
}

export function snapToRestingPrompt(state: ChrisReddingtonTimePageState): void {
  if (!isTimePageRendererReady(state)) {
    return;
  }

  setDisplayLayout(state.elements, 'resting');
  setRestingFontVariant(state.elements, true);
  updateRestingPromptAlignment(state.elements);
  setTransitionText(state.elements, '');
  setCelebrationMessage(state.elements, '');
  setCelebrationPhase(state, 'resting');
}
