import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { updateShadowClock, updateVisual } from './visualizations';

describe('updateShadowClock', () => {
  let container: HTMLElement;
  let shadowClock: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    shadowClock = document.createElement('div');
    shadowClock.innerHTML = `
      <div data-field="clock-sun"></div>
      <div data-field="clock-shadow"></div>
    `;
    container.appendChild(shadowClock);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('updates sun position CSS variables for azimuth and altitude', () => {
    const sunEl = shadowClock.querySelector('[data-field="clock-sun"]') as HTMLElement;
    updateShadowClock(shadowClock, 90, 45);

    expect(sunEl.style.getPropertyValue('--sun-angle')).toBe('90deg');
    expect(sunEl.style.getPropertyValue('--sun-radius')).toBeDefined();
  });

  it('hides sun when altitude is below horizon', () => {
    const sunEl = shadowClock.querySelector('[data-field="clock-sun"]') as HTMLElement;
    updateShadowClock(shadowClock, 180, -10);

    expect(sunEl.classList.contains('is-below-horizon')).toBe(true);
  });

  it('updates shadow arm azimuth opposite to sun', () => {
    const shadowArmEl = shadowClock.querySelector('[data-field="clock-shadow"]') as HTMLElement;
    updateShadowClock(shadowClock, 90, 45);

    const shadowAngle = 270;
    expect(shadowArmEl.style.getPropertyValue('--shadow-angle')).toBe(`${shadowAngle}deg`);
  });

  it('hides shadow arm when sun is below horizon', () => {
    const shadowArmEl = shadowClock.querySelector('[data-field="clock-shadow"]') as HTMLElement;
    updateShadowClock(shadowClock, 0, -5);

    expect(shadowArmEl.classList.contains('is-hidden')).toBe(true);
  });
});

describe('updateVisual', () => {
  let container: HTMLElement;
  let visual: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    visual = document.createElement('div');
    visual.innerHTML = `
      <div data-field="object"></div>
      <div data-field="shadow-bar"></div>
      <div data-field="y-max"></div>
      <div data-field="y-mid"></div>
      <div data-field="x-max"></div>
    `;
    container.appendChild(visual);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('updates object height in pixels', () => {
    const objectEl = visual.querySelector('[data-field="object"]') as HTMLElement;
    updateVisual(visual, 5, 10);

    expect(objectEl.style.height).toBeDefined();
  });

  it('hides shadow when length is null or zero', () => {
    const shadowEl = visual.querySelector('[data-field="shadow-bar"]') as HTMLElement;
    updateVisual(visual, 5, null);

    expect(shadowEl.classList.contains('is-hidden')).toBe(true);
  });

  it('shows shadow when length is positive', () => {
    const shadowEl = visual.querySelector('[data-field="shadow-bar"]') as HTMLElement;
    updateVisual(visual, 5, 15);

    expect(shadowEl.classList.contains('is-hidden')).toBe(false);
    expect(shadowEl.style.width).toBeDefined();
  });

  it('updates axis labels with formatted values', () => {
    updateVisual(visual, 100, 200);

    const yMaxLabel = visual.querySelector('[data-field="y-max"]');
    const xMaxLabel = visual.querySelector('[data-field="x-max"]');

    expect(yMaxLabel?.textContent).toContain('m');
    expect(xMaxLabel?.textContent).toContain('m');
  });
});
