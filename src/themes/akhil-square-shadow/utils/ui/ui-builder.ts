/**
 * UI Builder - DOM creation and update utilities for the Sun & Moon Shadow theme.
 *
 * Creates a sky scene with sun/moon orbiting and countdown digits with dynamic shadows.
 * All styling is CSS-driven. This module handles DOM structure and updates only.
 */

import { setHiddenIfChanged, setTextIfChanged } from '@themes/shared';

import { SHADOW_CONFIG } from '../../config';

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
// DOM BUILDERS
// =============================================================================

/** Create the sky container with gradient background. */
function createSky(): HTMLElement {
  const sky = document.createElement('div');
  sky.className = 'shadow-theme-sky';
  sky.setAttribute('aria-hidden', 'true');
  return sky;
}

/** Create the sun element. */
function createSun(): HTMLElement {
  const sun = document.createElement('div');
  sun.className = 'shadow-theme-sun';
  sun.setAttribute('aria-hidden', 'true');
  // Inner glow
  const innerGlow = document.createElement('div');
  innerGlow.className = 'sun-glow';
  sun.appendChild(innerGlow);
  return sun;
}

/** Create the moon element with craters. */
function createMoon(): HTMLElement {
  const moon = document.createElement('div');
  moon.className = 'shadow-theme-moon';
  moon.setAttribute('aria-hidden', 'true');
  // Add crater details
  for (let i = 0; i < 3; i++) {
    const crater = document.createElement('div');
    crater.className = `moon-crater moon-crater-${i + 1}`;
    moon.appendChild(crater);
  }
  return moon;
}

/** Create stars container with random stars. */
function createStars(): HTMLElement {
  const stars = document.createElement('div');
  stars.className = 'shadow-theme-stars';
  stars.setAttribute('aria-hidden', 'true');

  // Create random stars
  const starCount = 50;
  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 60}%`; // Keep stars in upper portion
    star.style.setProperty('--twinkle-delay', `${Math.random() * 3}s`);
    star.style.setProperty('--star-size', `${1 + Math.random() * 2}px`);
    stars.appendChild(star);
  }

  return stars;
}

/** Create a time unit (days/hours/mins/secs) with value only. */
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
function createCountdownDisplay(): {
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
function createCelebrationMessage(): HTMLElement {
  const message = document.createElement('p');
  message.className = 'shadow-celebration-message';
  message.setAttribute('data-testid', 'celebration-message');
  message.setAttribute('aria-live', 'polite');
  message.setAttribute('aria-atomic', 'true');
  message.hidden = true;
  return message;
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
// UPDATE FUNCTIONS
// =============================================================================

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

/**
 * Calculate position on an arc.
 *
 * @param progress - Progress along arc (0-1)
 * @param startAngle - Starting angle in degrees
 * @param endAngle - Ending angle in degrees
 * @param radiusX - Horizontal radius (percentage of viewport)
 * @param radiusY - Vertical radius (percentage of viewport)
 * @returns X, Y coordinates as percentages
 */
export function calculateArcPosition(
  progress: number,
  startAngle: number,
  endAngle: number,
  radiusX: number,
  radiusY: number
): { x: number; y: number } {
  // Interpolate angle
  const angle = startAngle + (endAngle - startAngle) * progress;
  const radians = (angle * Math.PI) / 180;

  // Calculate position (center at 50%, 80% - near bottom)
  const centerX = 50;
  const centerY = 80;

  const x = centerX + Math.cos(radians) * radiusX;
  // Y is inverted (up is negative)
  const y = centerY - Math.sin(radians) * radiusY;

  return { x, y };
}

/**
 * Update sun position in the sky.
 *
 * @param refs - DOM element references
 * @param progress - Sun progress (0-1, 0 = sunrise, 1 = sunset)
 */
export function updateSunPosition(refs: ThemeElements, progress: number): void {
  const { x, y } = calculateArcPosition(progress, 180, 0, 40, 35);

  // Only update if position changed significantly
  const roundedX = Math.round(x * 10) / 10;
  const roundedY = Math.round(y * 10) / 10;

  if (roundedX !== refs.lastSunX || roundedY !== refs.lastSunY) {
    refs.sun.style.left = `${x}%`;
    refs.sun.style.top = `${y}%`;
    refs.lastSunX = roundedX;
    refs.lastSunY = roundedY;
  }
}

/**
 * Update moon position in the sky.
 *
 * @param refs - DOM element references
 * @param progress - Moon progress (0-1, 0 = moonrise, 1 = moonset)
 */
export function updateMoonPosition(refs: ThemeElements, progress: number): void {
  const { x, y } = calculateArcPosition(progress, 0, 180, 40, 35);

  const roundedX = Math.round(x * 10) / 10;
  const roundedY = Math.round(y * 10) / 10;

  if (roundedX !== refs.lastMoonX || roundedY !== refs.lastMoonY) {
    refs.moon.style.left = `${x}%`;
    refs.moon.style.top = `${y}%`;
    refs.lastMoonX = roundedX;
    refs.lastMoonY = roundedY;
  }
}

/**
 * Calculate shadow properties based on light source position.
 *
 * @param lightX - Light source X position (percentage)
 * @param lightY - Light source Y position (percentage)
 * @param targetX - Target element X position (percentage, default 50% = center)
 * @param targetY - Target element Y position (percentage, default 50% = center)
 * @returns Shadow offset X, Y, blur, and angle
 */
export function calculateShadow(
  lightX: number,
  lightY: number,
  targetX: number = 50,
  targetY: number = 50
): { offsetX: number; offsetY: number; blur: number; angle: number } {
  // Vector from light to target
  const dx = targetX - lightX;
  const dy = targetY - lightY;

  // Distance affects shadow length (further = longer shadow)
  const distance = Math.sqrt(dx * dx + dy * dy);
  const normalizedDistance = Math.min(distance / 50, 1); // Normalize to 0-1

  // Shadow is cast in opposite direction of light
  const angle = Math.atan2(dy, dx);

  // Shadow properties scale with distance and config
  const offsetX = Math.cos(angle) * SHADOW_CONFIG.maxOffset * normalizedDistance;
  const offsetY = Math.sin(angle) * SHADOW_CONFIG.maxOffset * normalizedDistance;
  const blur = SHADOW_CONFIG.maxBlur * (0.5 + normalizedDistance * 0.5);

  return { offsetX, offsetY, blur, angle: (angle * 180) / Math.PI };
}

/**
 * Apply shadow to countdown display based on light source.
 *
 * @param refs - DOM element references
 * @param lightX - Light source X position (percentage)
 * @param lightY - Light source Y position (percentage)
 * @param activeBody - Which celestial body is the light source
 */
export function applyShadow(
  refs: ThemeElements,
  lightX: number,
  lightY: number,
  activeBody: CelestialBody
): void {
  const shadow = calculateShadow(lightX, lightY);
  const roundedAngle = Math.round(shadow.angle);

  // Only update if angle changed significantly
  if (roundedAngle !== refs.lastShadowAngle || activeBody !== refs.lastActiveBody) {
    // Apply shadow to each time unit
    const shadowColor = activeBody === 'sun'
      ? `rgba(0, 0, 0, ${SHADOW_CONFIG.opacity})`
      : `rgba(100, 100, 180, ${SHADOW_CONFIG.opacity * 0.7})`;

    const shadowValue = `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadowColor}`;

    refs.countdown.style.textShadow = shadowValue;
    refs.lastShadowAngle = roundedAngle;
    refs.lastActiveBody = activeBody;
  }
}

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
