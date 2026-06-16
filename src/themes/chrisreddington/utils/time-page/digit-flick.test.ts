import { describe, expect, it } from 'vitest';

import { updateCountdownDigits } from './digit-flick';

function createElement(value: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.textContent = value;
  return element;
}

describe('digit flick updates', () => {
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
    expect(elements.days.classList.contains('flick')).toBe(false);
    expect(elements.hours.classList.contains('flick')).toBe(false);
    expect(elements.minutes.classList.contains('flick')).toBe(true);
    expect(elements.seconds.classList.contains('flick')).toBe(true);
  });

  it('removes flick class after animation end', () => {
    const elements = {
      days: createElement('00'),
      hours: createElement('00'),
      minutes: createElement('00'),
      seconds: createElement('00'),
    };

    updateCountdownDigits(elements, { days: 1, hours: 0, minutes: 0, seconds: 0, total: 0 }, true);
    elements.days.dispatchEvent(new Event('animationend'));

    expect(elements.days.classList.contains('flick')).toBe(false);
  });
});
