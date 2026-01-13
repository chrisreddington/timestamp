/**
 * Tests for wall-clock-conversion utilities.
 *
 * @remarks
 * These tests verify the SINGLE SOURCE OF TRUTH for wall-clock time conversions.
 * All edge cases including DST, half-hour offsets, and boundary conditions are covered.
 */

import { withIsoTime } from '@/test-utils/time-helpers';
import type { WallClockTime } from '@core/types';
import { describe, expect, it, vi } from 'vitest';
import {
    convertWallClockToAbsolute,
    createNextOccurrence,
    createWallClock,
    ensureValidTimezone,
    extractWallClockFromLocalDate,
    formatWallClockForUrl,
    hasWallClockTimeReached,
    isValidWallClockTime,
    wallClockEquals,
} from './wall-clock-conversion';

describe('convertWallClockToAbsolute', () => {
  const newYearMidnight: WallClockTime = {
    year: 2026,
    month: 0,
    day: 1,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };

  describe('standard timezone conversions', () => {
    it.each([
      { tz: 'America/Los_Angeles', expected: '2026-01-01T08:00:00.000Z' },
      { tz: 'Asia/Tokyo', expected: '2025-12-31T15:00:00.000Z' },
      { tz: 'Europe/London', expected: '2026-01-01T00:00:00.000Z' },
      { tz: 'UTC', expected: '2026-01-01T00:00:00.000Z' },
      { tz: 'America/New_York', expected: '2026-01-01T05:00:00.000Z' },
      { tz: 'Australia/Sydney', expected: '2025-12-31T13:00:00.000Z' },
    ])('should convert midnight to $expected for $tz', ({ tz, expected }) => {
      const result = convertWallClockToAbsolute(newYearMidnight, tz);
      expect(result.toISOString()).toBe(expected);
    });
  });

  describe('half-hour offset timezones', () => {
    it.each([
      { tz: 'Asia/Kolkata', expected: '2025-12-31T18:30:00.000Z' },
      { tz: 'Asia/Kathmandu', expected: '2025-12-31T18:15:00.000Z' },
      { tz: 'America/St_Johns', expected: '2026-01-01T03:30:00.000Z' },
      { tz: 'Australia/Adelaide', expected: '2025-12-31T13:30:00.000Z' },
    ])('should convert half-offset midnight for $tz', ({ tz, expected }) => {
      const result = convertWallClockToAbsolute(newYearMidnight, tz);
      expect(result.toISOString()).toBe(expected);
    });
  });

  describe('non-midnight wall-clock times', () => {
    it('should handle afternoon times correctly', () => {
      const afternoon: WallClockTime = {
        year: 2026,
        month: 0,
        day: 1,
        hours: 15,
        minutes: 30,
        seconds: 45,
      };
      const result = convertWallClockToAbsolute(
        afternoon,
        'America/Los_Angeles'
      );
      // 15:30:45 LA time = 23:30:45 UTC
      expect(result.toISOString()).toBe('2026-01-01T23:30:45.000Z');
    });

    it('should handle seconds precision', () => {
      const preciseTime: WallClockTime = {
        year: 2026,
        month: 5,
        day: 15,
        hours: 12,
        minutes: 30,
        seconds: 59,
      };
      const result = convertWallClockToAbsolute(preciseTime, 'UTC');
      expect(result.toISOString()).toBe('2026-06-15T12:30:59.000Z');
    });
  });
});

