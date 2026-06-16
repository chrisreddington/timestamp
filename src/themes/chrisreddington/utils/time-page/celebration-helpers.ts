import { safeSetTimeout } from '@themes/shared';

import type { ChrisReddingtonTimePageState } from './state';

export async function waitForPhaseDelay(
  state: ChrisReddingtonTimePageState,
  delayMs: number,
  signal: AbortSignal
): Promise<boolean> {
  if (signal.aborted) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      signal.removeEventListener('abort', abortHandler);
      resolve(result);
    };

    const abortHandler = () => finish(false);

    signal.addEventListener('abort', abortHandler, { once: true });
    safeSetTimeout(() => finish(!signal.aborted), delayMs, state.resourceTracker);
  });
}

export async function deleteCharByChar(
  state: ChrisReddingtonTimePageState,
  initialValue: string,
  delayMs: number,
  signal: AbortSignal,
  updateText: (value: string) => void
): Promise<boolean> {
  let value = initialValue;
  updateText(value);

  while (value.length > 0) {
    if (signal.aborted) {
      return false;
    }

    value = value.slice(0, -1);
    updateText(value);

    if (!(await waitForPhaseDelay(state, delayMs, signal))) {
      return false;
    }
  }

  return true;
}

export async function typeCharByChar(
  state: ChrisReddingtonTimePageState,
  targetValue: string,
  delayMs: number,
  signal: AbortSignal,
  updateText: (value: string) => void
): Promise<boolean> {
  let value = '';
  updateText(value);

  for (const character of targetValue) {
    if (signal.aborted) {
      return false;
    }

    value += character;
    updateText(value);

    if (!(await waitForPhaseDelay(state, delayMs, signal))) {
      return false;
    }
  }

  return true;
}
