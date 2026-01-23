/**
 * Modal UI - Shadow overlay modal structure, lifecycle, and event handling.
 *
 * Creates and manages the DOM structure for the modal popup, including
 * trigger button, backdrop, inputs, and results display.
 * Handles modal open/close, focus management with focus trap, and cleanup.
 */

import { createFocusTrap, type FocusTrapController } from '@core/utils/accessibility/focus-trap';

import type { GeoCoords, ShadowInfo } from './shadow-calculations';
import { updateShadowClock, updateVisual } from './visualizations';

const MIN_HEIGHT = 0.01;
const MAX_HEIGHT = 100;

/**
 * Modal UI state and handlers.
 */
export interface ModalUIState {
  triggerButton: HTMLElement;
  backdrop: HTMLElement;
  modal: HTMLElement;
  heightInput: HTMLInputElement;
  latInput: HTMLInputElement;
  lonInput: HTMLInputElement;
  closeModal(): void;
  openModal(): void;
  update(
    coords: GeoCoords | null,
    result: ShadowInfo | null,
    heightMeters: number,
    error?: string
  ): void;
  destroy(): void;
}

/**
 * Create modal UI elements and return handlers.
 *
 * @param parent - Parent element to append the overlay to
 * @returns Modal UI state with elements and handlers
 */
export function createModalUI(parent: HTMLElement): ModalUIState {
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

  const backdrop = document.createElement('div');
  backdrop.className = 'shadow-overlay-backdrop';
  backdrop.setAttribute('data-testid', 'shadow-overlay-backdrop');

  const modal = document.createElement('div');
  modal.className = 'shadow-overlay-modal';
  modal.setAttribute('data-testid', 'shadow-overlay-modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'shadow-overlay-title');

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

  const content = document.createElement('div');
  content.className = 'shadow-overlay-content';

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

  const rightColumn = document.createElement('div');
  rightColumn.className = 'shadow-overlay-right';

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

  let isOpen = false;
  let focusTrap: FocusTrapController | null = null;

  function setField(field: string, value: string): void {
    const el = results.querySelector(`[data-field="${field}"]`);
    if (el) el.textContent = value;
  }

  function setStatus(text: string): void {
    status.textContent = text;
  }

  function openModal(): void {
    if (isOpen) return;
    isOpen = true;
    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    focusTrap = createFocusTrap({
      container: modal,
      initialFocus: closeButton,
      escapeDeactivates: true,
      clickOutsideDeactivates: false,
      onEscape: closeModal,
    });
    focusTrap.activate();
  }

  function closeModal(): void {
    if (!isOpen) return;
    isOpen = false;
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';

    if (focusTrap) {
      focusTrap.deactivate();
      focusTrap = null;
    }

    triggerButton.focus();
  }

  triggerButton.addEventListener('click', openModal);
  closeButton.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (evt: MouseEvent) => evt.target === backdrop && closeModal());

  const keydownHandler = (evt: KeyboardEvent) => evt.key === 'Escape' && isOpen && closeModal();
  document.addEventListener('keydown', keydownHandler);

  return {
    triggerButton,
    backdrop,
    modal,
    heightInput,
    latInput,
    lonInput,
    closeModal,
    openModal,
    update(coords: GeoCoords | null, result: ShadowInfo | null, heightMeters: number, error?: string) {
      if (error) {
        setField('shadow', error);
        setField('altitude', '–');
        setField('azimuth', '–');
        setField('time', '–');
        setStatus('Error: ' + error);
        updateVisual(visual, heightMeters, null);
        return;
      }

      if (!coords) {
        setField('shadow', 'Location needed');
        setField('altitude', '–');
        setField('azimuth', '–');
        setField('time', '–');
        updateVisual(visual, heightMeters, null);
        return;
      }

      if (!result) {
        setField('shadow', 'Invalid height');
        updateVisual(visual, heightMeters, null);
        return;
      }

      const shadowText = result.shadowLengthMeters === null ? 'Sun below horizon' : `${result.shadowLengthMeters.toFixed(2)} m`;

      setField('shadow', shadowText);
      setField('altitude', `${result.altitudeDeg.toFixed(1)}°`);
      setField('azimuth', `${result.azimuthDeg.toFixed(1)}°`);
      setField('time', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setStatus(`Lat ${coords.latitude.toFixed(4)}, Lon ${coords.longitude.toFixed(4)}`);
      updateVisual(visual, heightMeters, result.shadowLengthMeters);
      updateShadowClock(shadowClock, result.azimuthDeg, result.altitudeDeg);
    },
    destroy() {
      triggerButton.removeEventListener('click', openModal);
      closeButton.removeEventListener('click', closeModal);
      backdrop.removeEventListener('click', (evt: MouseEvent) => evt.target === backdrop && closeModal());
      document.removeEventListener('keydown', keydownHandler);
      if (focusTrap) {
        focusTrap.deactivate();
        focusTrap = null;
      }
      backdrop.remove();
      document.body.style.overflow = '';
    },
  };
}