describe('hasWallClockTimeReached', () => {
  const newYearMidnight: WallClockTime = {
    year: 2026,
    month: 0,
    day: 1,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };

  describe('boundary conditions', () => {
    it('should return false 1 second before target', () => {
      // LA midnight = 08:00:00 UTC
      const oneSecondBefore = new Date('2026-01-01T07:59:59.000Z');
      expect(
        hasWallClockTimeReached(
          newYearMidnight,
          'America/Los_Angeles',
          oneSecondBefore
        )
      ).toBe(false);
    });

    it('should return true exactly at target', () => {
      const exactlyAt = new Date('2026-01-01T08:00:00.000Z');
      expect(
        hasWallClockTimeReached(
          newYearMidnight,
          'America/Los_Angeles',
          exactlyAt
        )
      ).toBe(true);
    });

    it('should return true 1 second after target', () => {
      const oneSecondAfter = new Date('2026-01-01T08:00:01.000Z');
      expect(
        hasWallClockTimeReached(
          newYearMidnight,
          'America/Los_Angeles',
          oneSecondAfter
        )
      ).toBe(true);
    });

    it('should handle millisecond precision', () => {
      const justBefore = new Date('2026-01-01T07:59:59.999Z');
      const justAt = new Date('2026-01-01T08:00:00.000Z');

      expect(
        hasWallClockTimeReached(
          newYearMidnight,
          'America/Los_Angeles',
          justBefore
        )
      ).toBe(false);
      expect(
        hasWallClockTimeReached(newYearMidnight, 'America/Los_Angeles', justAt)
      ).toBe(true);
    });
  });

  describe('timezone-aware behavior', () => {
    it('should return true when Tokyo has celebrated but LA has not', () => {
      // At Dec 31, 2025 20:00 UTC:
      // LA: Dec 31, 12:00 (counting)
      // Tokyo: Jan 1, 05:00 (celebrated 5 hours ago)
      const testTime = new Date('2025-12-31T20:00:00Z');

      expect(
        hasWallClockTimeReached(
          newYearMidnight,
          'America/Los_Angeles',
          testTime
        )
      ).toBe(false);
      expect(
        hasWallClockTimeReached(newYearMidnight, 'Asia/Tokyo', testTime)
      ).toBe(true);
    });

    it('should handle simultaneous check across multiple timezones', () => {
      // At Dec 31, 2025 23:30:00 UTC:
      // London: 23:30 (30 mins to go)
      // Tokyo: Jan 1, 08:30 (celebrated)
      // LA: 15:30 (counting)
      const testTime = new Date('2025-12-31T23:30:00Z');

      expect(
        hasWallClockTimeReached(newYearMidnight, 'Europe/London', testTime)
      ).toBe(false);
      expect(
        hasWallClockTimeReached(newYearMidnight, 'Asia/Tokyo', testTime)
      ).toBe(true);
      expect(
        hasWallClockTimeReached(
          newYearMidnight,
          'America/Los_Angeles',
          testTime
        )
      ).toBe(false);
    });
  });

  describe('without reference date (uses current time)', () => {
    it('should use current time when referenceDate is not provided', () => {
      // Test a date far in the past - should always be reached
      const pastWallClock: WallClockTime = {
        year: 2020,
        month: 0,
        day: 1,
        hours: 0,
        minutes: 0,
        seconds: 0,
      };
      expect(hasWallClockTimeReached(pastWallClock, 'UTC')).toBe(true);

      // Test a date far in the future - should never be reached
      const futureWallClock: WallClockTime = {
        year: 2099,
        month: 0,
        day: 1,
        hours: 0,
        minutes: 0,
        seconds: 0,
      };
      expect(hasWallClockTimeReached(futureWallClock, 'UTC')).toBe(false);
    });
  });
});

describe('extractWallClockFromLocalDate', () => {
  it.each([
    {
      description: 'local afternoon time',
      date: new Date(2026, 5, 15, 14, 30, 45),
      expected: { year: 2026, month: 5, day: 15, hours: 14, minutes: 30, seconds: 45 },
    },
    {
      description: 'midnight boundary',
      date: new Date(2026, 0, 1, 0, 0, 0),
      expected: { year: 2026, month: 0, day: 1, hours: 0, minutes: 0, seconds: 0 },
    },
    {
      description: 'end of day boundary',
      date: new Date(2026, 11, 31, 23, 59, 59),
      expected: { year: 2026, month: 11, day: 31, hours: 23, minutes: 59, seconds: 59 },
    },
  ])('should extract wall clock for $description', ({ date, expected }) => {
    expect(extractWallClockFromLocalDate(date)).toEqual(expected);
  });
});

describe('formatWallClockForUrl', () => {
  const formatCases: Array<{ description: string; wallClock: WallClockTime; expected: string }> = [
    {
      description: 'midnight baseline',
      wallClock: { year: 2026, month: 0, day: 1, hours: 0, minutes: 0, seconds: 0 },
      expected: '2026-01-01T00:00:00',
    },
    {
      description: 'zero-pads single digits',
      wallClock: { year: 2026, month: 5, day: 5, hours: 9, minutes: 5, seconds: 5 },
      expected: '2026-06-05T09:05:05',
    },
    {
      description: 'supports double-digit values',
      wallClock: { year: 2026, month: 11, day: 31, hours: 23, minutes: 59, seconds: 59 },
      expected: '2026-12-31T23:59:59',
    },
  ];

  it.each(formatCases)('should format wall clock when $description', ({ wallClock, expected }) => {
    const result = formatWallClockForUrl(wallClock);

    expect(result).toBe(expected);
    expect(result).not.toContain('Z');
    expect(result).not.toContain('z');
  });
});

