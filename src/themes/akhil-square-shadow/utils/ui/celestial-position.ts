/**
 * Celestial Position Calculations
 *
 * Calculates positions for sun and moon orbiting the sky.
 */

import type { ThemeElements } from './ui-builder';

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
