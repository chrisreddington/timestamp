/**
 * Shadow Overlay - Sun angle and shadow length calculator popup for the theme.
 *
 * A popup modal triggered by a button that allows users to:
 * - Enter an object height and calculate real-time shadow length
 * - Use geolocation or manually enter coordinates
 */

import { cancelAll, createResourceTracker, safeSetInterval } from '@themes/shared';
import SunCalc from 'suncalc';

interface GeoCoords {
  latitude: number;
  longitude: number;
}

/** Result from shadow calculation. */
interface ShadowInfo {
  altitudeDeg: number;
  azimuthDeg: number;
  shadowLengthMeters: number | null;
}

/**
 * Calculate shadow info for an object at a given location and time.
 * Uses SunCalc to determine sun position and derives shadow length from altitude.
 */
function calculateShadowInfo(params: {
  heightMeters: number;
  latitude: number;
  longitude: number;
  date: Date;
}): ShadowInfo {
  const { heightMeters, latitude, longitude, date } = params;
  const sunPos = SunCalc.getPosition(date, latitude, longitude);
  
  // Convert from radians to degrees
  const altitudeDeg = sunPos.altitude * (180 / Math.PI);
  // SunCalc azimuth is from south, clockwise. Convert to from north.
  const azimuthDeg = ((sunPos.azimuth * (180 / Math.PI)) + 180) % 360;
  
  // Shadow length: null if sun below horizon, otherwise height / tan(altitude)
  let shadowLengthMeters: number | null = null;
  if (altitudeDeg > 0) {
    const altitudeRad = sunPos.altitude;
    shadowLengthMeters = heightMeters / Math.tan(altitudeRad);
  }
  
  return { altitudeDeg, azimuthDeg, shadowLengthMeters };
}

/** Controller for the shadow overlay component. */
export interface ShadowOverlayController {
  destroy(): void;
}

const MIN_HEIGHT = 0.01;
const MAX_HEIGHT = 100;
const VISUAL_HEIGHT_PX = 80; // max height for visual representation (compact)
const VISUAL_WIDTH_PX = 180;  // max width for shadow in visual (compact)

/**
 * Create a shadow overlay popup with trigger button.
 *
 * @param parent - Parent element to append the overlay to
 * @returns Controller with destroy method
 */
