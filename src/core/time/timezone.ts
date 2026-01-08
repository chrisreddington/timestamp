/**
 * Timezone utilities - pure functions for timezone calculations.
 * Uses native Intl APIs for timezone-aware date operations.
 */

/**
 * Get the user's current timezone from the browser.
 * @returns IANA timezone identifier
 * @public
 */
export function getUserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Get all available IANA timezones.
 * @returns Array of IANA timezone identifiers sorted alphabetically
 * @public
 */
export function getAllTimezones(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };

  let timezones: string[];

  if (intl.supportedValuesOf) {
    timezones = intl.supportedValuesOf('timeZone');
  } else {
    // NOTE: Fallback for older environments without Intl.supportedValuesOf
    timezones = [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Moscow',
      'Asia/Dubai',
      'Asia/Shanghai',
      'Asia/Tokyo',
      'Australia/Sydney',
      'Pacific/Auckland',
    ];
  }

  if (!timezones.includes('UTC')) {
    timezones.push('UTC');
  }

  return timezones.sort();
}
/**
 * Get the UTC offset in minutes for a given timezone at a specific time.
 *
 * This uses a dual-format approach with `Intl.DateTimeFormat` to materialize
 * the local clock time for both the target timezone and UTC at the same instant,
 * then computes the difference in minutes. This method is resilient to DST
 * transitions and historical timezone rules, since it relies on the platform's
 * timezone database rather than hard-coded offsets.
 *
 * Example: If New York is UTC-5 at the provided instant and UTC is 12:00, the
 * function will return `-300`.
 *
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @param date - Optional instant to evaluate (defaults to `new Date()`). The same instant is used for both formats.
 * @returns Offset in minutes from UTC (positive means ahead of UTC)
 * @public
 */
interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const numberPart = (type: string): number => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  return {
    year: numberPart('year'),
    month: numberPart('month'),
    day: numberPart('day'),
    hour: numberPart('hour'),
    minute: numberPart('minute'),
    second: numberPart('second'),
  };
}

export function getTimezoneOffsetMinutes(timezone: string, date: Date = new Date()): number {
  const zoned = getZonedDateParts(date, timezone);
  const utc = getZonedDateParts(date, 'UTC');

  const zonedUtcTime = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  );
  const utcTime = Date.UTC(
    utc.year,
    utc.month - 1,
    utc.day,
    utc.hour,
    utc.minute,
    utc.second
  );

  return Math.round((zonedUtcTime - utcTime) / 60000);
}

/**
 * Format the timezone offset as a human-readable label relative to a reference timezone.
 * @param timezone - IANA timezone identifier to format
 * @param referenceTimezone - IANA timezone to compare against
 * @param date - Optional date to check (defaults to current time)
 * @returns Human-readable offset label like "+2 hours" or "Your timezone"
 * @public
 */
export function formatOffsetLabel(
  timezone: string,
  referenceTimezone: string,
  date?: Date
): string {
  if (timezone === referenceTimezone) {
    return 'Your timezone';
  }

  const now = date ?? new Date();
  const targetOffset = getTimezoneOffsetMinutes(timezone, now);
  const refOffset = getTimezoneOffsetMinutes(referenceTimezone, now);

  const diffMinutes = targetOffset - refOffset;
  const diffHours = diffMinutes / 60;

  const absHours = Math.abs(diffHours);
  const hourStr = Number.isInteger(absHours)
    ? absHours.toString()
    : absHours.toFixed(1);
  const sign = diffHours >= 0 ? '+' : '-';
  const unit = absHours === 1 ? 'hour' : 'hours';

  return `${sign}${hourStr} ${unit}`;
}