describe('createWallClock', () => {
  it.each([
    {
      description: 'all components provided',
      args: [2026, 11, 25, 18, 30, 45] as const,
      expected: { year: 2026, month: 11, day: 25, hours: 18, minutes: 30, seconds: 45 },
    },
    {
      description: 'defaults time components to zero',
      args: [2026, 0, 1] as const,
      expected: { year: 2026, month: 0, day: 1, hours: 0, minutes: 0, seconds: 0 },
    },
    {
      description: 'fills missing seconds with zero',
      args: [2025, 11, 24, 21, 30] as const,
      expected: { year: 2025, month: 11, day: 24, hours: 21, minutes: 30, seconds: 0 },
    },
  ])('should create wall-clock time when $description', ({ args, expected }) => {
    const result = createWallClock(...args);

    expect(result).toEqual(expected);
  });
});

describe('createNextOccurrence', () => {
  describe('New Year scenarios', () => {
    it.each([
      {
        description: 'middle of year returns next New Year',
        iso: '2025-06-15T12:00:00Z',
        expected: { year: 2026, month: 0, day: 1, hours: 0, minutes: 0, seconds: 0 },
      },
      {
        description: 'Dec 31 rolls to following year',
        iso: '2025-12-31T23:59:59Z',
        expected: { year: 2026, month: 0, day: 1, hours: 0, minutes: 0, seconds: 0 },
      },
      {
        description: 'current year already passed advances again',
        iso: '2026-01-02T12:00:00Z',
        expected: { year: 2027, month: 0, day: 1, hours: 0, minutes: 0, seconds: 0 },
      },
    ])('should compute next New Year when $description', async ({ iso, expected }) => {
      await withIsoTime(iso, () => {
        const result = createNextOccurrence(0, 1);

        expect(result).toEqual(expected);
      });
    });

    it('should convert next New Year wall-clock to absolute time in a timezone', async () => {
      await withIsoTime('2025-12-15T12:00:00Z', () => {
        const wallClock = createNextOccurrence(0, 1);

        const laNewYear = convertWallClockToAbsolute(wallClock, 'America/Los_Angeles');

        expect(laNewYear.toISOString()).toBe('2026-01-01T08:00:00.000Z');
      });
    });
  });

  describe('Christmas scenarios', () => {
    it.each([
      {
        description: 'this year when not reached',
        iso: '2025-06-15T12:00:00Z',
        args: [11, 25] as const,
        expected: { year: 2025, month: 11, day: 25, hours: 0, minutes: 0, seconds: 0 },
      },
      {
        description: 'next year when already passed',
        iso: '2025-12-26T12:00:00Z',
        args: [11, 25] as const,
        expected: { year: 2026, month: 11, day: 25, hours: 0, minutes: 0, seconds: 0 },
      },
      {
        description: 'with specific time on same year',
        iso: '2025-06-15T12:00:00Z',
        args: [11, 25, 18, 0] as const,
        expected: { year: 2025, month: 11, day: 25, hours: 18, minutes: 0, seconds: 0 },
      },
    ])('should return Christmas occurrence for $description', async ({ iso, args, expected }) => {
      await withIsoTime(iso, () => {
        const result = createNextOccurrence(...args);

        expect(result).toEqual(expected);
      });
    });
  });

  describe('Birthday scenarios', () => {
    it.each([
      { description: 'upcoming birthday stays in current year', iso: '2025-01-15T12:00:00Z', expectedYear: 2025 },
      { description: 'passed birthday moves to next year', iso: '2025-06-21T12:00:00Z', expectedYear: 2026 },
    ])('should return correct year when $description', async ({ iso, expectedYear }) => {
      await withIsoTime(iso, () => {
        const result = createNextOccurrence(5, 20);

        expect(result.year).toBe(expectedYear);
      });
    });
  });

  describe('Same day edge cases', () => {
    it.each([
      // Use dates clearly after Dec 25 midnight in any timezone (Dec 26 mid-day UTC)
      { description: 'day after target', iso: '2025-12-26T12:00:00Z' },
      { description: 'multiple days after target', iso: '2025-12-27T12:00:00Z' },
    ])('should advance to next year when $description', async ({ iso }) => {
      await withIsoTime(iso, () => {
        const result = createNextOccurrence(11, 25);

        expect(result.year).toBe(2026);
      });
    });
  });

  describe('Custom reference date', () => {
    it.each([
      { description: 'future reference before event', ref: new Date('2024-06-15T12:00:00Z'), expectedYear: 2024 },
      { description: 'future reference after event', ref: new Date('2024-12-26T12:00:00Z'), expectedYear: 2025 },
    ])('should respect provided reference date when $description', ({ ref, expectedYear }) => {
      const result = createNextOccurrence(11, 25, 0, 0, 0, ref);

      expect(result.year).toBe(expectedYear);
    });
  });
});

