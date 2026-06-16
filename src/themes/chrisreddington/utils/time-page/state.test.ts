import { describe, expect, it } from 'vitest';

import {
  cancelCelebrationController,
  createCelebrationSignal,
  createTimePageRendererState,
  isTimePageRendererReady,
  setCelebrationPhase,
} from './state';

describe('chrisreddington time-page state', () => {
  it('creates renderer state with idle defaults', () => {
    const state = createTimePageRendererState();

    expect(state.phase).toBe('idle');
    expect(state.latestCountdownText).toBe('00:00:00:00');
    expect(state.resourceTracker.timeouts).toEqual([]);
    expect(isTimePageRendererReady(state)).toBe(false);
  });

  it('updates local celebration phase without counting mirror state', () => {
    const state = createTimePageRendererState();

    setCelebrationPhase(state, 'typing-ready');
    expect(state.phase).toBe('typing-ready');
  });

  it('replaces existing celebration controllers when a new signal is created', () => {
    const state = createTimePageRendererState();
    const firstSignal = createCelebrationSignal(state);
    const secondSignal = createCelebrationSignal(state);

    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);
  });

  it('aborts and clears the active celebration controller', () => {
    const state = createTimePageRendererState();
    const signal = createCelebrationSignal(state);

    cancelCelebrationController(state);

    expect(signal.aborted).toBe(true);
    expect(state.celebrationAbortController).toBeNull();
  });
});
