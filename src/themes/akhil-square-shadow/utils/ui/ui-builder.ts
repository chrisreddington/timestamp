/**
 * UI Builder - Main entry point for DOM management
 *
 * Orchestrates creation and updates of the Sun & Moon Shadow theme UI.
 * Delegates to specialized modules:
 * - celestial-builders.ts: Sky, sun, moon, stars
 * - countdown-display-builders.ts: Countdown display, time units, celebration
 * - celestial-position.ts: Sun/moon orbital position calculations
 * - shadow-effects.ts: Shadow calculations and application
 * - theme-state.ts: Day/night and celebration state management
 */

import { createMoon, createSky, createStars, createSun } from './celestial-builders';
import {
  calculateArcPosition,
  updateMoonPosition,
  updateSunPosition,
} from './celestial-position';
import {
  createCelebrationMessage,
  createCountdownDisplay,
  updateCountdown,
} from './countdown-display-builders';
import { applyShadow, calculateShadow } from './shadow-effects';
import {
  setDayNightMode,
  showCelebration,
  showCountdown,
} from './theme-state';

// =============================================================================
// TYPES
// =============================================================================

/** Celestial body currently active (determines shadow source). */
export type CelestialBody = 'sun' | 'moon';

/** References to key DOM elements for updates. */
export interface ThemeElements {
  root: HTMLElement;
  sky: HTMLElement;
  sun: HTMLElement;
  moon: HTMLElement;
  stars: HTMLElement;
  countdown: HTMLElement;
  celebration: HTMLElement;
  // Time unit elements
  daysUnit: HTMLElement;
  hoursUnit: HTMLElement;
  minutesUnit: HTMLElement;
  secondsUnit: HTMLElement;
  // Cached .value elements for performance
  daysValue: HTMLElement;
  hoursValue: HTMLElement;
  minutesValue: HTMLElement;
  secondsValue: HTMLElement;
  // Cached state for change detection
  lastSunX: number;
  lastSunY: number;
  lastMoonX: number;
  lastMoonY: number;
  lastShadowAngle: number;
  lastActiveBody: CelestialBody;
}

// =============================================================================
// MAIN BUILD FUNCTION
// =============================================================================

/**
 * Build complete theme DOM structure.
 *
 * Creates:
 * - Sky background with gradient
 * - Sun and Moon celestial bodies
 * - Stars (visible at night)
 * - Countdown display with shadow-casting digits
 * - Celebration message
 *
 * @param container - DOM element to append theme structure to
 * @returns References to key DOM elements for updates
 */
export function buildThemeDOM(container: HTMLElement): ThemeElements {
  const root = document.createElement('div');
  root.className = 'akhil-square-shadow-theme';

  const sky = createSky();
  const stars = createStars();
  const sun = createSun();
  const moon = createMoon();
  const { countdown, daysUnit, hoursUnit, minutesUnit, secondsUnit } = createCountdownDisplay();
  const celebration = createCelebrationMessage();

  // Layer order: sky → stars → sun/moon → countdown → celebration
  root.appendChild(sky);
  root.appendChild(stars);
  root.appendChild(sun);
  root.appendChild(moon);
  root.appendChild(countdown);
  root.appendChild(celebration);

  // Clear container and append new structure
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  container.appendChild(root);

  return {
    root,
    sky,
    sun,
    moon,
    stars,
    countdown,
    celebration,
    daysUnit,
    hoursUnit,
    minutesUnit,
    secondsUnit,
    // Pre-cache .value elements (with null checks for safety)
    daysValue: daysUnit.querySelector('.shadow-value') ?? (document.createElement('span') as HTMLElement),
    hoursValue: hoursUnit.querySelector('.shadow-value') ?? (document.createElement('span') as HTMLElement),
    minutesValue: minutesUnit.querySelector('.shadow-value') ?? (document.createElement('span') as HTMLElement),
    secondsValue: secondsUnit.querySelector('.shadow-value') ?? (document.createElement('span') as HTMLElement),
    // Initialize cached state
    lastSunX: -1,
    lastSunY: -1,
    lastMoonX: -1,
    lastMoonY: -1,
    lastShadowAngle: -1,
    lastActiveBody: 'sun',
  };
}

// =============================================================================
// RE-EXPORT PUBLIC API
// =============================================================================

// Countdown updates
export { updateCountdown };

// Celestial positions
export { calculateArcPosition, updateMoonPosition,updateSunPosition };

// Shadow effects
export { applyShadow,calculateShadow };

// State management
export { setDayNightMode, showCelebration, showCountdown };
