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

function applyFlickClass(element: HTMLElement): void {
  element.classList.add('flick');
  element.addEventListener(
    'animationend',
    () => {
      element.classList.remove('flick');
    },
    { once: true }
  );
}

function updateDigit(element: HTMLElement, value: string, shouldFlick: boolean): void {
  const changed = setTextIfChanged(element, value);
  if (changed && shouldFlick) {
    applyFlickClass(element);
  }
}

export function updateCountdownDigits(
  elements: Pick<ChrisReddingtonTimePageElements, 'days' | 'hours' | 'minutes' | 'seconds'>,
  time: TimeRemaining,
  shouldFlick: boolean
): CountdownTextSnapshot {
  const snapshot = {
    days: pad2(time.days),
    hours: pad2(time.hours),
    minutes: pad2(time.minutes),
    seconds: pad2(time.seconds),
  };

  updateDigit(elements.days, snapshot.days, shouldFlick);
  updateDigit(elements.hours, snapshot.hours, shouldFlick);
  updateDigit(elements.minutes, snapshot.minutes, shouldFlick);
  updateDigit(elements.seconds, snapshot.seconds, shouldFlick);

  return { ...snapshot, full: `${snapshot.days}:${snapshot.hours}:${snapshot.minutes}:${snapshot.seconds}` };
}
