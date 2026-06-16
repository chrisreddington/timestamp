import type { TimeRemaining } from '@core/types';
import { setTextIfChanged } from '@themes/shared';

import type { ChrisReddingtonTimePageElements } from '../ui/ui-builder';

export interface CountdownTextSnapshot {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  full: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function updateDigit(element: HTMLElement, value: string): void {
  setTextIfChanged(element, value);
}

export function updateCountdownDigits(
  elements: Pick<ChrisReddingtonTimePageElements, 'days' | 'hours' | 'minutes' | 'seconds'>,
  time: TimeRemaining,
  _shouldFlick: boolean
): CountdownTextSnapshot {
  const snapshot = {
    days: pad2(time.days),
    hours: pad2(time.hours),
    minutes: pad2(time.minutes),
    seconds: pad2(time.seconds),
  };

  updateDigit(elements.days, snapshot.days);
  updateDigit(elements.hours, snapshot.hours);
  updateDigit(elements.minutes, snapshot.minutes);
  updateDigit(elements.seconds, snapshot.seconds);

  return { ...snapshot, full: `${snapshot.days}:${snapshot.hours}:${snapshot.minutes}:${snapshot.seconds}` };
}
