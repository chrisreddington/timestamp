/**
 * Unified URL management for countdown configuration.
 * Handles parsing, validation, serialization, and history state management.
 */

import { DEFAULT_COMPLETION_MESSAGE } from '@core/config/constants';
import { getModeConfig, MODE_CONFIG, shouldIncludeTimezoneInUrl } from '@core/config/mode-config';
import { type DurationFormatStyle, parseDurationParam } from '@core/time/duration';
import { getUserTimezone } from '@core/time/timezone';
import { convertWallClockToAbsolute, extractWallClockFromLocalDate, formatWallClockForUrl } from '@core/time/wall-clock-conversion';
import type {
    CountdownConfig,
    CountdownMode,
    DeepLinkParams,
    ParsedDeepLink,
    ThemeId,
    WallClockTime,
} from '@core/types';
import { MAX_MESSAGE_LENGTH } from '@core/utils/text';
import { DEFAULT_THEME_ID, isValidThemeId } from '@themes/registry';

export type { DurationFormatStyle };

// ============================================================================
// TYPES
// ============================================================================

/** Result of target date validation. */
export interface DateValidationResult {
  isValid: boolean;
  date?: Date;
  error?: string;
}

/** URLs for sharing a countdown with different timezone options. */
export interface ShareTargets {
  withSelectedTimezone: string;
  withLocalTimezone: string;
  withoutTimezone: string;
}

/** Internal: mode-specific resolution outputs. */
interface ModeResolutionResult {
  targetDate?: Date;
  durationSeconds?: number;
  wallClockTarget?: WallClockTime;
}

// ============================================================================
// PARSING & VALIDATION
// ============================================================================

/**
 * Parse and validate deep-link parameters from a URL.
 *
 * @param url - URL string (defaults to window.location.href)
 * @returns Parsed result with config or validation errors
 * @example
 * ```typescript
 * const result = parseDeepLink('https://example.com/?mode=timer&duration=300');
 * if (result.isValid) {
 *   console.log(result.config.mode); // 'timer'
 * }
 * ```
 * @public
 */
export function parseDeepLink(url?: string): ParsedDeepLink {
  const targetUrl = resolveUrl(url);
  if (!targetUrl) return { isValid: false };

  const params = readParams(targetUrl.searchParams);
  if (!targetUrl.searchParams.toString()) return { isValid: false };

  const mode = parseCountdownMode(targetUrl.searchParams);
  const theme: ThemeId = isValidThemeId(params.theme) ? params.theme : DEFAULT_THEME_ID;
  const timezone = params.tz ?? getUserTimezone();
  const errors: string[] = [];

  const { targetDate, durationSeconds, wallClockTarget } = resolveModeConfig(
    mode,
    params,
    timezone,
    errors
  );

  if (errors.length > 0 || !targetDate) {
    return { isValid: false, errors };
  }

  // Parse chrome visibility parameter (chrome=none hides all UI)
  const hideChrome = params.chrome === 'none';

  const config: CountdownConfig = {
    mode,
    targetDate,
    durationSeconds,
    wallClockTarget,
    completionMessage: buildCompletionMessage(params.message),
    theme,
    timezone,
    showWorldMap: parseBooleanParam(params.showWorldMap, true),
    hideChrome,
  };

  return {
    isValid: true,
    config,
    shouldShowConfiguration: parseBooleanParam(params.configure, false),
    hideChrome,
  };
}

/**
 * Validate ISO8601 target date is valid and in the future.
 *
 * @param target - ISO8601 date string
 * @returns Validation result with Date or error
 * @example
 * ```typescript
 * const result = validateTargetDate('2026-01-01T00:00:00Z');
 * if (result.isValid) {
 *   console.log(result.date); // Date object
 * }
 * ```
 * @public
 */
export function validateTargetDate(target: string): DateValidationResult {
  const date = new Date(target);
  if (Number.isNaN(date.getTime())) {
    return { isValid: false, error: 'Invalid target date format.' };
  }
  if (date.getTime() <= Date.now()) {
    return { isValid: false, error: 'Target date must be in the future.' };
  }
  return { isValid: true, date };
}

/**
 * Detect countdown mode from URL parameters.
 *
 * @remarks
 * Priority: explicit mode param → duration implies timer → wall-clock default.
 *
 * @param params - URL search params
 * @returns Detected countdown mode
 * @example
 * ```typescript
 * const params = new URLSearchParams('duration=300');
 * parseCountdownMode(params); // 'timer'
 * ```
 * @public
 */
export function parseCountdownMode(params: URLSearchParams): CountdownMode {
  const mode = params.get('mode');
  if (mode && (Object.keys(MODE_CONFIG) as CountdownMode[]).includes(mode as CountdownMode)) {
    return mode as CountdownMode;
  }
  if (params.get('duration')) return 'timer';
  return 'wall-clock';
}