describe('isValidWallClockTime', () => {
  it.each<WallClockTime>([
    { year: 2026, month: 0, day: 1, hours: 0, minutes: 0, seconds: 0 },
    { year: 1970, month: 0, day: 1, hours: 0, minutes: 0, seconds: 0 },
    { year: 9999, month: 11, day: 31, hours: 23, minutes: 59, seconds: 59 },
    { year: 2026, month: 11, day: 31, hours: 23, minutes: 59, seconds: 59 },
  ])('should accept valid wall-clock time %#', (wallClock) => {
    expect(isValidWallClockTime(wallClock)).toBe(true);
  });

  it.each<WallClockTime>([
    { year: 2026, month: 12, day: 1, hours: 0, minutes: 0, seconds: 0 },
    { year: 2026, month: 0, day: 1, hours: 24, minutes: 0, seconds: 0 },
    { year: 2026, month: 0, day: 0, hours: 0, minutes: 0, seconds: 0 },
    { year: 2026, month: 0, day: 1, hours: 0, minutes: 60, seconds: 0 },
    { year: 1969, month: 0, day: 1, hours: 0, minutes: 0, seconds: 0 },
  ])('should reject invalid wall-clock time %#', (wallClock) => {
    expect(isValidWallClockTime(wallClock)).toBe(false);
  });
});

describe('wallClockEquals', () => {
  const base: WallClockTime = {
    year: 2026,
    month: 0,
    day: 1,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };

  it('should return true for identical times', () => {
    const copy = { ...base };
    expect(wallClockEquals(base, copy)).toBe(true);
  });

  it.each([
    ['year', { ...base, year: 2027 }],
    ['month', { ...base, month: 1 }],
    ['day', { ...base, day: 2 }],
    ['hours', { ...base, hours: 1 }],
    ['minutes', { ...base, minutes: 1 }],
    ['seconds', { ...base, seconds: 1 }],
  ])('should return false when %s differs', (_field, different) => {
    expect(wallClockEquals(base, different)).toBe(false);
  });
});

describe('ensureValidTimezone', () => {
  it.each([
    'America/Los_Angeles',
    'Asia/Tokyo',
    'UTC',
    'Europe/London',
  ])('should return %s unchanged when valid', (timezone) => {
    expect(ensureValidTimezone(timezone)).toBe(timezone);
  });

  it.each([
    ['undefined value', undefined],
    ['null value', null],
    ['empty string', ''],
  ])('should default to UTC for %s', (_label, timezone) => {
    expect(ensureValidTimezone(timezone as string | null | undefined)).toBe(
      'UTC'
    );
  });

  it.each([
    'Invalid/Timezone',
    'Not/A/Real/Timezone',
  ])('should warn and return UTC for %s', (timezone) => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = ensureValidTimezone(timezone);

    expect(result).toBe('UTC');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe('DST transitions', () => {
  describe('spring forward (March)', () => {
    it('should handle time during spring forward gap', () => {
      // In America/New_York, 2:00 AM on March 8, 2026 jumps to 3:00 AM
      // 2:30 AM doesn't exist, but we should handle it gracefully
      const gapTime: WallClockTime = {
        year: 2026,
        month: 2, // March
        day: 8,
        hours: 2,
        minutes: 30,
        seconds: 0,
      };

      // Should not throw, should return a reasonable result
      const result = convertWallClockToAbsolute(gapTime, 'America/New_York');

      // Result should be valid Date
      expect(result.getTime()).not.toBeNaN();
    });

    it('should correctly calculate time just after spring forward', () => {
      // Use a time that's definitely after DST starts (March 15)
      // 3:00 AM EDT = 07:00 UTC (UTC-4 in EDT)
      const afterDst: WallClockTime = {
        year: 2026,
        month: 2, // March
        day: 15, // Well after DST starts
        hours: 15, // 3 PM EDT
        minutes: 0,
        seconds: 0,
      };

      const result = convertWallClockToAbsolute(afterDst, 'America/New_York');

      // 3 PM EDT (UTC-4) = 19:00 UTC
      expect(result.toISOString()).toBe('2026-03-15T19:00:00.000Z');
    });
  });

  describe('fall back (November)', () => {
    it('should handle ambiguous time during fall back', () => {
      // In America/New_York, 1:30 AM on Nov 1, 2026 occurs twice
      // First at 05:30 UTC (EDT), then at 06:30 UTC (EST)
      const ambiguousTime: WallClockTime = {
        year: 2026,
        month: 10, // November
        day: 1,
        hours: 1,
        minutes: 30,
        seconds: 0,
      };

      const result = convertWallClockToAbsolute(
        ambiguousTime,
        'America/New_York'
      );

      // Should return a valid Date (implementation may choose either occurrence)
      expect(result.getTime()).not.toBeNaN();

      // The result should be either 05:30 or 06:30 UTC
      const utcHour = result.getUTCHours();
      const utcMinutes = result.getUTCMinutes();
      expect([5, 6]).toContain(utcHour);
      expect(utcMinutes).toBe(30);
    });
  });
});
