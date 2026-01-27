/**
 * Countdown Display DOM Builders
 *
 * Creates and updates countdown display elements (time units, separators, celebration message).
 */

import { setTextIfChanged } from '@themes/shared';

import type { ThemeElements } from './ui-builder';

/** Create a single time unit (days, hours, minutes, seconds). */
function createTimeUnit(testId: string): HTMLElement {
  const unit = document.createElement('div');
  unit.className = 'shadow-time-unit';
  unit.setAttribute('data-testid', testId);

  const value = document.createElement('span');
  value.className = 'shadow-value';
  value.textContent = '00';

  unit.appendChild(value);
  return unit;
}

/** Create separator element between time units. */
function createSeparator(): HTMLElement {
  const sep = document.createElement('span');
  sep.className = 'shadow-separator';
  sep.textContent = ':';
  return sep;
}

/** Create countdown display with all time units. */
export function createCountdownDisplay(): {
  countdown: HTMLElement;
  daysUnit: HTMLElement;
  hoursUnit: HTMLElement;
  minutesUnit: HTMLElement;
  secondsUnit: HTMLElement;
} {
  const countdown = document.createElement('div');
  countdown.className = 'shadow-countdown-display';
  countdown.setAttribute('data-testid', 'countdown-display');

  const daysUnit = createTimeUnit('countdown-days');
  const hoursUnit = createTimeUnit('countdown-hours');
  const minutesUnit = createTimeUnit('countdown-minutes');
  const secondsUnit = createTimeUnit('countdown-seconds');

  countdown.appendChild(daysUnit);
  countdown.appendChild(createSeparator());
  countdown.appendChild(hoursUnit);
  countdown.appendChild(createSeparator());
  countdown.appendChild(minutesUnit);
  countdown.appendChild(createSeparator());
  countdown.appendChild(secondsUnit);

  return { countdown, daysUnit, hoursUnit, minutesUnit, secondsUnit };
}

/** Create celebration message element. */
export function createCelebrationMessage(): HTMLElement {
  const message = document.createElement('p');
  message.className = 'shadow-celebration-message';
  message.setAttribute('data-testid', 'celebration-message');
  message.setAttribute('aria-live', 'polite');
  message.setAttribute('aria-atomic', 'true');
  message.hidden = true;
  return message;
}

/** Pad a time value to 2 digits. */
function padTimeUnit(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Update countdown display with new time values.
 *
 * @param refs - Cached DOM element references
 * @param days - Days remaining
 * @param hours - Hours remaining
 * @param minutes - Minutes remaining
 * @param seconds - Seconds remaining
 */
export function updateCountdown(
  refs: ThemeElements,
  days: number,
  hours: number,
  minutes: number,
  seconds: number
): void {
  setTextIfChanged(refs.daysValue, padTimeUnit(days));
  setTextIfChanged(refs.hoursValue, padTimeUnit(hours));
  setTextIfChanged(refs.minutesValue, padTimeUnit(minutes));
  setTextIfChanged(refs.secondsValue, padTimeUnit(seconds));
}
