/**
 * UI Builder - DOM creation and update utilities for the ring theme.
 *
 * All styling is CSS-driven. This module handles DOM structure and updates only.
 */

import { setHiddenIfChanged, setTextIfChanged } from '@themes/shared';

/** Intensity level type for ring animation. */
export type IntensityLevel = 'CALM' | 'BUILDING' | 'INTENSE' | 'FINALE';

/** References to key DOM elements for updates. */
export interface ThemeElements {
  root: HTMLElement;
  countdown: HTMLElement;
  celebration: HTMLElement;
  pulsingRing: HTMLElement;
  daysUnit: HTMLElement;
  hoursUnit: HTMLElement;
  minutesUnit: HTMLElement;
  secondsUnit: HTMLElement;
  // Cached .value elements for performance (avoid querySelector every frame)
  daysValue: HTMLElement;
  hoursValue: HTMLElement;
  minutesValue: HTMLElement;
  secondsValue: HTMLElement;
  // Cached state for change detection (avoid unnecessary style writes)
  lastPulseProgress: number;
  lastIntensity: string;
  lastCelebrationProgress: number;
}

/** Create a time unit (days/hours/mins/secs) with value and label. */
function createTimeUnit(testId: string, label: string): HTMLElement {
  const unit = document.createElement('div');
  unit.className = 'time-unit';
  unit.setAttribute('data-testid', testId);

  const value = document.createElement('span');
  value.className = 'value';
  value.textContent = '00';

  const labelEl = document.createElement('span');
  labelEl.className = 'label';
  labelEl.textContent = label;

  unit.appendChild(value);
  unit.appendChild(labelEl);
  return unit;
}

/** Create separator element between time units. */
function createSeparator(): HTMLElement {
  const sep = document.createElement('span');
  sep.className = 'separator';
  sep.textContent = ':';
  return sep;
}

/** Create pulsing ring element (decorative, animated via CSS custom properties). */
function createPulsingRing(): HTMLElement {
  const ring = document.createElement('div');
  ring.className = 'pulsing-ring';
  ring.setAttribute('aria-hidden', 'true'); // Decorative only
  ring.dataset.intensity = 'calm'; // Default intensity level
  return ring;
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
  countdown.className = 'countdown-display';
  countdown.setAttribute('data-testid', 'countdown-display');

  const daysUnit = createTimeUnit('countdown-days', 'DAYS');
  const hoursUnit = createTimeUnit('countdown-hours', 'HOURS');
  const minutesUnit = createTimeUnit('countdown-minutes', 'MINS');
  const secondsUnit = createTimeUnit('countdown-seconds', 'SECS');

  countdown.appendChild(daysUnit);
  countdown.appendChild(createSeparator());
  countdown.appendChild(hoursUnit);
  countdown.appendChild(createSeparator());
  countdown.appendChild(minutesUnit);
  countdown.appendChild(createSeparator());
  countdown.appendChild(secondsUnit);

  return { countdown, daysUnit, hoursUnit, minutesUnit, secondsUnit };
}

/** Create celebration message element (text provided by orchestrator). */
function createCelebrationMessage(): HTMLElement {
  const message = document.createElement('p');
  message.className = 'celebration-message';
  message.setAttribute('data-testid', 'celebration-message');
  message.setAttribute('aria-live', 'polite');
  message.setAttribute('aria-atomic', 'true');
  message.hidden = true;
  return message;
}

/**
 * Build complete theme DOM structure.
 *
 * Creates:
 * - Pulsing ring (decorative background animation)
 * - Countdown display with time units
 * - Celebration message
 *
 * @param container - DOM element to append theme structure to
 * @returns References to key DOM elements for updates and lifecycle management
 */
export function buildThemeDOM(container: HTMLElement): ThemeElements {
  const root = document.createElement('div');
  root.className = 'ring-theme';

  const pulsingRing = createPulsingRing();
  const { countdown, daysUnit, hoursUnit, minutesUnit, secondsUnit } = createCountdownDisplay();
  const celebration = createCelebrationMessage();

  // Layer order: ring (background) → countdown → celebration
  root.appendChild(pulsingRing);
  root.appendChild(countdown);
  root.appendChild(celebration);

  // Clear container and append new structure
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  container.appendChild(root);

  return {
    root,
    countdown,
    celebration,
    pulsingRing,
    daysUnit,
    hoursUnit,
    minutesUnit,
    secondsUnit,
    // Pre-cache .value elements to avoid querySelector on every frame
    daysValue: daysUnit.querySelector('.value') as HTMLElement,
    hoursValue: hoursUnit.querySelector('.value') as HTMLElement,
    minutesValue: minutesUnit.querySelector('.value') as HTMLElement,
    secondsValue: secondsUnit.querySelector('.value') as HTMLElement,
    // Initialize cached state for change detection
    lastPulseProgress: -1,
    lastIntensity: '',
    lastCelebrationProgress: -1,
  };
}

