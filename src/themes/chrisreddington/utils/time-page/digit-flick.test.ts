import { describe, expect, it } from 'vitest';

import { updateCountdownDigits } from './digit-flick';

function createElement(value: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.textContent = value;
  return element;
}

describe('digit updates', () => {
  it('updates only changed columns and formats a full countdown snapshot', () => {
    const elements = {
      days: createElement('05'),
      hours: createElement('01'),
      minutes: createElement('09'),
      seconds: createElement('59'),
    };

    const snapshot = updateCountdownDigits(
      elements,
      { days: 5, hours: 1, minutes: 10, seconds: 0, total: 0 },
      true
    );

    expect(snapshot.full).toBe('05:01:10:00');
    expect(elements.days.textContent).toBe('05');
    expect(elements.hours.textContent).toBe('01');
    expect(elements.minutes.textContent).toBe('10');
    expect(elements.seconds.textContent).toBe('00');
  });
});
