import { describe, expect, vi, beforeEach, afterEach, test } from 'vitest';
import { createShadowOverlay } from './shadow-overlay';
import { calculateShadowInfo } from '@core/solar/shadow';

vi.mock('@core/solar/shadow', () => ({
  calculateShadowInfo: vi.fn(),
}));

const mockCalculateShadowInfo = calculateShadowInfo as unknown as ReturnType<typeof vi.fn>;

interface MockGeoSuccess {
  coords: { latitude: number; longitude: number };
}

describe('shadow-overlay', () => {
  const originalNavigator = global.navigator;
  let geoSuccess: ((pos: MockGeoSuccess) => void) | null = null;
  let geoError: (() => void) | null = null;
  let parent: HTMLElement;

  beforeEach(() => {
    geoSuccess = null;
    geoError = null;
    parent = document.createElement('div');
    parent.style.position = 'relative';
    document.body.appendChild(parent);
    // @ts-expect-error override for tests
    global.navigator = {
      geolocation: {
        getCurrentPosition: vi.fn((success: (pos: MockGeoSuccess) => void, error: () => void) => {
          geoSuccess = success;
          geoError = error;
        }),
      },
    } as Navigator;
    mockCalculateShadowInfo.mockReset();
  });

  afterEach(() => {
    // @ts-expect-error restore
    global.navigator = originalNavigator;
    parent.remove();
    document.body.innerHTML = '';
  });

  function render() {
    const controller = createShadowOverlay(parent);
    const overlay = parent.querySelector('[data-testid="cg-shadow-overlay"]') as HTMLElement;
    const status = overlay.querySelector('.cg-shadow-status') as HTMLElement;
    const shadowField = overlay.querySelector('[data-field="shadow"]') as HTMLElement;
    const altitudeField = overlay.querySelector('[data-field="altitude"]') as HTMLElement;
    const locationButton = overlay.querySelector('.cg-shadow-button') as HTMLElement;
    return { controller, overlay, status, shadowField, altitudeField, locationButton };
  }

  test('renders overlay and updates on geolocation success', () => {
    mockCalculateShadowInfo.mockReturnValue({ altitudeDeg: 50, azimuthDeg: 120, shadowLengthMeters: 3 });
    const { overlay, status, shadowField, altitudeField, locationButton } = render();

    expect(overlay).toBeTruthy();
    expect(status.textContent).toContain('Click "Use my location"');

    // Click button to trigger geolocation request
    locationButton.click();

    geoSuccess?.({ coords: { latitude: 5, longitude: 15 } });

    expect(status.textContent).toContain('Lat 5.0000, Lon 15.0000');
    expect(shadowField.textContent).toContain('3.00');
    expect(altitudeField.textContent).toContain('50.0');
  });

  test('handles geolocation error', () => {
    const { status, shadowField, locationButton } = render();

    // Click button to trigger geolocation request
    locationButton.click();

    geoError?.();

    expect(status.textContent).toContain('permission needed');
    expect(shadowField.textContent).toContain('Location required');
  });

  test('handles calculation error gracefully', () => {
    mockCalculateShadowInfo.mockImplementation(() => {
      throw new Error('boom');
    });
    const { status, shadowField, locationButton } = render();

    // Click button to trigger geolocation request
    locationButton.click();

    geoSuccess?.({ coords: { latitude: 1, longitude: 2 } });

    expect(status.textContent).toContain('failed');
    expect(shadowField.textContent).toContain('Calculation error');
  });
});

