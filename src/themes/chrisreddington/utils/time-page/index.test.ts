import { describe, expect, it } from 'vitest';

import * as timePage from './index';

describe('chrisreddington time-page barrel', () => {
  it('exports renderer state and sequence helpers', () => {
    expect(typeof timePage.createTimePageRendererState).toBe('function');
    expect(typeof timePage.runCelebrationSequence).toBe('function');
    expect(typeof timePage.cancelCelebrationSequence).toBe('function');
    expect(typeof timePage.updateCountdownDigits).toBe('function');
  });
});
