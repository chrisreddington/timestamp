/**
 * Theme State Management
 *
 * Manages day/night mode, celebration state, and countdown/celebration toggle.
 */

import { setHiddenIfChanged, setTextIfChanged } from '@themes/shared';

import type { ThemeElements } from './ui-builder';

/**
 * Set day/night mode on the theme.
 *
 * @param refs - DOM element references
 * @param isNight - Whether it's night time
 */
export function setDayNightMode(refs: ThemeElements, isNight: boolean): void {
  refs.root.classList.toggle('is-night', isNight);
  refs.sun.classList.toggle('is-hidden', isNight);
  refs.moon.classList.toggle('is-hidden', !isNight);
  refs.stars.classList.toggle('is-visible', isNight);
}

/**
 * Show celebration message and hide countdown.
 *
 * @param refs - DOM element references
 * @param message - Celebration message to display
 */
export function showCelebration(refs: ThemeElements, message: string): void {
  setHiddenIfChanged(refs.countdown, true);
  setTextIfChanged(refs.celebration, message);
  setHiddenIfChanged(refs.celebration, false);
  refs.root.classList.add('is-celebrating');
}

/**
 * Show countdown and hide celebration message.
 *
 * @param refs - DOM element references
 */
export function showCountdown(refs: ThemeElements): void {
  setHiddenIfChanged(refs.countdown, false);
  setHiddenIfChanged(refs.celebration, true);
  refs.root.classList.remove('is-celebrating');
}