export function createShadowOverlay(
  parent: HTMLElement
): ShadowOverlayController {
  const resources = createResourceTracker();
  
  // --- Trigger Button ---
  const triggerButton = document.createElement('button');
  triggerButton.type = 'button';
  triggerButton.className = 'shadow-overlay-trigger';
  triggerButton.setAttribute('data-testid', 'shadow-overlay-trigger');
  triggerButton.setAttribute('aria-label', 'Open shadow calculator');
  triggerButton.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .38-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
    </svg>
    <span>Shadow Calculator</span>
  `;
  parent.appendChild(triggerButton);

  // --- Modal Backdrop ---
  const backdrop = document.createElement('div');
  backdrop.className = 'shadow-overlay-backdrop';
  backdrop.setAttribute('data-testid', 'shadow-overlay-backdrop');
  
  // --- Modal Container ---
  const modal = document.createElement('div');
  modal.className = 'shadow-overlay-modal';
  modal.setAttribute('data-testid', 'shadow-overlay-modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'shadow-overlay-title');

  // --- Modal Header ---
  const header = document.createElement('div');
  header.className = 'shadow-overlay-header';
  
  const title = document.createElement('h2');
  title.className = 'shadow-overlay-title';
  title.id = 'shadow-overlay-title';
  title.textContent = 'Shadow & Sun Calculator';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'shadow-overlay-close';
  closeButton.setAttribute('aria-label', 'Close calculator');
  closeButton.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  `;
  
  header.append(title, closeButton);

  // --- Modal Content ---
  const content = document.createElement('div');
  content.className = 'shadow-overlay-content';

  // Left column: Calculator
  const calculator = document.createElement('div');
  calculator.className = 'shadow-overlay-calculator';

  const form = document.createElement('div');
  form.className = 'shadow-overlay-form';

  const heightLabel = document.createElement('label');
  heightLabel.textContent = 'Object height (m)';
  heightLabel.className = 'shadow-overlay-label';
  heightLabel.setAttribute('for', 'shadow-overlay-height');

  const heightInput = document.createElement('input');
  heightInput.id = 'shadow-overlay-height';
  heightInput.type = 'number';
  heightInput.min = String(MIN_HEIGHT);
  heightInput.max = String(MAX_HEIGHT);
  heightInput.step = '0.05';
  heightInput.value = '1.00';
  heightInput.className = 'shadow-overlay-input';
  heightInput.setAttribute('inputmode', 'decimal');

  const locationButton = document.createElement('button');
  locationButton.type = 'button';
  locationButton.className = 'shadow-overlay-button';
  locationButton.textContent = 'Use my location';
  locationButton.setAttribute('aria-label', 'Share your location to calculate sun angle and shadow length');

  // Manual coordinate inputs
  const coordsContainer = document.createElement('div');
  coordsContainer.className = 'shadow-overlay-coords';
  
  const latLabel = document.createElement('label');
  latLabel.textContent = 'Latitude';
  latLabel.className = 'shadow-overlay-label';
  latLabel.setAttribute('for', 'shadow-overlay-lat');
  
  const latInput = document.createElement('input');
  latInput.id = 'shadow-overlay-lat';
  latInput.type = 'number';
  latInput.min = '-90';
  latInput.max = '90';
  latInput.step = '0.0001';
  latInput.placeholder = 'e.g. 37.7749';
  latInput.className = 'shadow-overlay-input shadow-overlay-coord-input';
  latInput.setAttribute('inputmode', 'decimal');
  
  const lonLabel = document.createElement('label');
  lonLabel.textContent = 'Longitude';
  lonLabel.className = 'shadow-overlay-label';
  lonLabel.setAttribute('for', 'shadow-overlay-lon');
  
  const lonInput = document.createElement('input');
  lonInput.id = 'shadow-overlay-lon';
  lonInput.type = 'number';
  lonInput.min = '-180';
  lonInput.max = '180';
  lonInput.step = '0.0001';
  lonInput.placeholder = 'e.g. -122.4194';
  lonInput.className = 'shadow-overlay-input shadow-overlay-coord-input';
  lonInput.setAttribute('inputmode', 'decimal');
  
  coordsContainer.append(latLabel, latInput, lonLabel, lonInput);

  const status = document.createElement('div');
  status.className = 'shadow-overlay-status';
  status.textContent = 'Enter coordinates or use your location';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const results = document.createElement('div');
  results.className = 'shadow-overlay-results';
  results.setAttribute('aria-live', 'polite');
  results.innerHTML = `
    <div class="shadow-overlay-metric"><span>Shadow:</span><strong data-field="shadow">–</strong></div>
    <div class="shadow-overlay-metric"><span>Altitude:</span><strong data-field="altitude">–</strong></div>
    <div class="shadow-overlay-metric"><span>Azimuth:</span><strong data-field="azimuth">–</strong></div>
    <div class="shadow-overlay-metric"><span>Time:</span><strong data-field="time">–</strong></div>
  `;

  form.append(heightLabel, heightInput, locationButton, coordsContainer);
  calculator.append(form, status, results);

  // Right column: Shadow Clock and Visual Graph
  const rightColumn = document.createElement('div');
  rightColumn.className = 'shadow-overlay-right';

  // Shadow Clock - analog clock showing sun position
  const shadowClock = document.createElement('div');
  shadowClock.className = 'shadow-clock';
  shadowClock.innerHTML = `
    <div class="shadow-clock-face">
      <div class="shadow-clock-center"></div>
      <div class="shadow-clock-sun" data-field="clock-sun"></div>
      <div class="shadow-clock-shadow-arm" data-field="clock-shadow"></div>
      <div class="shadow-clock-hour-marks">
        <span class="hour-mark" style="--angle: 0deg">12</span>
        <span class="hour-mark" style="--angle: 30deg">1</span>
        <span class="hour-mark" style="--angle: 60deg">2</span>
        <span class="hour-mark" style="--angle: 90deg">3</span>
        <span class="hour-mark" style="--angle: 120deg">4</span>
        <span class="hour-mark" style="--angle: 150deg">5</span>
        <span class="hour-mark" style="--angle: 180deg">6</span>
        <span class="hour-mark" style="--angle: 210deg">7</span>
        <span class="hour-mark" style="--angle: 240deg">8</span>
        <span class="hour-mark" style="--angle: 270deg">9</span>
        <span class="hour-mark" style="--angle: 300deg">10</span>
        <span class="hour-mark" style="--angle: 330deg">11</span>
      </div>
    </div>
    <div class="shadow-clock-label">Sun Position</div>
  `;

  // Visual graph with wrapper for proper Y-axis containment
  const visualWrapper = document.createElement('div');
  visualWrapper.className = 'shadow-overlay-visual-wrapper';

  const visual = document.createElement('div');
  visual.className = 'shadow-overlay-visual';
  visual.innerHTML = `
    <div class="shadow-overlay-ground"></div>
    <div class="shadow-overlay-object" data-field="object"></div>
    <div class="shadow-overlay-shadow" data-field="shadow-bar"></div>
    <div class="shadow-overlay-y-axis">
      <span class="shadow-axis-label" data-field="y-max"></span>
      <span class="shadow-axis-label" data-field="y-mid"></span>
      <span class="shadow-axis-label" data-field="y-zero">0</span>
    </div>
    <div class="shadow-overlay-x-axis">
      <span class="shadow-axis-label" data-field="x-zero">0</span>
      <span class="shadow-axis-label" data-field="x-max"></span>
    </div>
  `;

  visualWrapper.appendChild(visual);
  rightColumn.append(shadowClock, visualWrapper);

  content.append(calculator, rightColumn);
  modal.append(header, content);
  backdrop.appendChild(modal);
  parent.appendChild(backdrop);

  let coords: GeoCoords | null = null;
  const listeners: Array<{ target: EventTarget; type: string; handler: EventListener }> = [];

  function setStatus(text: string): void {
    status.textContent = text;
  }

  function setField(field: string, value: string): void {
    const el = results.querySelector(`[data-field="${field}"]`);
    if (el) el.textContent = value;
  }

  function setAxisLabel(field: string, value: string): void {
    const el = visual.querySelector(`[data-field="${field}"]`);
    if (el) el.textContent = value;
  }

  function formatAxisValue(value: number): string {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    if (value >= 100) return value.toFixed(0);
    if (value >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }

  function updateVisual(heightMeters: number, shadowLength: number | null): void {
    const objectEl = visual.querySelector('[data-field="object"]') as HTMLElement;
    const shadowEl = visual.querySelector('[data-field="shadow-bar"]') as HTMLElement;
    
    // Determine the max values for axes (use actual values or defaults)
    const effectiveShadow = shadowLength ?? 0;
    const maxY = Math.max(heightMeters, 1);
    const maxX = Math.max(effectiveShadow, heightMeters, 1);
    
    // Scale factors to fit within visual bounds
    const yScale = VISUAL_HEIGHT_PX / maxY;
    const xScale = VISUAL_WIDTH_PX / maxX;
    
    // Calculate pixel sizes (always fit within frame)
    const objectHeightPx = Math.min(heightMeters * yScale, VISUAL_HEIGHT_PX);
    const shadowWidthPx = shadowLength !== null 
      ? Math.min(shadowLength * xScale, VISUAL_WIDTH_PX) 
      : 0;
    
    // Update object height
    objectEl.style.height = `${objectHeightPx}px`;
    objectEl.style.removeProperty('transform');
    
    // Update shadow
    if (shadowLength === null || shadowLength <= 0) {
      shadowEl.classList.add('is-hidden');
      shadowEl.style.width = '30px';
    } else {
      shadowEl.classList.remove('is-hidden');
      shadowEl.style.width = `${Math.max(shadowWidthPx, 4)}px`;
    }
    
    // Update axis labels
    setAxisLabel('y-max', formatAxisValue(maxY) + 'm');
    setAxisLabel('y-mid', formatAxisValue(maxY / 2) + 'm');
    setAxisLabel('x-max', formatAxisValue(maxX) + 'm');
  }

  function updateShadowClock(azimuthDeg: number, altitudeDeg: number): void {
    const sunEl = shadowClock.querySelector('[data-field="clock-sun"]') as HTMLElement;
    const shadowArmEl = shadowClock.querySelector('[data-field="clock-shadow"]') as HTMLElement;
    
    if (sunEl) {
      // Azimuth: 0° = North, 90° = East, 180° = South, 270° = West
      // Clock: 12 = top (0°), 3 = right (90°), 6 = bottom (180°), 9 = left (270°)
      // Map azimuth to clock position (rotate -90° so North is at top)
      const sunAngle = azimuthDeg;
      // Position sun on the edge of clock face based on azimuth
      // Altitude affects how far from center (higher = closer to center)
      const altitudeRatio = Math.max(0, altitudeDeg) / 90; // 0 at horizon, 1 at zenith
      const radius = 42 - (altitudeRatio * 20); // 42% at horizon, 22% at zenith
      
      sunEl.style.setProperty('--sun-angle', `${sunAngle}deg`);
      sunEl.style.setProperty('--sun-radius', `${radius}%`);
      sunEl.classList.toggle('is-below-horizon', altitudeDeg <= 0);
    }
    
    if (shadowArmEl) {
      // Shadow points opposite to sun (180° offset)
      const shadowAngle = (azimuthDeg + 180) % 360;
      shadowArmEl.style.setProperty('--shadow-angle', `${shadowAngle}deg`);
      shadowArmEl.classList.toggle('is-hidden', altitudeDeg <= 0);
    }
  }

  function update(): void {
    const heightMeters = Number(heightInput.value);
    if (!coords) {
      setField('shadow', 'Location needed');
      setField('altitude', '–');
      setField('azimuth', '–');
      setField('time', '–');
      updateVisual(heightMeters, null);
      return;
    }

    if (!Number.isFinite(heightMeters) || heightMeters < MIN_HEIGHT) {
      setField('shadow', `Enter ≥ ${MIN_HEIGHT} m`);
      updateVisual(heightMeters, null);
      return;
    }

    const now = new Date();
    let result;
    try {
      result = calculateShadowInfo({
        heightMeters,
        latitude: coords.latitude,
        longitude: coords.longitude,
        date: now,
      });
    } catch {
      setField('shadow', 'Calculation error');
      setField('altitude', '–');
      setField('azimuth', '–');
      setField('time', '–');
      setStatus('Shadow calculation failed');
      updateVisual(heightMeters, null);
      return;
    }

    const shadowText = result.shadowLengthMeters === null
      ? 'Sun below horizon'
      : `${result.shadowLengthMeters.toFixed(2)} m`;

    setField('shadow', shadowText);
    setField('altitude', `${result.altitudeDeg.toFixed(1)}°`);
    setField('azimuth', `${result.azimuthDeg.toFixed(1)}°`);
    setField('time', now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setStatus(`Lat ${coords.latitude.toFixed(4)}, Lon ${coords.longitude.toFixed(4)}`);
    updateVisual(heightMeters, result.shadowLengthMeters);
    updateShadowClock(result.azimuthDeg, result.altitudeDeg);
  }

  function handleGeoSuccess(position: GeolocationPosition): void {
    coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    // Update manual input fields with detected coords
    latInput.value = coords.latitude.toFixed(4);
    lonInput.value = coords.longitude.toFixed(4);
    setStatus('Location detected');
    update();
  }

  function handleGeoError(): void {
    setStatus('Location permission denied - enter coordinates manually');
  }

  function requestLocation(): void {
    if (!navigator.geolocation) {
      setStatus('Geolocation not supported - enter coordinates manually');
      return;
    }
    setStatus('Requesting location…');
    navigator.geolocation.getCurrentPosition(handleGeoSuccess, handleGeoError, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 15_000,
    });
  }

  function updateCoordsFromInputs(): void {
    const lat = Number(latInput.value);
    const lon = Number(lonInput.value);
    
    if (Number.isFinite(lat) && Number.isFinite(lon) && 
        lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      coords = { latitude: lat, longitude: lon };
      update();
    } else if (latInput.value || lonInput.value) {
      setStatus('Invalid coordinates');
      coords = null;
      setField('shadow', 'Valid coordinates needed');
      setField('altitude', '–');
      setField('azimuth', '–');
      setField('time', '–');
      updateVisual(Number(heightInput.value), null);
    }
  }

  function addListener(target: EventTarget, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    listeners.push({ target, type, handler });
  }

  // --- Modal Open/Close Logic ---
  let isOpen = false;

  function openModal(): void {
    if (isOpen) return;
    isOpen = true;
    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    
    // Focus management
    closeButton.focus();
    update();
  }

  function closeModal(): void {
    if (!isOpen) return;
    isOpen = false;
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
    
    // Return focus to trigger button
    triggerButton.focus();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && isOpen) {
      closeModal();
    }
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === backdrop) {
      closeModal();
    }
  }

  // Register listeners
  addListener(triggerButton, 'click', openModal as EventListener);
  addListener(closeButton, 'click', closeModal as EventListener);
  addListener(backdrop, 'click', handleBackdropClick as EventListener);
  addListener(document, 'keydown', handleKeyDown as EventListener);
  addListener(locationButton, 'click', requestLocation as EventListener);
  addListener(heightInput, 'input', update as EventListener);
  addListener(latInput, 'input', updateCoordsFromInputs as EventListener);
  addListener(lonInput, 'input', updateCoordsFromInputs as EventListener);

  // Refresh calculations periodically (every 30 seconds) using tracked interval
  safeSetInterval(() => {
    if (coords && isOpen) update();
  }, 30_000, resources);

  function destroy(): void {
    cancelAll(resources);
    triggerButton.remove();
    backdrop.remove();
    listeners.forEach(({ target, type, handler }) => target.removeEventListener(type, handler));
    listeners.length = 0;
    document.body.style.overflow = '';
  }

  return { destroy };
}
