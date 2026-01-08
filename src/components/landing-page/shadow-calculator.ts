import { calculateShadowInfo } from '@core/solar/shadow';

interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface ShadowCalculatorController {
  getElement(): HTMLElement;
  destroy(): void;
}

const LOCATION_ERROR_MESSAGE = 'Unable to access location. Allow permission and try again.';
const DEFAULT_HEIGHT_METERS = 1;

/**
 * Create a lightweight shadow calculator widget for the landing page.
 * Users provide an object height; we derive location (via geolocation), current time,
 * sun altitude/azimuth, and expected shadow length.
 */
export function createShadowCalculator(): ShadowCalculatorController {
  let destroyed = false;
  let coords: GeoCoordinates | null = null;
  const listeners: Array<{ target: EventTarget; type: string; handler: EventListener }> = [];

  const section = document.createElement('section');
  section.className = 'landing-form-section landing-shadow-section';
  section.setAttribute('data-testid', 'landing-shadow-section');

  const title = document.createElement('div');
  title.className = 'landing-section-title';
  title.textContent = 'Shadow & Sun Angle';

  const description = document.createElement('p');
  description.className = 'landing-shadow-description';
  description.textContent = 'Enter an object height to see the sun altitude, azimuth, and estimated shadow length using your current location and time.';

  const formRow = document.createElement('div');
  formRow.className = 'landing-shadow-row';

  const heightLabel = document.createElement('label');
  heightLabel.className = 'landing-shadow-label';
  heightLabel.textContent = 'Object height (meters)';
  heightLabel.setAttribute('for', 'shadow-height-input');

  const heightInput = document.createElement('input');
  heightInput.type = 'number';
  heightInput.min = '0.01';
  heightInput.step = '0.01';
  heightInput.value = String(DEFAULT_HEIGHT_METERS);
  heightInput.id = 'shadow-height-input';
  heightInput.setAttribute('data-testid', 'shadow-height-input');

  const locationButton = document.createElement('button');
  locationButton.type = 'button';
  locationButton.className = 'landing-shadow-location-button';
  locationButton.textContent = 'Use my location';
  locationButton.setAttribute('data-testid', 'shadow-location-button');

  const locationStatus = document.createElement('div');
  locationStatus.className = 'landing-shadow-status';
  locationStatus.setAttribute('data-testid', 'shadow-location-status');
  locationStatus.textContent = 'Waiting for location…';

  const resultsList = document.createElement('dl');
  resultsList.className = 'landing-shadow-results';
  resultsList.setAttribute('data-testid', 'shadow-results');

  formRow.append(heightLabel, heightInput, locationButton);

  section.append(title, description, formRow, locationStatus, resultsList);

  function addListener(target: EventTarget, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    listeners.push({ target, type, handler });
  }

  function setStatus(text: string): void {
    locationStatus.textContent = text;
  }

  function setResults(content: Array<[string, string]>): void {
    resultsList.replaceChildren();
    for (const [label, value] of content) {
      const term = document.createElement('dt');
      term.textContent = label;
      const detail = document.createElement('dd');
      detail.textContent = value;
      resultsList.append(term, detail);
    }
  }

  function updateResults(): void {
    const heightMeters = Number(heightInput.value);
    if (!coords) {
      setResults([
        ['Shadow length', 'Waiting for location…'],
        ['Sun altitude', '–'],
        ['Sun azimuth', '–'],
        ['Time', '–'],
      ]);
      return;
    }

    if (Number.isNaN(heightMeters) || heightMeters < 0.01) {
      setResults([
        ['Shadow length', 'Enter a height ≥ 0.01m'],
        ['Sun altitude', '–'],
        ['Sun azimuth', '–'],
        ['Time', '–'],
      ]);
      return;
    }

    const now = new Date();
    const result = calculateShadowInfo({
      heightMeters,
      latitude: coords.latitude,
      longitude: coords.longitude,
      date: now,
    });

    const shadow = result.shadowLengthMeters;
    const shadowText = shadow === null ? 'Sun below horizon' : `${shadow.toFixed(2)} m`;
    const altitudeText = `${result.altitudeDeg.toFixed(1)}°`;
    const azimuthText = `${result.azimuthDeg.toFixed(1)}°`;

    setResults([
      ['Shadow length', shadowText],
      ['Sun altitude', altitudeText],
      ['Sun azimuth', azimuthText],
      ['Time', now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })],
    ]);
  }

  function handleGeoSuccess(position: GeolocationPosition): void {
    if (destroyed) return;
    coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    const latText = coords.latitude.toFixed(4);
    const lonText = coords.longitude.toFixed(4);
    setStatus(`Location detected: ${latText}, ${lonText}`);
    updateResults();
  }

  function handleGeoError(): void {
    coords = null;
    setStatus(LOCATION_ERROR_MESSAGE);
    setResults([
      ['Shadow length', 'Location required'],
      ['Sun altitude', 'Location required'],
      ['Sun azimuth', 'Location required'],
      ['Time', '–'],
    ]);
  }

  function requestLocation(): void {
    if (!navigator.geolocation) {
      handleGeoError();
      return;
    }

    setStatus('Requesting location…');
    navigator.geolocation.getCurrentPosition(handleGeoSuccess, handleGeoError, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 15_000,
    });
  }

  addListener(locationButton, 'click', requestLocation as EventListener);
  addListener(heightInput, 'input', updateResults as EventListener);

  // Kick off initial request
  requestLocation();

  function destroy(): void {
    destroyed = true;
    for (const { target, type, handler } of listeners) {
      target.removeEventListener(type, handler);
    }
    listeners.length = 0;
  }

  return {
    getElement: () => section,
    destroy,
  };
}
