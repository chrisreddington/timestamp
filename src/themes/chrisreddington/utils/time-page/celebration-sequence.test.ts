import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildChrisReddingtonTimePageUI, setCursorBlinking } from '../ui/ui-builder';
import { cancelCelebrationSequence, runCelebrationSequence } from './celebration-sequence';
import { createTimePageRendererState } from './state';

async function flushTimers(): Promise<void> {
  await vi.runAllTimersAsync();
  await Promise.resolve();
}

describe('chrisreddington celebration sequence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs clear → ready → hold → delete → centering to resting', async () => {
    const container = document.createElement('div');
    const state = createTimePageRendererState();
    state.container = container;
    state.elements = buildChrisReddingtonTimePageUI(container);
    state.latestCountdownText = '12:18:42:07';
    setCursorBlinking(state.elements, true);

    const promise = runCelebrationSequence(state);
    await flushTimers();
    await promise;

    expect(state.phase).toBe('resting');
    expect(state.elements.display.dataset.layout).toBe('resting');
    expect(state.elements.transitionText.textContent).toBe('');
  });

  it('aborts without reaching resting when cancelled mid-sequence', async () => {
    const container = document.createElement('div');
    const state = createTimePageRendererState();
    state.container = container;
    state.elements = buildChrisReddingtonTimePageUI(container);
    state.latestCountdownText = '01:00:00:00';

    const promise = runCelebrationSequence(state);
    await vi.advanceTimersByTimeAsync(120);
    cancelCelebrationSequence(state);
    await flushTimers();
    await promise;

    expect(state.phase).toBe('idle');
    expect(state.elements.display.dataset.layout).not.toBe('resting');
  });

  it('snaps directly to resting in reduced-motion mode', async () => {
    const container = document.createElement('div');
    const state = createTimePageRendererState();
    state.container = container;
    state.elements = buildChrisReddingtonTimePageUI(container);
    state.getAnimationState = () => ({ shouldAnimate: true, prefersReducedMotion: true, reason: 'reduced-motion' });

    await runCelebrationSequence(state);

    expect(state.phase).toBe('resting');
    expect(state.elements.display.dataset.layout).toBe('resting');
  });
});