/**
 * Parse wall-clock components from ISO target string (no Z suffix).
 *
 * @param target - ISO8601 datetime without timezone (e.g., '2026-01-01T00:00:00')
 * @returns WallClockTime components or null if invalid
 * @example
 * ```typescript
 * const wallClock = parseWallClockFromTarget('2026-01-01T00:00:00');
 * console.log(wallClock?.year); // 2026
 * ```
 * @public
 */
export function parseWallClockFromTarget(target: string): WallClockTime | null {
  if (target.endsWith('Z')) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(target);
  if (!match) return null;

  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10) - 1,
    day: parseInt(match[3], 10),
    hours: parseInt(match[4], 10),
    minutes: parseInt(match[5], 10),
    seconds: parseInt(match[6], 10),
  };
}

// ============================================================================
// SERIALIZATION & URL BUILDING
// ============================================================================

/**
 * Build complete countdown URL from config.
 *
 * @param config - Countdown configuration
 * @returns URL with all parameters set
 * @example
 * ```typescript
 * const url = buildCountdownUrl({
 *   mode: 'timer',
 *   targetDate: new Date(),
 *   durationSeconds: 300,
 *   theme: 'fireworks',
 *   timezone: 'UTC',
 *   completionMessage: 'Done!',
 *   showWorldMap: false
 * });
 * console.log(url.toString());
 * ```
 * @public
 */
export function buildCountdownUrl(config: CountdownConfig): URL {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set('mode', config.mode);
  url.searchParams.set('theme', config.theme);

  if (shouldIncludeTimezoneInUrl(config.mode)) {
    url.searchParams.set('tz', config.timezone);
  }
  applyShowWorldMapParam(url, config.showWorldMap);

  const modeConfig = getModeConfig(config.mode);
  if (modeConfig.isDurationBased && config.durationSeconds) {
    url.searchParams.set('duration', config.durationSeconds.toString());
  } else if (modeConfig.isAbsolute) {
    url.searchParams.set('target', config.targetDate.toISOString());
  } else {
    // NOTE: Wall-clock mode uses abstract time without Z suffix
    const wallClock = config.wallClockTarget ?? extractWallClockFromLocalDate(config.targetDate);
    if (!config.wallClockTarget && import.meta.env?.DEV) {
      console.warn('buildCountdownUrl: wallClockTarget missing, extracting from targetDate');
    }
    url.searchParams.set('target', formatWallClockForUrl(wallClock));
  }

  if (config.completionMessage && config.completionMessage !== DEFAULT_COMPLETION_MESSAGE) {
    url.searchParams.set('message', config.completionMessage);
  }

  return url;
}

/**
 * Build share URLs with different timezone options.
 *
 * @param config - Countdown configuration
 * @returns Three URL variants for sharing
 * @example
 * ```typescript
 * const urls = buildShareUrls(config);
 * navigator.clipboard.writeText(urls.withLocalTimezone);
 * ```
 * @public
 */
export function buildShareUrls(config: CountdownConfig): ShareTargets {
  const baseUrl = buildCountdownUrl(config);

  if (!shouldIncludeTimezoneInUrl(config.mode)) {
    const url = baseUrl.toString();
    return { withSelectedTimezone: url, withLocalTimezone: url, withoutTimezone: url };
  }

  const withSelectedTimezone = baseUrl.toString();

  const localUrl = new URL(baseUrl.toString());
  localUrl.searchParams.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);
  const withLocalTimezone = localUrl.toString();

  const withoutUrl = new URL(baseUrl.toString());
  withoutUrl.searchParams.delete('tz');
  const withoutTimezone = withoutUrl.toString();

  return { withSelectedTimezone, withLocalTimezone, withoutTimezone };
}

// ============================================================================
// HISTORY STATE MANAGEMENT
// ============================================================================

/**
 * Sync timezone to URL without adding history entry.
 *
 * @param timezone - IANA timezone identifier
 * @param currentConfig - Current countdown configuration
 * @example
 * ```typescript
 * syncTimezoneToUrl('America/New_York', currentConfig);
 * ```
 * @public
 */
export function syncTimezoneToUrl(timezone: string, currentConfig: CountdownConfig): void {
  replaceCountdownState(currentConfig, { timezone });
}

/**
 * Sync theme to URL without adding history entry.
 *
 * @param themeId - Theme identifier
 * @param currentConfig - Current countdown configuration
 * @example
 * ```typescript
 * syncThemeToUrl('fireworks', currentConfig);
 * ```
 * @public
 */
export function syncThemeToUrl(themeId: ThemeId, currentConfig: CountdownConfig): void {
  replaceCountdownState(currentConfig, { theme: themeId });
}

/**
 * Push countdown state to browser history.
 *
 * @param config - Countdown configuration
 * @example
 * ```typescript
 * pushCountdownToHistory(config);
 * ```
 * @public
 */
export function pushCountdownToHistory(config: CountdownConfig): void {
  const url = buildCountdownUrl(config);
  window.history.pushState({ config, view: 'countdown' }, '', url.toString());
}

/**
 * Clear all query parameters from URL.
 *
 * @returns URL with empty search params
 * @example
 * ```typescript
 * const cleanUrl = clearQueryParams();
 * ```
 * @public
 */
