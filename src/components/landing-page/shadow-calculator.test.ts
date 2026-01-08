import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { createShadowCalculator } from './shadow-calculator';
import { calculateShadowInfo } from '@core/solar/shadow';

vi.mock('@core/solar/shadow', () => ({
  calculateShadowInfo: vi.fn(),
}));

const mockCalculateShadowInfo = calculateShadowInfo as unknown as ReturnType<typeof vi.fn>;

interface MockGeoSuccess {
  coords: { latitude: number; longitude: number };
}
describe('shadow-calculator', () => {
  const originalNavigator = global.navigator;
  let geoSuccess: ((pos: MockGeoSuccess) => void) | null = null;
  let geoError: (() => void) | null = null;

  beforeEach(() => {
    geoSuccess = null;
    geoError = null;
    // @ts-expect-error override for tests
    global.navigator = {
      geolocation: {
        getCurrentPosition: vi.fn((success: (pos: MockGeoSuccess) => void, error: () => void) => {
          geoSuccess = success;
          geoError = error;
        }),
      },
    } as Navigator;
    document.body.innerHTML = '';
    mockCalculateShadowInfo.mockReset();
  });

  afterEach(() => {
    // @ts-expect-error restore
    global.navigator = originalNavigator;
    document.body.innerHTML = '';
  });

  function render() {
    const controller = createShadowCalculator();
    document.body.appendChild(controller.getElement());
    const section = document.querySelector('[data-testid="landing-shadow-section"]') as HTMLElement;
    const status = section.querySelector('[data-testid="shadow-location-status"]') as HTMLElement;
    const button = section.querySelector('[data-testid="shadow-location-button"]') as HTMLButtonElement;
    const results = section.querySelector('[data-testid="shadow-results"]') as HTMLElement;
    const heightInput = section.querySelector('#shadow-height-input') as HTMLInputElement;
    return { controller, section, status, button, results, heightInput };
  }

  test('renders and requests location on button click', () => {
    mockCalculateShadowInfo.mockReturnValue({ altitudeDeg: 45, azimuthDeg: 135, shadowLengthMeters: 2 });
    const { status, button, results } = render();

    expect(status.textContent).toContain('Click "Use my location"');

    button.click();
    expect(geoSuccess).toBeTruthy();
    geoSuccess?.({ coords: { latitude: 10, longitude: 20 } });

    expect(status.textContent).toContain('Location detected');
    expect(results.textContent).toContain('2.00');
    expect(results.textContent).toContain('45.0');
    expect(results.textContent).toContain('135.0');
  });

  test('handles geolocation error', () => {
    const { status, button, results } = render();

    button.click();
    expect(geoError).toBeTruthy();
    geoError?.();

    expect(status.textContent).toContain('Unable to access location');
    expect(results.textContent).toContain('Location required');
  });

  test('handles calculation error gracefully', () => {
    mockCalculateShadowInfo.mockImplementation(() => {
      throw new Error('boom');
    });
    const { status, button, results } = render();

    button.click();
    geoSuccess?.({ coords: { latitude: 11, longitude: 22 } });

    expect(status.textContent).not.toContain('boom');
    expect(results.textContent).toContain('Calculation error');
  });
});


