/**
 * Timezone utilities - pure functions for timezone calculations.
 * Uses native Intl APIs for timezone-aware date operations.
 */

// =============================================================================
// TIMEZONE OFFSET CACHE
// =============================================================================

/** Cache key for timezone offset (timezone-date string). */
type OffsetCacheKey = string;

/** Cache for timezone offset calculations (prevents repeated Intl.DateTimeFormat calls). */
const timezoneOffsetCache = new Map<OffsetCacheKey, number>();

/**
 * Generate cache key for timezone offset lookup.
 * Truncates to minute precision to maximize cache hits.
 */
function getOffsetCacheKey(timezone: string, date: Date): OffsetCacheKey {
  // Truncate to minute precision (seconds/ms don't affect offset)
  const minutes = Math.floor(date.getTime() / 60000);
  return `${timezone}:${minutes}`;
}

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
 * PERFORMANCE: Results are cached to avoid repeated Intl.DateTimeFormat calls.
 * @param timezone - IANA timezone identifier
 * @param date - Optional date to check (defaults to current time)
 * @returns Offset in minutes from UTC (positive = ahead of UTC)
 * @public
 */
export function getTimezoneOffsetMinutes(timezone: string, date?: Date): number {
  const now = date ?? new Date();
  
  // Check cache first
  const cacheKey = getOffsetCacheKey(timezone, now);
  const cached = timezoneOffsetCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '0';

  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10) - 1;
  const day = parseInt(getPart('day'), 10);
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const second = parseInt(getPart('second'), 10);

  const utcTime = Date.UTC(year, month, day, hour, minute, second);
  const diffMs = utcTime - now.getTime();
  const offsetMinutes = Math.round(diffMs / 60000);
  
  // Cache the result
  timezoneOffsetCache.set(cacheKey, offsetMinutes);
  
  // Limit cache size (LRU-style cleanup)
  if (timezoneOffsetCache.size > 100) {
    const firstKey = timezoneOffsetCache.keys().next().value;
    if (firstKey) timezoneOffsetCache.delete(firstKey);
  }
  
  return offsetMinutes;
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