/**
 * Pad a time value to 2 digits.
 * @param value - Time value to pad
 * @returns Zero-padded string
 */
function padTimeUnit(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Update countdown display with new time values.
 *
 * Uses DOM guards to prevent unnecessary writes (improves performance).
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
  // Use pre-cached value elements (no querySelector on each frame)
  setTextIfChanged(refs.daysValue, padTimeUnit(days));
  setTextIfChanged(refs.hoursValue, padTimeUnit(hours));
  setTextIfChanged(refs.minutesValue, padTimeUnit(minutes));
  setTextIfChanged(refs.secondsValue, padTimeUnit(seconds));
}

/**
 * Intensity configuration for visual effects.
 */
const INTENSITY_CONFIG: Record<IntensityLevel, { glowMultiplier: number; scaleRange: number }> = {
  CALM: { glowMultiplier: 1.0, scaleRange: 0.1 },
  BUILDING: { glowMultiplier: 1.3, scaleRange: 0.15 },
  INTENSE: { glowMultiplier: 1.6, scaleRange: 0.2 },
  FINALE: { glowMultiplier: 2.0, scaleRange: 0.25 },
};

/**
 * Update the pulsing ring animation state with intensity.
 *
 * This is called from the renderer's animation loop to smoothly animate the ring.
 * The actual visual effect is in CSS - we update CSS custom properties.
 *
 * @param refs - Cached DOM element references
 * @param progress - Animation progress (0-1), where 0 and 1 are "no pulse" states
 * @param intensity - Current intensity level for scaling effects
 */
export function updatePulsingRing(
  refs: ThemeElements,
  progress: number,
  intensity: IntensityLevel
): void {
  // Convert linear progress (0-1) to a smooth pulse (0 → 1 → 0)
  // Using sine wave for natural breathing effect
  const pulseValue = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;

  // Round to 3 decimal places for meaningful change detection (avoids micro-updates)
  const roundedPulse = Math.round(pulseValue * 1000) / 1000;
  const intensityKey = intensity.toLowerCase();

  // Only update --pulse-progress if changed (reduces style recalcs)
  if (roundedPulse !== refs.lastPulseProgress) {
    refs.pulsingRing.style.setProperty('--pulse-progress', String(roundedPulse));
    refs.lastPulseProgress = roundedPulse;
  }

  // Only update intensity-based values if intensity changed
  if (intensityKey !== refs.lastIntensity) {
    const config = INTENSITY_CONFIG[intensity];
    refs.pulsingRing.style.setProperty('--glow-multiplier', String(config.glowMultiplier));
    refs.pulsingRing.style.setProperty('--scale-range', String(config.scaleRange));
    refs.pulsingRing.dataset.intensity = intensityKey;
    refs.lastIntensity = intensityKey;
  }
}

/**
 * Start celebration animation with traveling light effect.
 *
 * @param refs - Cached DOM element references
 * @param progress - Celebration progress (0-1) for light position around ring
 */
export function startCelebrationAnimation(refs: ThemeElements, progress: number): void {
  // Round to 3 decimal places for meaningful change detection
  const roundedProgress = Math.round(progress * 1000) / 1000;

  // Only update if changed (reduces style recalcs)
  if (roundedProgress !== refs.lastCelebrationProgress) {
    refs.pulsingRing.style.setProperty('--celebration-progress', String(roundedProgress));
    refs.lastCelebrationProgress = roundedProgress;
  }
}

/**
 * Stop celebration animation and reset to static state.
 *
 * @param refs - Cached DOM element references
 */
export function stopCelebrationAnimation(refs: ThemeElements): void {
  refs.pulsingRing.style.removeProperty('--celebration-progress');
  refs.lastCelebrationProgress = -1; // Reset cache
}

/**
 * Show celebration message and hide countdown.
 *
 * @param refs - Cached DOM element references
 * @param message - Celebration message to display (pre-sanitized)
 */
export function showCelebration(refs: ThemeElements, message: string): void {
  setHiddenIfChanged(refs.countdown, true);
  refs.pulsingRing.classList.add('is-celebrating');
  setTextIfChanged(refs.celebration, message);
  setHiddenIfChanged(refs.celebration, false);
}

/**
 * Show countdown and hide celebration message.
 *
 * @param refs - Cached DOM element references
 */
export function showCountdown(refs: ThemeElements): void {
  setHiddenIfChanged(refs.countdown, false);
  refs.pulsingRing.classList.remove('is-celebrating');
  setHiddenIfChanged(refs.celebration, true);
}
