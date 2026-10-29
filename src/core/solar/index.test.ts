/**
 * Tests for solar calculation utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as SunCalc from 'suncalc';
// Passthrough mock so ESM exports stay spy-able
vi.mock('suncalc', async (importOriginal) => ({ ...(await importOriginal<typeof import('suncalc')>()) }));

import { isNight, getNightRegionPath, clearSolarCache, _testExports } from './index';

const { getSolarDeclination, getTerminatorPoints, getSubsolarLongitude } = _testExports;

const toDate = (iso: string) => new Date(iso);
const mockProjection = (lat: number, lng: number) => ({
  x: ((lng + 180) / 360) * 400,
  y: ((90 - lat) / 180) * 200,
});
const DEC_31_NOON = new Date('2024-12-31T12:00:00.000Z');
const DEC_31_MIDNIGHT = new Date('2024-12-31T00:00:00.000Z');
const VIEW_BOX = { width: 400, height: 200 } as const;

beforeEach(() => {
  clearSolarCache();
});

describe('isNight', () => {
  it.each([
    { name: 'Tokyo at noon UTC', lat: 35.68, lng: 139.69, date: DEC_31_NOON, expected: true },
    { name: 'Sydney at noon UTC', lat: -33.87, lng: 151.21, date: DEC_31_NOON, expected: true },
    { name: 'London at noon UTC', lat: 51.51, lng: -0.13, date: DEC_31_NOON, expected: false },
    { name: 'London at midnight UTC', lat: 51.51, lng: -0.13, date: DEC_31_MIDNIGHT, expected: true },
    { name: 'Sydney at midnight UTC', lat: -33.87, lng: 151.21, date: DEC_31_MIDNIGHT, expected: false },
  ])('should classify $name as $expected', ({ lat, lng, date, expected }) => {
    expect(isNight(lat, lng, date)).toBe(expected);
  });

  it('should treat -180 and +180 longitudes equivalently', () => {
    const date = DEC_31_NOON;
    expect(isNight(0, -180, date)).toBe(isNight(0, 180, date));
  });
});

describe('getNightRegionPath', () => {
  it('should return a closed SVG path', () => {
    const path = getNightRegionPath(DEC_31_NOON, mockProjection, VIEW_BOX);
    expect(path).toMatch(/^M/);
    expect(path).toMatch(/Z$/);
  });

  it('should produce different paths for different times', () => {
    const path1 = getNightRegionPath(DEC_31_MIDNIGHT, mockProjection, VIEW_BOX);
    const path2 = getNightRegionPath(DEC_31_NOON, mockProjection, VIEW_BOX);
    expect(path1).not.toBe(path2);
  });

  it('should reference viewBox boundaries', () => {
    const path = getNightRegionPath(DEC_31_NOON, mockProjection, VIEW_BOX);
    expect(path).toMatch(/(400|200|0)/);
  });
});

describe('getTerminatorPoints (internal)', () => {
  it('should return requested number of points', () => {
    expect(getTerminatorPoints(DEC_31_NOON).length).toBe(72);
    expect(getTerminatorPoints(DEC_31_NOON, 36).length).toBe(36);
  });

  it('should constrain points to valid ranges', () => {
    getTerminatorPoints(DEC_31_NOON).forEach((p) => {
      expect(p.lat).toBeGreaterThanOrEqual(-90);
      expect(p.lat).toBeLessThanOrEqual(90);
      expect(p.lng).toBeGreaterThanOrEqual(-180);
      expect(p.lng).toBeLessThanOrEqual(180);
    });
  });

  it('should use meridian path when declination is near zero (equinox)', () => {
    const date = new Date('2024-03-20T03:06:00.000Z');
    const getTimesSpy = vi.spyOn(SunCalc, 'getTimes').mockReturnValue({ solarNoon: date } as never);
    const getPositionSpy = vi
      .spyOn(SunCalc, 'getPosition')
      .mockImplementation((calledDate: Date, lat: number) => {
        if (calledDate.getTime() === date.getTime() && lat === 0) {
          return { altitude: 90, azimuth: 0 } as never;
        }
        return { altitude: 0, azimuth: 0 } as never;
      });

    const points = getTerminatorPoints(date, 12);

    const firstLng = points[0].lng;
    points.forEach((point) => {
      expect(point.lng).toBeCloseTo(firstLng, 6);
    });

    getTimesSpy.mockRestore();
    getPositionSpy.mockRestore();
  });

  it('should return terminator points sorted by longitude', () => {
    const points = getTerminatorPoints(DEC_31_NOON, 24);

    for (let i = 1; i < points.length; i++) {
      expect(points[i].lng).toBeGreaterThanOrEqual(points[i - 1].lng);
    }
  });
});

describe('getSolarDeclination (internal)', () => {
  it.each([
    { desc: 'winter solstice', date: '2024-12-21T12:00:00Z', min: -25, max: -20 },
    { desc: 'summer solstice', date: '2024-06-21T12:00:00Z', min: 20, max: 25 },
    { desc: 'equinox', date: '2024-03-20T12:00:00Z', min: -5, max: 5 },
  ])('should return correct declination for $desc', ({ date, min, max }) => {
    const dec = getSolarDeclination(toDate(date));
    expect(dec).toBeGreaterThan(min);
    expect(dec).toBeLessThan(max);
  });

  it('should cache results within same minute', () => {
    const d1 = getSolarDeclination(DEC_31_NOON);
    const d2 = getSolarDeclination(new Date('2024-12-31T12:00:30.000Z'));
    expect(d1).toBeCloseTo(d2, 10);
  });

  it('should evict oldest cache entry once capacity is exceeded', () => {
    const getTimesSpy = vi.spyOn(SunCalc, 'getTimes');
    const baseDate = new Date('2024-01-01T00:00:00.000Z');

    getSolarDeclination(baseDate);

    for (let i = 1; i <= 60; i++) {
      getSolarDeclination(new Date(baseDate.getTime() + i * 60_000));
    }

    const callsBeforeRecall = getTimesSpy.mock.calls.length;
    getSolarDeclination(baseDate);

    expect(getTimesSpy.mock.calls.length).toBe(callsBeforeRecall + 1);

    getTimesSpy.mockRestore();
  });
});

describe('getSubsolarLongitude (internal)', () => {
  it.each([
    { iso: '2024-01-01T00:00:00.000Z', expected: -180 },
    { iso: '2024-01-01T06:00:00.000Z', expected: 90 },
    { iso: '2024-01-01T12:00:00.000Z', expected: 0 },
    { iso: '2024-01-01T18:00:00.000Z', expected: -90 },
  ])('should compute subsolar longitude at $iso', ({ iso, expected }) => {
    const longitude = getSubsolarLongitude(new Date(iso));
    expect(longitude).toBeCloseTo(expected, 6);
  });
});

describe('Polar edge cases', () => {
  it('should handle polar night (Tromsø winter)', () => {
    expect(isNight(69.65, 18.96, toDate('2024-12-31T12:00:00Z'))).toBe(true);
  });

  it('should handle midnight sun (McMurdo summer)', () => {
    expect(isNight(-77.85, 166.67, toDate('2024-12-31T12:00:00Z'))).toBe(false);
  });

  it('should show seasonal contrast at extreme latitudes', () => {
    const winter = isNight(85, 0, toDate('2024-12-21T12:00:00Z'));
    const summer = isNight(85, 0, toDate('2024-06-21T12:00:00Z'));
    expect(winter).not.toBe(summer);
  });
});

describe('clearSolarCache', () => {
  it('should allow fresh calculations after clear', () => {
    const r1 = getSolarDeclination(DEC_31_NOON);
    clearSolarCache();
    const r2 = getSolarDeclination(DEC_31_NOON);
    expect(r1).toBeCloseTo(r2, 5);
  });
});