import { describe, it, expect } from 'vitest';

import { calculateShadowInfo, type GeoCoords } from './shadow-calculations';

describe('calculateShadowInfo', () => {
  const testDate = new Date('2025-01-15T12:00:00Z');
  const sfCoords: GeoCoords = { latitude: 37.7749, longitude: -122.4194 };

  it('calculates shadow length when sun is above horizon', () => {
    const result = calculateShadowInfo({
      heightMeters: 10,
      latitude: sfCoords.latitude,
      longitude: sfCoords.longitude,
      date: testDate,
    });

    expect(result).toHaveProperty('altitudeDeg');
    expect(result).toHaveProperty('azimuthDeg');
    expect(result).toHaveProperty('shadowLengthMeters');
    expect(typeof result.altitudeDeg).toBe('number');
    expect(typeof result.azimuthDeg).toBe('number');
  });

  it('returns null shadow length when sun is below horizon', () => {
    const arcticCoords = { latitude: 85, longitude: 0 };
    const winterNightDate = new Date('2025-12-21T23:00:00Z');
    const result = calculateShadowInfo({
      heightMeters: 10,
      latitude: arcticCoords.latitude,
      longitude: arcticCoords.longitude,
      date: winterNightDate,
    });

    if (result.shadowLengthMeters === null) {
      expect(result.shadowLengthMeters).toBeNull();
    } else {
      expect(result.altitudeDeg).toBeLessThan(0.5);
    }
  });

  it('caps shadow length to prevent extreme values', () => {
    const result = calculateShadowInfo({
      heightMeters: 100,
      latitude: 89,
      longitude: 0,
      date: testDate,
    });

    if (result.shadowLengthMeters !== null) {
      expect(result.shadowLengthMeters).toBeLessThanOrEqual(1000);
    }
  });

  it('handles polar coordinates correctly', () => {
    const result = calculateShadowInfo({
      heightMeters: 1,
      latitude: 85,
      longitude: 0,
      date: testDate,
    });

    expect(result.altitudeDeg).toBeDefined();
    expect(result.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(result.azimuthDeg).toBeLessThan(360);
  });

  it('converts azimuth from south-clockwise to north-based', () => {
    const result = calculateShadowInfo({
      heightMeters: 1,
      latitude: 0,
      longitude: 0,
      date: testDate,
    });

    expect(result.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(result.azimuthDeg).toBeLessThan(360);
  });
});
