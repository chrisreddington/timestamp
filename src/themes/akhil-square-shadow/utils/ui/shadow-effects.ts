/**
 * Shadow Effects
 *
 * Calculates and applies dynamic shadows to countdown display based on celestial body position.
 */

import type { CelestialBody, ThemeElements } from './ui-builder';

import { SHADOW_CONFIG } from '../../config';

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
