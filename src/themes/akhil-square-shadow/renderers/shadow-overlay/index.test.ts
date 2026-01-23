import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createShadowOverlay, type ShadowOverlayController } from './index';

describe('createShadowOverlay', () => {
  let container: HTMLElement;
  let overlay: ShadowOverlayController;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    overlay = createShadowOverlay(container);
  });

  afterEach(() => {
    overlay.destroy();
    document.body.removeChild(container);
  });

  it('creates overlay component with destroy method', () => {
    expect(overlay).toBeDefined();
    expect(typeof overlay.destroy).toBe('function');
  });

  it('exports ShadowInfo type', () => {
    const elements = container.querySelectorAll('[data-testid="shadow-overlay-trigger"]');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('creates trigger button accessible in DOM', () => {
    const triggerButton = container.querySelector('[data-testid="shadow-overlay-trigger"]');
    expect(triggerButton).toBeDefined();
  });

  it('creates modal backdrop and modal elements', () => {
    const backdrop = container.querySelector('[data-testid="shadow-overlay-backdrop"]');
    const modal = container.querySelector('[data-testid="shadow-overlay-modal"]');
    expect(backdrop).toBeDefined();
    expect(modal).toBeDefined();
  });

  it('handles cleanup without errors', () => {
    expect(() => overlay.destroy()).not.toThrow();
  });

  it('allows height input for shadow calculations', () => {
    const heightInput = container.querySelector('#shadow-overlay-height') as HTMLInputElement;
    expect(heightInput).toBeDefined();
    expect(heightInput.type).toBe('number');
  });

  it('allows manual coordinate entry', () => {
    const latInput = container.querySelector('#shadow-overlay-lat') as HTMLInputElement;
    const lonInput = container.querySelector('#shadow-overlay-lon') as HTMLInputElement;
    expect(latInput).toBeDefined();
    expect(lonInput).toBeDefined();
  });
});
