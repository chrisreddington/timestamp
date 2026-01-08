import { describe, expect, it } from 'vitest';
import { calculateShadowInfo } from './shadow';

describe('calculateShadowInfo', () => {
  it('should throw for non-positive heights', () => {
    expect(() => calculateShadowInfo({ heightMeters: 0, latitude: 0, longitude: 0 })).toThrow(
      'heightMeters must be at least 0.01 meters'
    );
  });

  it('should return null shadow when sun is below horizon', () => {
    const date = new Date('2024-03-20T00:00:00Z');
    const result = calculateShadowInfo({ heightMeters: 1, latitude: 0, longitude: 0, date });

    expect(result.isSunAboveHorizon).toBe(false);
    expect(result.shadowLengthMeters).toBeNull();
  });

  it('should compute short shadow near solar noon at equator on equinox', () => {
    const date = new Date('2024-03-20T12:00:00Z');
    const result = calculateShadowInfo({ heightMeters: 2, latitude: 0, longitude: 0, date });

    expect(result.isSunAboveHorizon).toBe(true);
    expect(result.altitudeDeg).toBeGreaterThan(85);
    expect(result.shadowLengthMeters).not.toBeNull();
    expect(result.shadowLengthMeters ?? 0).toBeLessThan(0.2);
  });
});
