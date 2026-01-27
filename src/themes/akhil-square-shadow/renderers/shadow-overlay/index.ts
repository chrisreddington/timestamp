/**
 * Shadow Overlay - Sun angle and shadow length calculator popup for the theme.
 *
 * A popup modal triggered by a button that allows users to:
 * - Enter an object height and calculate real-time shadow length
 * - Use geolocation or manually enter coordinates
 *
 * Exports:
 * - createShadowOverlay: Main entry point
 * - ShadowOverlayController: Interface for component lifecycle
 */

import { cancelAll, createResourceTracker, safeSetInterval } from '@themes/shared';

import { createModalUI } from './modal-ui';
import { calculateShadowInfo, type GeoCoords } from './shadow-calculations';

/**
 * Controller for the shadow overlay component.
 */
export interface ShadowOverlayController {
  destroy(): void;
}

const MIN_HEIGHT = 0.01;

const SHADOW_UPDATE_INTERVAL_MS = 30_000;
const GEOLOCATION_TIMEOUT_MS = 5_000;

/**
 * Create a shadow overlay popup with trigger button.
 *
 * Sets up the modal UI, geolocation handler, input handlers, and
 * periodic update loop. Manages all resources for cleanup.
 *
 * @param parent - Parent element to append the overlay to
 * @returns Controller with destroy method
 */
export function createShadowOverlay(parent: HTMLElement): ShadowOverlayController {
  const resources = createResourceTracker();
  const modalUI = createModalUI(parent);

  let coords: GeoCoords | null = null;
  let isOpen = false;

  /** Handle geolocation success. */
  function handleGeoSuccess(position: GeolocationPosition): void {
    coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    modalUI.latInput.value = coords.latitude.toFixed(4);
    modalUI.lonInput.value = coords.longitude.toFixed(4);
    update();
  }

  /** Handle geolocation error. */
  function handleGeoError(error: GeolocationPositionError): void {
    let message = 'Unable to determine your location.';
    if (error.code === error.PERMISSION_DENIED) {
      message = 'Location permission was denied. You can enter coordinates manually.';
    } else if (error.code === error.POSITION_UNAVAILABLE) {
      message = 'Location information is currently unavailable.';
    } else if (error.code === error.TIMEOUT) {
      message = 'Location request timed out. Please try again.';
    }
    const heightMeters = Number(modalUI.heightInput.value);
    modalUI.update(null, null, heightMeters, message);
  }

  /** Request user's location via geolocation API. */
  function requestLocation(): void {
    if (!navigator.geolocation) {
      const heightMeters = Number(modalUI.heightInput.value);
      modalUI.update(null, null, heightMeters, 'Geolocation not supported. Please enter coordinates manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(handleGeoSuccess, handleGeoError, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: GEOLOCATION_TIMEOUT_MS,
    });
  }

  /** Update calculations based on current inputs and coordinates. */
  function update(): void {
    const heightMeters = Number(modalUI.heightInput.value);

    if (!Number.isFinite(heightMeters) || heightMeters < MIN_HEIGHT) {
      modalUI.update(coords, null, heightMeters, `Enter ≥ ${MIN_HEIGHT} m`);
      return;
    }

    if (!coords) {
      modalUI.update(null, null, heightMeters);
      return;
    }

    try {
      const result = calculateShadowInfo({
        heightMeters,
        latitude: coords.latitude,
        longitude: coords.longitude,
        date: new Date(),
      });
      modalUI.update(coords, result, heightMeters);
    } catch {
      modalUI.update(coords, null, heightMeters, 'Calculation error');
    }
  }

  /** Update coordinates from manual input fields. */
  function updateCoordsFromInputs(): void {
    const lat = Number(modalUI.latInput.value);
    const lon = Number(modalUI.lonInput.value);

    if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      coords = { latitude: lat, longitude: lon };
      update();
    } else if (modalUI.latInput.value || modalUI.lonInput.value) {
      coords = null;
      modalUI.update(null, null, Number(modalUI.heightInput.value), 'Invalid coordinates');
    }
  }

  modalUI.heightInput.addEventListener('input', update);
  modalUI.latInput.addEventListener('input', updateCoordsFromInputs);
  modalUI.lonInput.addEventListener('input', updateCoordsFromInputs);

  const locationButtonElement = modalUI.modal.querySelector('button.shadow-overlay-button');
  if (locationButtonElement) {
    locationButtonElement.addEventListener('click', requestLocation);
  }

  const openHandler = () => {
    isOpen = true;
  };

  modalUI.triggerButton.addEventListener('click', openHandler);

  safeSetInterval(() => {
    if (coords && isOpen) update();
  }, SHADOW_UPDATE_INTERVAL_MS, resources);

  function destroy(): void {
    cancelAll(resources);
    modalUI.destroy();
    modalUI.heightInput.removeEventListener('input', update);
    modalUI.latInput.removeEventListener('input', updateCoordsFromInputs);
    modalUI.lonInput.removeEventListener('input', updateCoordsFromInputs);
    modalUI.triggerButton.removeEventListener('click', openHandler);
    if (locationButtonElement) {
      locationButtonElement.removeEventListener('click', requestLocation);
    }
  }

  return { destroy };
}

export type { ShadowInfo } from './shadow-calculations';
export { calculateShadowInfo } from './shadow-calculations';