export function clearQueryParams(): URL {
  const url = new URL(window.location.href);
  url.search = '';
  return url;
}

/**
 * Push landing page state to history.
 *
 * @param previousConfig - Optional config to preserve for form pre-fill
 * @example
 * ```typescript
 * pushLandingPageState();
 * ```
 * @public
 */
export function pushLandingPageState(previousConfig?: CountdownConfig): void {
  const url = clearQueryParams();
  window.history.pushState({ view: 'landing', config: previousConfig }, '', url.toString());
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

function resolveUrl(url?: string): URL | null {
  if (url) {
    try {
      return new URL(url, 'https://example.com');
    } catch {
      if (import.meta.env?.DEV) {
        console.warn('Unable to parse URL for deep link');
      }
      return null;
    }
  }
  if (typeof window !== 'undefined' && window.location) {
    return new URL(window.location.href);
  }
  return null;
}

function readParams(searchParams: URLSearchParams): DeepLinkParams {
  const params: DeepLinkParams = {};
  searchParams.forEach((value, key) => {
    params[key as keyof DeepLinkParams] = value;
  });
  return params;
}

function resolveModeConfig(
  mode: CountdownMode,
  params: DeepLinkParams,
  timezone: string,
  errors: string[]
): ModeResolutionResult {
  const modeConfig = getModeConfig(mode);

  if (modeConfig.isDurationBased) return resolveTimerConfig(params, errors);
  if (modeConfig.isAbsolute) return resolveAbsoluteConfig(params, errors);
  return resolveWallClockConfig(params, timezone, errors);
}

function parseBooleanParam(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return defaultValue;
}

function buildCompletionMessage(rawMessage?: string): string {
  if (!rawMessage) return DEFAULT_COMPLETION_MESSAGE;

  // Decode URL encoding, truncate to max length
  // Store as PLAIN TEXT - SafeMessage is created at display time
  try {
    const decoded = decodeURIComponent(rawMessage);
    return decoded.slice(0, MAX_MESSAGE_LENGTH);
  } catch {
    // Malformed encoding - use as-is, truncated
    return rawMessage.slice(0, MAX_MESSAGE_LENGTH);
  }
}

function resolveTimerConfig(params: DeepLinkParams, errors: string[]): ModeResolutionResult {
  if (!params.duration) {
    errors.push('Duration is required for timer mode.');
    return {};
  }
  const parsedDuration = parseDurationParam(params.duration);
  if (parsedDuration === null) {
    errors.push('Invalid duration. Must be a positive number of seconds (max 31,536,000).');
    return {};
  }
  return {
    durationSeconds: parsedDuration,
    targetDate: new Date(Date.now() + parsedDuration * 1000),
  };
}

function resolveAbsoluteConfig(params: DeepLinkParams, errors: string[]): ModeResolutionResult {
  if (!params.target) {
    errors.push('Target date is required for absolute mode.');
    return {};
  }
  if (!params.target.endsWith('Z')) {
    errors.push('Absolute mode requires UTC target (must end with Z).');
    return {};
  }
  const dateResult = validateTargetDate(params.target);
  if (!dateResult.isValid || !dateResult.date) {
    errors.push(dateResult.error ?? 'Invalid target date.');
    return {};
  }
  return { targetDate: dateResult.date };
}

function resolveWallClockConfig(
  params: DeepLinkParams,
  timezone: string,
  errors: string[]
): ModeResolutionResult {
  if (!params.target) {
    errors.push('Target date is required for wall-clock mode.');
    return {};
  }
  if (params.target.endsWith('Z')) {
    errors.push('Wall-clock mode requires abstract time (must not end with Z).');
    return {};
  }
  const wallClock = parseWallClockFromTarget(params.target);
  if (!wallClock) {
    errors.push('Invalid wall-clock target format. Use YYYY-MM-DDTHH:MM:SS without Z.');
    return {};
  }
  return {
    wallClockTarget: wallClock,
    targetDate: convertWallClockToAbsolute(wallClock, timezone),
  };
}

function applyShowWorldMapParam(url: URL, showWorldMap?: boolean): void {
  if (showWorldMap === false) {
    url.searchParams.set('showWorldMap', 'false');
  } else {
    url.searchParams.delete('showWorldMap');
  }
}

function replaceCountdownState(
  currentConfig: CountdownConfig,
  overrides: Partial<CountdownConfig>
): void {
  if (!currentConfig) {
    if (import.meta.env?.DEV) {
      console.warn('replaceCountdownState called without config, skipping URL sync');
    }
    return;
  }

  const updatedConfig: CountdownConfig = { ...currentConfig, ...overrides };
  const url = new URL(window.location.href);

  url.searchParams.set('theme', updatedConfig.theme);
  url.searchParams.set('tz', updatedConfig.timezone);
  applyShowWorldMapParam(url, updatedConfig.showWorldMap);

  window.history.replaceState({ config: updatedConfig, view: 'countdown' }, '', url.toString());
}
