/**
 * Visualizations - Clock and shadow graph rendering.
 *
 * Renders the shadow clock (analog clock showing sun position) and
 * shadow graph (visual representation of shadow length vs object height).
 */

const VISUAL_HEIGHT_PX = 80;
const VISUAL_WIDTH_PX = 180;

/**
 * Format a numeric value for axis labels.
 *
 * @param value - The numeric value to format
 * @returns Formatted string with appropriate precision and units
 */
function formatAxisValue(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

/**
 * Update shadow clock visualization with sun position and altitude.
 *
 * Displays sun position as a dot on a circular clock face with azimuth orientation.
 * Altitude affects the radius (higher = closer to center).
 * Also displays shadow direction arm opposite to sun.
 *
 * @param shadowClock - The clock container element
 * @param azimuthDeg - Sun azimuth angle (0° = North, 90° = East, etc.)
 * @param altitudeDeg - Sun altitude angle (-90° to 90°)
 */
export function updateShadowClock(
  shadowClock: HTMLElement,
  azimuthDeg: number,
  altitudeDeg: number
): void {
  const sunEl = shadowClock.querySelector('[data-field="clock-sun"]') as HTMLElement;
  const shadowArmEl = shadowClock.querySelector('[data-field="clock-shadow"]') as HTMLElement;

  if (sunEl) {
    const sunAngle = azimuthDeg;
    const altitudeRatio = Math.max(0, altitudeDeg) / 90;
    const radius = 42 - altitudeRatio * 20;

    sunEl.style.setProperty('--sun-angle', `${sunAngle}deg`);
    sunEl.style.setProperty('--sun-radius', `${radius}%`);
    sunEl.classList.toggle('is-below-horizon', altitudeDeg <= 0);
  }

  if (shadowArmEl) {
    const shadowAngle = (azimuthDeg + 180) % 360;
    shadowArmEl.style.setProperty('--shadow-angle', `${shadowAngle}deg`);
    shadowArmEl.classList.toggle('is-hidden', altitudeDeg <= 0);
  }
}

/**
 * Update shadow graph visualization with object height and shadow length.
 *
 * Displays a visual representation of an object's shadow as a function of height
 * and sun altitude. Updates axes labels to show current scale.
 *
 * @param visual - The visual container element
 * @param heightMeters - Height of the object
 * @param shadowLength - Length of the shadow (or null if sun below horizon)
 */
export function updateVisual(
  visual: HTMLElement,
  heightMeters: number,
  shadowLength: number | null
): void {
  const objectEl = visual.querySelector('[data-field="object"]') as HTMLElement;
  const shadowEl = visual.querySelector('[data-field="shadow-bar"]') as HTMLElement;

  const effectiveShadow = shadowLength ?? 0;
  const maxY = Math.max(heightMeters, 1);
  const maxX = Math.max(effectiveShadow, heightMeters, 1);

  const yScale = VISUAL_HEIGHT_PX / maxY;
  const xScale = VISUAL_WIDTH_PX / maxX;

  const objectHeightPx = Math.min(heightMeters * yScale, VISUAL_HEIGHT_PX);
  const shadowWidthPx = shadowLength !== null ? Math.min(shadowLength * xScale, VISUAL_WIDTH_PX) : 0;

  objectEl.style.height = `${objectHeightPx}px`;
  objectEl.style.removeProperty('transform');

  if (shadowLength === null || shadowLength <= 0) {
    shadowEl.classList.add('is-hidden');
    shadowEl.style.width = '30px';
  } else {
    shadowEl.classList.remove('is-hidden');
    shadowEl.style.width = `${Math.max(shadowWidthPx, 4)}px`;
  }

  const yMaxLabel = visual.querySelector('[data-field="y-max"]');
  if (yMaxLabel) yMaxLabel.textContent = formatAxisValue(maxY) + 'm';

  const yMidLabel = visual.querySelector('[data-field="y-mid"]');
  if (yMidLabel) yMidLabel.textContent = formatAxisValue(maxY / 2) + 'm';

  const xMaxLabel = visual.querySelector('[data-field="x-max"]');
  if (xMaxLabel) xMaxLabel.textContent = formatAxisValue(maxX) + 'm';
}
