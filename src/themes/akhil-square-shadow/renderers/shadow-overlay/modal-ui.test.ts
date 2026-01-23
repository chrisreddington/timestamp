import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { createModalUI, type ModalUIState } from './modal-ui';

describe('createModalUI', () => {
  let container: HTMLElement;
  let modalUI: ModalUIState;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    modalUI = createModalUI(container);
  });

  afterEach(() => {
    modalUI.destroy();
    document.body.removeChild(container);
  });

  it('creates trigger button in parent element', () => {
    expect(modalUI.triggerButton).toBeDefined();
    expect(modalUI.triggerButton.className).toContain('shadow-overlay-trigger');
  });

  it('creates backdrop and modal elements', () => {
    expect(modalUI.backdrop).toBeDefined();
    expect(modalUI.modal).toBeDefined();
    expect(modalUI.backdrop.className).toContain('shadow-overlay-backdrop');
    expect(modalUI.modal.className).toContain('shadow-overlay-modal');
  });

  it('creates input elements for height, latitude, and longitude', () => {
    expect(modalUI.heightInput).toBeDefined();
    expect(modalUI.latInput).toBeDefined();
    expect(modalUI.lonInput).toBeDefined();
    expect(modalUI.heightInput.id).toBe('shadow-overlay-height');
    expect(modalUI.latInput.id).toBe('shadow-overlay-lat');
    expect(modalUI.lonInput.id).toBe('shadow-overlay-lon');
  });

  it('opens modal when trigger button is clicked', () => {
    expect(modalUI.backdrop.classList.contains('is-open')).toBe(false);
    modalUI.openModal();
    expect(modalUI.backdrop.classList.contains('is-open')).toBe(true);
  });

  it('closes modal when close is called', () => {
    modalUI.openModal();
    expect(modalUI.backdrop.classList.contains('is-open')).toBe(true);
    modalUI.closeModal();
    expect(modalUI.backdrop.classList.contains('is-open')).toBe(false);
  });

  it('disables body scroll when modal is open', () => {
    modalUI.openModal();
    expect(document.body.style.overflow).toBe('hidden');
    modalUI.closeModal();
    expect(document.body.style.overflow).toBe('');
  });

  it('updates results fields via update method', () => {
    modalUI.update(
      { latitude: 37.7749, longitude: -122.4194 },
      {
        altitudeDeg: 45,
        azimuthDeg: 180,
        shadowLengthMeters: 10,
      },
      5
    );

    const shadowField = modalUI.modal.querySelector('[data-field="shadow"]');
    expect(shadowField?.textContent).toContain('10.00');
  });

  it('displays error messages when update called with error', () => {
    modalUI.update(null, null, 5, 'Test error message');

    const shadowField = modalUI.modal.querySelector('[data-field="shadow"]');
    expect(shadowField?.textContent).toBe('Test error message');
  });

  it('handles null shadow length (sun below horizon)', () => {
    modalUI.update(
      { latitude: 37.7749, longitude: -122.4194 },
      {
        altitudeDeg: -10,
        azimuthDeg: 180,
        shadowLengthMeters: null,
      },
      5
    );

    const shadowField = modalUI.modal.querySelector('[data-field="shadow"]');
    expect(shadowField?.textContent).toContain('Sun below horizon');
  });

  it('removes all event listeners on destroy', () => {
    const removeSpy = vi.spyOn(modalUI.triggerButton, 'removeEventListener');
    modalUI.destroy();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('removes backdrop from DOM on destroy', () => {
    expect(modalUI.backdrop.parentElement).toBeDefined();
    modalUI.destroy();
    expect(modalUI.backdrop.parentElement).toBeNull();
  });
});
